// src/components/UnseenTileTracker.jsx
// Phase 4: Available Tiles Grid with Bayesian Opponent Rack Likelihood Modeling

import React, { useState, useMemo, useEffect } from "react";
import { getBayesianRackInference } from "../tauriBridge";
import { playButtonClick } from "../lib/soundEffects";

const DEFAULT_DISTRIBUTION = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4,
  M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1,
  Y: 2, Z: 1, "?": 2,
};

const DEFAULT_SCORES = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1,
  m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8,
  y: 4, z: 10,
};

export default function UnseenTileTracker({
  board,
  rack,
  activePreset,
  enableIntel,
  intelMode,
  manualAvailableTiles,
  lastOppContext = null,
}) {
  const distribution = activePreset?.distribution || DEFAULT_DISTRIBUTION;
  const scores = activePreset?.scores || DEFAULT_SCORES;

  const unseen = useMemo(() => {
    let counts = {};
    let total = 0;

    Object.keys(distribution).forEach((k) => (counts[k] = 0));

    if (enableIntel && intelMode === "manual" && manualAvailableTiles?.trim()) {
      const pool = manualAvailableTiles.toUpperCase().replace(/[^A-Z?]/g, "");
      for (let i = 0; i < pool.length; i++) {
        const ch = pool[i];
        counts[ch] = (counts[ch] || 0) + 1;
        total++;
      }
    } else {
      counts = { ...distribution };
      for (const k in counts) total += counts[k];

      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          const val = board[r]?.[c];
          if (val) {
            const isBlank = val >= "a" && val <= "z";
            const keyToDeduct = isBlank ? "?" : val.toUpperCase();
            if (counts[keyToDeduct] !== undefined && counts[keyToDeduct] > 0) {
              counts[keyToDeduct]--;
              total--;
            }
          }
        }
      }

      const rackChars = (rack || "").toUpperCase().split("");
      for (const ch of rackChars) {
        const mapped = ["?", ".", "0", "*", "_"].includes(ch) ? "?" : ch;
        if (counts[mapped] !== undefined && counts[mapped] > 0) {
          counts[mapped]--;
          total--;
        }
      }
    }

    return { counts, total };
  }, [board, rack, distribution, enableIntel, intelMode, manualAvailableTiles]);

  const [hideEmpty, setHideEmpty] = useState(false);
  const [showBayesian, setShowBayesian] = useState(true);
  const [bayesianMap, setBayesianMap] = useState({});
  const [hoveredTileInfo, setHoveredTileInfo] = useState(null);

  // Compute Bayesian Opponent Rack Inference whenever unseen counts or opponent context change
  useEffect(() => {
    if (!showBayesian) return;

    let poolStr = "";
    Object.entries(unseen.counts).forEach(([ch, count]) => {
      if (count > 0) poolStr += ch.repeat(count);
    });

    let isMounted = true;
    getBayesianRackInference({
      lastWord: lastOppContext?.word || null,
      lastScore: lastOppContext?.score != null ? lastOppContext.score : null,
      hadOpen3w: Boolean(lastOppContext?.had_open_3w),
      hadOpenBingo: Boolean(lastOppContext?.had_open_bingo_lane),
      unseenTiles: poolStr,
    }).then((breakdown) => {
      if (!isMounted || !breakdown) return;
      const map = {};
      breakdown.forEach((item) => {
        map[item.letter] = item;
      });
      setBayesianMap(map);
    });

    return () => {
      isMounted = false;
    };
  }, [showBayesian, unseen, lastOppContext]);

  return (
    <div className="unseen-pane">
      <div className="unseen-header">
        <span>Available Tiles (Bag + Opponent)</span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px" }}>
            <input
              type="checkbox"
              checked={showBayesian}
              onChange={(e) => {
                playButtonClick();
                setShowBayesian(e.target.checked);
              }}
            />{" "}
            🧠 Bayesian Inference
          </label>
          <label style={{ fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px" }}>
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
            />{" "}
            Hide Empty
          </label>
          <span style={{ color: "#000080", fontWeight: "bold" }}>Total: {unseen.total}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="unseen-grid">
        {Object.entries(unseen.counts).map(([ch, count]) => {
          const isZero = count === 0;
          if (hideEmpty && isZero) return null;

          const bayes = bayesianMap[ch];
          const isDiscounted = showBayesian && bayes?.category === "discounted" && !isZero;
          const isElevated = showBayesian && bayes?.category === "elevated" && !isZero;

          return (
            <div
              key={ch}
              className={`unseen-item ${isZero ? "empty" : ""}`}
              onMouseEnter={() => setHoveredTileInfo(bayes || { letter: ch, count, category: "neutral", explanation: "Standard distribution prior." })}
              onMouseLeave={() => setHoveredTileInfo(null)}
              style={{
                position: "relative",
                backgroundColor: isElevated ? "#fff0f0" : isDiscounted ? "#f0fff0" : undefined,
                borderColor: isElevated ? "#cc0000" : isDiscounted ? "#008800" : undefined,
                boxShadow: isElevated
                  ? "inset 0 0 0 1px #ff8888"
                  : isDiscounted
                  ? "inset 0 0 0 1px #88cc88"
                  : undefined,
              }}
              title={bayes ? `${ch}: ${bayes.explanation}` : `${ch} (${count} remaining)`}
            >
              {/* Likelihood Indicator Dot */}
              {showBayesian && !isZero && (
                <div
                  style={{
                    position: "absolute",
                    top: "1px",
                    left: "2px",
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    backgroundColor: isElevated ? "#cc0000" : isDiscounted ? "#00aa00" : "#888888",
                  }}
                />
              )}

              <div
                className="scrabble-tile-mini"
                style={{
                  width: "20px",
                  height: "22px",
                  fontSize: "11px",
                  boxShadow: "1px 1px 1px rgba(0,0,0,0.4)",
                  backgroundColor: isElevated ? "#ffe4e4" : undefined,
                }}
              >
                <span>{ch === "?" ? "" : ch}</span>
                {ch !== "?" && (
                  <sub
                    className="tile-score-sub"
                    style={{ fontSize: "7px", bottom: "0px", right: "1px" }}
                  >
                    {scores?.[ch.toLowerCase()] ?? 0}
                  </sub>
                )}
              </div>
              <span className="unseen-count">x{count}</span>
            </div>
          );
        })}
      </div>

      {/* Bayesian Tactical Explanatory Banner */}
      {showBayesian && (
        <div
          style={{
            marginTop: "6px",
            padding: "3px 6px",
            background: "#ffffe1",
            border: "1px inset #d4d0c8",
            fontSize: "10px",
            color: "#333",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: "22px",
          }}
        >
          {hoveredTileInfo ? (
            <div>
              <strong style={{ color: hoveredTileInfo.category === "elevated" ? "#cc0000" : hoveredTileInfo.category === "discounted" ? "#008800" : "#000" }}>
                {hoveredTileInfo.letter === "?" ? "Blank (?)" : hoveredTileInfo.letter}:{" "}
                {hoveredTileInfo.category.toUpperCase()} ({Math.round((hoveredTileInfo.likelihood_multiplier || 1.0) * 100)}%)
              </strong>{" "}
              — {hoveredTileInfo.explanation}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>Opponent Hand Likelihood:</span>
              <span style={{ color: "#cc0000", fontWeight: "bold" }}>🔴 Elevated (clunkers)</span>
              <span style={{ color: "#008800", fontWeight: "bold" }}>🟢 Discounted (missed opportunities)</span>
              <span style={{ color: "#666" }}>Hover any tile for Bayesian breakdown</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
