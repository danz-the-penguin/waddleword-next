// src/components/GameReviewModal.jsx - Tournament Match Review & Blunder Checker
// Supports direct Woogles API match fetch, GCG file upload, text parsing, and live match review

import React, { useState, useMemo } from "react";
import { parseGcgFile, downloadMatchAsGcg } from "../lib/gcgParser";
import { fetchWooglesGcg } from "../lib/wooglesSync";
import { playButtonClick, playChime } from "../lib/soundEffects";

const SAMPLE_GCG = `#player1 Dan Dan
#player2 HastyBot HastyBot
>Dan: EEEIRST 8D EAT +14 14
>HastyBot: ADENRRV 9C RAVEN +26 26
>Dan: EEIRSST 7G RESISTS +76 90
>HastyBot: ADENQU? 10A QUA +34 60
>Dan: AAILNOR 11E LAIRD +24 114
>HastyBot: DEILOTZ 12B DOZE +48 108
>Dan: AAINORV 13D AVION +28 142
>HastyBot: CEILOT? 14A zOOLITES +82 190`;

export default function GameReviewModal({
  isOpen,
  onClose,
  onSelectTurn,
  currentMatchHistory = [],
}) {
  const [gcgText, setGcgText] = useState(SAMPLE_GCG);
  const [wooglesInput, setWooglesInput] = useState("");
  const [isFetchingWoogles, setIsFetchingWoogles] = useState(false);
  const [wooglesError, setWooglesError] = useState(null);
  const [parsedTurns, setParsedTurns] = useState([]);
  const [activeTurnIdx, setActiveTurnIdx] = useState(null);
  const [hoveredGraphTurn, setHoveredGraphTurn] = useState(null);

  if (!isOpen) return null;

  const enrichTurns = (rawTurns) => {
    return rawTurns.map((t, idx) => {
      let tag = "best";
      let tagLabel = "★ Best";
      if (t.score >= 70) {
        tag = "best";
        tagLabel = "★ Bingo / Best";
      } else if (t.score >= 35) {
        tag = "excellent";
        tagLabel = "✓ Excellent";
      } else if (t.score >= 20) {
        tag = "inaccuracy";
        tagLabel = "?! Inaccuracy";
      } else {
        tag = "mistake";
        tagLabel = "? Sub-optimal";
      }

      const p1Score = t.myScore || 0;
      const p2Score = t.oppScore || 0;
      const spread = p1Score - p2Score;
      const prevSpread =
        idx > 0
          ? (rawTurns[idx - 1].myScore || 0) - (rawTurns[idx - 1].oppScore || 0)
          : 0;

      const isPlayer1 =
        t.player === "me" ||
        t.playerName?.toLowerCase() === "me" ||
        idx % 2 === 0;

      // An adverse equity swing against the player who just moved
      const swing = isPlayer1 ? prevSpread - spread : spread - prevSpread;
      const isBlunder = tag === "mistake" || (idx >= 1 && swing >= 25);

      return {
        ...t,
        turnNum: idx + 1,
        coord: t.pos || t.coord || "--",
        total:
          t.total !== undefined
            ? t.total
            : t.player === "me"
            ? t.myScore
            : t.oppScore,
        spread,
        swing,
        isBlunder,
        tag,
        tagLabel,
      };
    });
  };

  const analyzeGcgString = (text) => {
    const rawTurns = parseGcgFile(text);
    const enrichedTurns = enrichTurns(rawTurns);
    setParsedTurns(enrichedTurns);
    if (enrichedTurns.length > 0) {
      setActiveTurnIdx(0);
      playChime();
    }
  };

  const handleAnalyze = () => {
    analyzeGcgString(gcgText);
  };

  const handleLoadCurrentMatch = () => {
    if (!currentMatchHistory || currentMatchHistory.length === 0) return;
    playButtonClick();
    const enriched = enrichTurns(currentMatchHistory);
    setParsedTurns(enriched);
    if (enriched.length > 0) {
      setActiveTurnIdx(0);
      playChime();
    }
  };

  const handleFetchWoogles = async () => {
    if (!wooglesInput.trim()) return;
    setIsFetchingWoogles(true);
    setWooglesError(null);
    playButtonClick();

    try {
      const { gcg } = await fetchWooglesGcg(wooglesInput);
      setGcgText(gcg);
      analyzeGcgString(gcg);
    } catch (err) {
      console.error("Woogles sync error:", err);
      setWooglesError(err.message || "Failed to fetch Woogles match.");
    } finally {
      setIsFetchingWoogles(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result || "";
      setGcgText(content);
      analyzeGcgString(content);
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleExportGcg = () => {
    playButtonClick();
    const p1Name = parsedTurns[0]?.playerName || "Player 1";
    const p2Name = parsedTurns[1]?.playerName || "Player 2";
    downloadMatchAsGcg(parsedTurns, { player1: p1Name, player2: p2Name });
  };

  const handleReplayActiveTurn = () => {
    if (activeTurnIdx === null || !parsedTurns[activeTurnIdx]) return;
    playButtonClick();
    if (onSelectTurn) {
      onSelectTurn(parsedTurns[activeTurnIdx], activeTurnIdx);
    }
  };

  // SVG Chart Geometry Calculations
  const chartData = useMemo(() => {
    if (parsedTurns.length === 0) return null;

    const svgW = 660;
    const svgH = 130;
    const padLeft = 45;
    const padRight = 20;
    const padTop = 18;
    const padBottom = 22;
    const plotW = svgW - padLeft - padRight;
    const plotH = svgH - padTop - padBottom;
    const yZero = padTop + plotH / 2; // 63px

    const maxSpread = Math.max(
      35,
      ...parsedTurns.map((t) => Math.abs(t.spread || 0))
    );

    const points = parsedTurns.map((t, idx) => {
      const x =
        parsedTurns.length > 1
          ? padLeft + (idx / (parsedTurns.length - 1)) * plotW
          : padLeft + plotW / 2;
      const yRatio = (t.spread || 0) / maxSpread;
      const y = yZero - yRatio * (plotH / 2);
      return { x, y, turn: t, idx };
    });

    const polylineStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    // Positive area polygon: clamped above yZero
    const posPolyPoints = [
      `${points[0].x.toFixed(1)},${yZero}`,
      ...points.map((p) => `${p.x.toFixed(1)},${Math.min(yZero, p.y).toFixed(1)}`),
      `${points[points.length - 1].x.toFixed(1)},${yZero}`,
    ].join(" ");

    // Negative area polygon: clamped below yZero
    const negPolyPoints = [
      `${points[0].x.toFixed(1)},${yZero}`,
      ...points.map((p) => `${p.x.toFixed(1)},${Math.max(yZero, p.y).toFixed(1)}`),
      `${points[points.length - 1].x.toFixed(1)},${yZero}`,
    ].join(" ");

    const blunderPoints = points.filter((p) => p.turn.isBlunder);

    return {
      svgW,
      svgH,
      padLeft,
      padRight,
      padTop,
      padBottom,
      yZero,
      maxSpread,
      points,
      polylineStr,
      posPolyPoints,
      negPolyPoints,
      blunderPoints,
    };
  }, [parsedTurns]);

  const activeTurn =
    activeTurnIdx !== null && parsedTurns[activeTurnIdx]
      ? parsedTurns[activeTurnIdx]
      : null;

  const blunderCount = useMemo(
    () => parsedTurns.filter((t) => t.isBlunder).length,
    [parsedTurns]
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
    >
      <div
        className="win98-window"
        style={{
          width: "720px",
          maxWidth: "96vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "4px 4px 0px #000",
        }}
      >
        <div
          className="win98-titlebar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>📊 Tournament Match Review &amp; Blunder Graph</span>
          <button className="win98-button win98-btn-sys" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          style={{
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            flex: "1 1 auto",
            overflowY: "auto",
          }}
        >
          {/* Woogles Sync & Live Match Header Panel */}
          <div
            className="win98-sunken"
            style={{
              padding: "8px",
              background: "#e8eff7",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontWeight: "bold", fontSize: "11px", color: "#000080" }}>
                  🌐 Match Data Source:
                </span>
                <span style={{ fontSize: "10px", color: "#555" }}>
                  Sync from Woogles, upload .GCG, or analyze current live game
                </span>
              </div>
              {currentMatchHistory && currentMatchHistory.length > 0 && (
                <button
                  className="win98-button"
                  onClick={handleLoadCurrentMatch}
                  style={{
                    fontWeight: "bold",
                    fontSize: "11px",
                    backgroundColor: "#e0f2fe",
                    color: "#0369a1",
                    padding: "2px 8px",
                  }}
                >
                  ⚡ Load Live Game ({currentMatchHistory.length} turns)
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                className="win98-input"
                value={wooglesInput}
                onChange={(e) => setWooglesInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetchWoogles()}
                placeholder="e.g. https://woogles.io/game/akPTPGHkN4 or match ID"
                style={{ flex: 1, fontSize: "11px", padding: "3px 6px" }}
              />
              <button
                className="win98-button"
                onClick={handleFetchWoogles}
                disabled={isFetchingWoogles || !wooglesInput.trim()}
                style={{ fontWeight: "bold", minWidth: "90px", fontSize: "11px" }}
              >
                {isFetchingWoogles ? "Fetching..." : "⚡ Sync Woogles"}
              </button>
            </div>
            {wooglesError && (
              <div
                style={{
                  color: "#cc0000",
                  fontSize: "11px",
                  fontWeight: "bold",
                  backgroundColor: "#ffebee",
                  padding: "3px 6px",
                  border: "1px solid #ffcdd2",
                }}
              >
                ⚠ {wooglesError}
              </div>
            )}
          </div>

          {parsedTurns.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ margin: 0, fontSize: "12px" }}>
                Or paste a tournament match transcript (.gcg from Woogles / ISC) or upload a file:
              </p>
              <textarea
                className="win98-input font-mono"
                rows={9}
                value={gcgText}
                onChange={(e) => setGcgText(e.target.value)}
                style={{ width: "100%", fontSize: "11px", boxSizing: "border-box" }}
              />
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ position: "relative", overflow: "hidden", display: "inline-block" }}>
                  <button className="win98-button">📂 Upload .GCG File</button>
                  <input
                    type="file"
                    accept=".gcg"
                    onChange={handleFileUpload}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      opacity: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                    }}
                  />
                </div>
                <button
                  className="win98-button"
                  onClick={handleAnalyze}
                  style={{ fontWeight: "bold", padding: "4px 16px" }}
                >
                  ⚡ Analyze Entire Game
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Match Header Bar */}
              <div
                className="win98-inset"
                style={{
                  padding: "6px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  backgroundColor: "#fff",
                }}
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span>
                    Turns: <strong>{parsedTurns.length}</strong>
                  </span>
                  <span>
                    Final:{" "}
                    <strong>
                      {parsedTurns[parsedTurns.length - 1]?.myScore || 0} -{" "}
                      {parsedTurns[parsedTurns.length - 1]?.oppScore || 0}
                    </strong>
                  </span>
                  {blunderCount > 0 && (
                    <span
                      style={{
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        padding: "1px 6px",
                        borderRadius: "2px",
                        fontWeight: "bold",
                        border: "1px solid #fde68a",
                      }}
                    >
                      ⚠️ {blunderCount} Blunder{blunderCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="win98-button"
                    onClick={handleExportGcg}
                    style={{ fontSize: "11px", padding: "2px 8px" }}
                  >
                    📜 Export GCG
                  </button>
                  <button
                    className="win98-button"
                    onClick={() => {
                      setParsedTurns([]);
                      setActiveTurnIdx(null);
                    }}
                    style={{ fontSize: "11px", padding: "2px 8px" }}
                  >
                    🔄 New Match
                  </button>
                </div>
              </div>

              {/* Cumulative Point Spread & Blunder Progression SVG Graph */}
              {chartData && (
                <div
                  className="win98-inset"
                  style={{
                    padding: "6px",
                    backgroundColor: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "10px",
                      fontWeight: "bold",
                      color: "#000080",
                    }}
                  >
                    <span>📈 CUMULATIVE POINT SPREAD &amp; BLUNDER PROGRESSION</span>
                    <span style={{ fontSize: "9px", color: "#666" }}>
                      🟢 P1 Lead / 🔴 P2 Lead (Click any point or ⚠️ to scrub)
                    </span>
                  </div>

                  <svg
                    viewBox={`0 0 ${chartData.svgW} ${chartData.svgH}`}
                    style={{
                      width: "100%",
                      height: "130px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    {/* Positive Area (P1 Lead) */}
                    <polygon
                      points={chartData.posPolyPoints}
                      fill="rgba(34, 197, 94, 0.18)"
                    />
                    {/* Negative Area (P2 Lead) */}
                    <polygon
                      points={chartData.negPolyPoints}
                      fill="rgba(239, 68, 68, 0.18)"
                    />

                    {/* Top Gridline (+Max Spread) */}
                    <line
                      x1={chartData.padLeft}
                      y1={chartData.padTop}
                      x2={chartData.svgW - chartData.padRight}
                      y2={chartData.padTop}
                      stroke="#e2e8f0"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={6}
                      y={chartData.padTop + 4}
                      fontSize="9"
                      fill="#16a34a"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      +{chartData.maxSpread}
                    </text>

                    {/* Zero Axis (Tie Line) */}
                    <line
                      x1={chartData.padLeft}
                      y1={chartData.yZero}
                      x2={chartData.svgW - chartData.padRight}
                      y2={chartData.yZero}
                      stroke="#94a3b8"
                      strokeDasharray="4 3"
                      strokeWidth="1.5"
                    />
                    <text
                      x={6}
                      y={chartData.yZero + 3}
                      fontSize="9"
                      fill="#64748b"
                      fontFamily="monospace"
                    >
                      0 (TIE)
                    </text>

                    {/* Bottom Gridline (-Max Spread) */}
                    <line
                      x1={chartData.padLeft}
                      y1={chartData.svgH - chartData.padBottom}
                      x2={chartData.svgW - chartData.padRight}
                      y2={chartData.svgH - chartData.padBottom}
                      stroke="#e2e8f0"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={6}
                      y={chartData.svgH - chartData.padBottom + 4}
                      fontSize="9"
                      fill="#dc2626"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      -{chartData.maxSpread}
                    </text>

                    {/* Polyline Score Spread Trend */}
                    <polyline
                      points={chartData.polylineStr}
                      fill="none"
                      stroke="#000080"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Data Points */}
                    {chartData.points.map((p) => {
                      const isSelected = activeTurnIdx === p.idx;
                      const isLead = (p.turn.spread || 0) >= 0;
                      return (
                        <circle
                          key={p.idx}
                          cx={p.x}
                          cy={p.y}
                          r={isSelected ? 5.5 : 3.5}
                          fill={isSelected ? "#ffff00" : isLead ? "#000080" : "#b91c1c"}
                          stroke={isSelected ? "#000080" : "#ffffff"}
                          strokeWidth={isSelected ? 2 : 1}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setActiveTurnIdx(p.idx);
                            playButtonClick();
                          }}
                          onMouseEnter={() => setHoveredGraphTurn(p.turn)}
                          onMouseLeave={() => setHoveredGraphTurn(null)}
                        />
                      );
                    })}

                    {/* Blunder Warning Badges */}
                    {chartData.blunderPoints.map((p) => (
                      <g
                        key={`blunder-${p.idx}`}
                        transform={`translate(${p.x}, ${Math.max(
                          chartData.padTop + 4,
                          Math.min(chartData.svgH - chartData.padBottom - 6, p.y - 10)
                        )})`}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setActiveTurnIdx(p.idx);
                          playButtonClick();
                        }}
                      >
                        <text fontSize="12" textAnchor="middle" y="0">
                          ⚠️
                        </text>
                      </g>
                    ))}
                  </svg>

                  {/* Hover or Active Turn Info Ribbon */}
                  <div
                    style={{
                      fontSize: "10px",
                      padding: "3px 6px",
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {hoveredGraphTurn ? (
                      <span>
                        🔎 <strong>Turn #{hoveredGraphTurn.turnNum}</strong> ({hoveredGraphTurn.playerName}):{" "}
                        <strong className="font-mono">{hoveredGraphTurn.word}</strong> (+
                        {hoveredGraphTurn.score} pts) | Spread:{" "}
                        <strong
                          style={{
                            color: hoveredGraphTurn.spread >= 0 ? "#15803d" : "#b91c1c",
                          }}
                        >
                          {hoveredGraphTurn.spread >= 0 ? "+" : ""}
                          {hoveredGraphTurn.spread}
                        </strong>
                        {hoveredGraphTurn.isBlunder && (
                          <span style={{ color: "#b45309", fontWeight: "bold", marginLeft: "6px" }}>
                            ⚠️ Blunder / Big Swing (-{hoveredGraphTurn.swing} pts)
                          </span>
                        )}
                      </span>
                    ) : activeTurn ? (
                      <span>
                        📌 Selected: <strong>Turn #{activeTurn.turnNum}</strong> ({activeTurn.playerName}):{" "}
                        <strong className="font-mono">{activeTurn.word}</strong> (+
                        {activeTurn.score} pts) | Spread:{" "}
                        <strong
                          style={{
                            color: activeTurn.spread >= 0 ? "#15803d" : "#b91c1c",
                          }}
                        >
                          {activeTurn.spread >= 0 ? "+" : ""}
                          {activeTurn.spread}
                        </strong>
                      </span>
                    ) : (
                      <span style={{ color: "#777" }}>Hover over any point to preview turn delta</span>
                    )}
                  </div>
                </div>
              )}

              {/* Turn Inspector & Replay Controls */}
              {activeTurn && (
                <div
                  className="win98-sunken"
                  style={{
                    padding: "6px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#fef9c3",
                    border: "1px solid #fde047",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className="win98-button"
                      disabled={activeTurnIdx <= 0}
                      onClick={() => setActiveTurnIdx((prev) => Math.max(0, prev - 1))}
                      style={{ padding: "1px 6px", fontSize: "10px" }}
                    >
                      ◀ Prev
                    </button>
                    <span>
                      Turn <strong>#{activeTurn.turnNum}</strong>:{" "}
                      <strong>{activeTurn.playerName}</strong> played{" "}
                      <strong className="font-mono">{activeTurn.word}</strong> ({activeTurn.coord}) for{" "}
                      <strong style={{ color: "#008000" }}>+{activeTurn.score}</strong> pts
                    </span>
                    <button
                      className="win98-button"
                      disabled={activeTurnIdx >= parsedTurns.length - 1}
                      onClick={() =>
                        setActiveTurnIdx((prev) => Math.min(parsedTurns.length - 1, prev + 1))
                      }
                      style={{ padding: "1px 6px", fontSize: "10px" }}
                    >
                      Next ▶
                    </button>
                  </div>

                  <button
                    className="win98-button"
                    onClick={handleReplayActiveTurn}
                    style={{
                      fontWeight: "bold",
                      fontSize: "11px",
                      padding: "2px 10px",
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                    }}
                  >
                    🎮 Replay Position on Board
                  </button>
                </div>
              )}

              {/* Turns List */}
              <div
                className="win98-inset"
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  backgroundColor: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1px",
                  padding: "2px",
                }}
              >
                {parsedTurns.map((turn, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "3px 8px",
                      cursor: "pointer",
                      backgroundColor:
                        activeTurnIdx === i ? "#000080" : i % 2 === 0 ? "#f8fafc" : "#fff",
                      color: activeTurnIdx === i ? "#fff" : "#000",
                      fontSize: "11px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                    onClick={() => {
                      setActiveTurnIdx(i);
                      playButtonClick();
                    }}
                  >
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <strong className="font-mono">#{turn.turnNum}</strong>
                      <span
                        style={{
                          fontWeight: "bold",
                          color:
                            activeTurnIdx === i
                              ? "#fff"
                              : turn.player === "me" || turn.playerName === "Dan"
                              ? "#0000aa"
                              : "#aa0000",
                        }}
                      >
                        {turn.playerName || turn.player}
                      </span>
                      <span className="font-mono" style={{ fontWeight: "bold" }}>
                        {turn.word}
                      </span>
                      <span className="font-mono" style={{ opacity: 0.7 }}>
                        ({turn.coord})
                      </span>
                      {turn.isBlunder && (
                        <span
                          style={{
                            fontSize: "9px",
                            backgroundColor: activeTurnIdx === i ? "#b45309" : "#fef3c7",
                            color: activeTurnIdx === i ? "#fff" : "#92400e",
                            padding: "0 4px",
                            borderRadius: "2px",
                            fontWeight: "bold",
                          }}
                        >
                          ⚠️ BLUNDER
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span
                        style={{
                          fontWeight: "bold",
                          color: activeTurnIdx === i ? "#fff" : "#008000",
                        }}
                      >
                        +{turn.score}
                      </span>
                      <span className="font-mono" style={{ opacity: 0.8 }}>
                        (Spread: {turn.spread >= 0 ? "+" : ""}
                        {turn.spread})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "6px 10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--w98-bg)",
            borderTop: "1px solid var(--w98-border-light)",
          }}
        >
          <span style={{ fontSize: "10px", color: "#555" }}>
            Click any point on the graph or list to inspect turns and replay board state
          </span>
          <button className="win98-button" onClick={onClose} style={{ minWidth: "75px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
