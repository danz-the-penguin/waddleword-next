// src/components/MoveList.jsx - Candidate Plays List with Keyboard Navigation & Score Gap Context
import React from "react";
import ResultCard from "./ResultCard";

function getScoreGapAdvice(scoreDifferential) {
  if (scoreDifferential <= -30) {
    return {
      title: `🚨 Deficit Alert (-${Math.abs(scoreDifferential)} pts)`,
      advice: "Aggressive Stance: Prioritize high-scoring bingos, open board corridors, and maximize tile turnover.",
      bg: "#ffebee",
      border: "#c62828",
      color: "#b71c1c",
    };
  }
  if (scoreDifferential < 0) {
    return {
      title: `⚠️ Behind (-${Math.abs(scoreDifferential)} pts)`,
      advice: "Active Chase: Target high-value premium squares while preserving blanks to fuel turnaround bingos.",
      bg: "#fff3e0",
      border: "#e65100",
      color: "#bf360c",
    };
  }
  if (scoreDifferential === 0) {
    return {
      title: "⚖️ Tied Match (0 pts)",
      advice: "Equilibrium: Balance immediate points against leave equity; keep premium corridors contestable.",
      bg: "#e8f5e9",
      border: "#2e7d32",
      color: "#1b5e20",
    };
  }
  if (scoreDifferential < 30) {
    return {
      title: `🛡️ Lead Defense (+${scoreDifferential} pts)`,
      advice: "Consolidate Lead: Block opponent 9X / 4X setups and restrict easy open triple-word replies.",
      bg: "#e3f2fd",
      border: "#1565c0",
      color: "#0d47a1",
    };
  }
  return {
    title: `🏆 Commanding Lead (+${scoreDifferential} pts)`,
    advice: "Defensive Lockdown: Crimp the board, close open vowel corridors, and minimize high-turnover volatility.",
    bg: "#e8f5e9",
    border: "#1b5e20",
    color: "#004d40",
  };
}

export default function MoveList({
  plays = [],
  onHoverPlay,
  onApplyPlay,
  sortMode,
  onSortModeChange,
  rack,
  activeLexicon,
  activePreset,
  highlightedPlayIndex = -1,
  onSelectPlayIndex,
  scoreDifferential = 0,
  simQuality = "standard",
  isSolving = false,
  onRunDeepRollout,
  autoDeepOnSettle = false,
  onSetAutoDeepOnSettle,
}) {
  if (plays.length === 0) {
    return (
      <div className="move-list-empty">
        <p>No valid plays found for this rack & board state.</p>
      </div>
    );
  }

  const advice = getScoreGapAdvice(scoreDifferential);

  // Strategic Tile Exchange Detection (Phase 7)
  const exchangePlay = plays.find(
    (p) => p.is_exchange || (p.word && p.word.startsWith("EXCH "))
  );
  const topBoardPlay = plays.find(
    (p) => !p.is_exchange && (!p.word || !p.word.startsWith("EXCH "))
  );
  const isExchangeRecommended =
    exchangePlay &&
    (!topBoardPlay || exchangePlay.total_val >= topBoardPlay.total_val - 2.0);

  const handleContainerKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = highlightedPlayIndex < 0 ? 0 : Math.min(plays.length - 1, highlightedPlayIndex + 1);
      onSelectPlayIndex?.(nextIdx);
      if (plays[nextIdx]) onHoverPlay?.(plays[nextIdx]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx = highlightedPlayIndex <= 0 ? 0 : highlightedPlayIndex - 1;
      onSelectPlayIndex?.(prevIdx);
      if (plays[prevIdx]) onHoverPlay?.(plays[prevIdx]);
    } else if (e.key === "Enter") {
      if (highlightedPlayIndex >= 0 && plays[highlightedPlayIndex]) {
        e.preventDefault();
        onApplyPlay?.(plays[highlightedPlayIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onSelectPlayIndex?.(-1);
      onHoverPlay?.(null);
    }
  };

  return (
    <div
      className="move-list-container"
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      style={{ outline: "none" }}
    >
      <div className="move-list-header">
        <div className="move-list-title-group" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <h3 className="move-list-title">Candidate Plays</h3>
          <span className="count-tag font-mono">{plays.length} Found</span>
          {simQuality === "championship" && (
            <span
              style={{
                fontSize: "9px",
                padding: "1px 5px",
                backgroundColor: "#4a148c",
                color: "#ffffff",
                border: "1px solid #7b1fa2",
                borderRadius: "2px",
                fontWeight: "bold",
              }}
              title="Championship M1 2-Ply Monte Carlo Rollout Playout Engine active (300 samples)"
            >
              👑 CHAMPIONSHIP M1
            </span>
          )}
          {simQuality === "championship" && onRunDeepRollout && (
            <button
              className="win98-btn"
              onClick={onRunDeepRollout}
              disabled={isSolving}
              style={{
                fontSize: "9px",
                padding: "1px 6px",
                cursor: isSolving ? "wait" : "pointer",
                fontWeight: "bold",
                backgroundColor: isSolving ? "#e0e0e0" : "#d4d0c8",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
              title="Execute full 15,000 Monte Carlo game rollouts (25 candidates x 300 samples x 2 plies)"
            >
              {isSolving ? "⏳ Solving..." : "👑 Playout (15k)"}
            </button>
          )}
          {simQuality === "championship" && onSetAutoDeepOnSettle && (
            <label
              style={{
                fontSize: "9px",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                cursor: "pointer",
                color: "#222",
                fontWeight: "normal",
                userSelect: "none",
              }}
              title="Automatically calculate 15,000 Championship M1 rollouts when typing pauses for 1s"
            >
              <input
                type="checkbox"
                checked={autoDeepOnSettle}
                onChange={(e) => onSetAutoDeepOnSettle(e.target.checked)}
                style={{ margin: 0, cursor: "pointer" }}
              />
              Auto 15k
            </label>
          )}
        </div>

        <div className="sort-toggle-group">
          <button
            className={`sort-btn ${sortMode === "strategic" ? "active" : ""}`}
            onClick={() => onSortModeChange("strategic")}
          >
            Strategic Value (EQ)
          </button>
          <button
            className={`sort-btn ${sortMode === "score" ? "active" : ""}`}
            onClick={() => onSortModeChange("score")}
          >
            Highest Score
          </button>
        </div>
      </div>

      {/* Score Gap Context Banner */}
      <div
        className="score-gap-banner"
        style={{
          backgroundColor: advice.bg,
          borderColor: advice.border,
          color: advice.color,
        }}
      >
        <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "2px" }}>
          {advice.title}
        </div>
        <div style={{ fontSize: "10px", lineHeight: "1.3" }}>
          {advice.advice}
        </div>
      </div>

      {/* Strategic Tile Exchange Recommendation Banner (Phase 7) */}
      {isExchangeRecommended && (
        <div
          className="win98-window"
          style={{
            margin: "0 0 6px 0",
            padding: "5px 8px",
            backgroundColor: "#f4f0ff",
            border: "2px solid #7b1fa2",
            boxShadow: "inset 1px 1px 0 #fff, inset -1px -1px 0 #4a148c",
            cursor: "pointer",
          }}
          onClick={() => onApplyPlay(exchangePlay)}
          title="Click to execute this strategic tile exchange"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ fontWeight: "bold", color: "#4a148c", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
              🔄 STRATEGIC EXCHANGE RECOMMENDED
            </span>
            <span style={{ fontSize: "10px", fontWeight: "bold", color: "#1b5e20", backgroundColor: "#e8f5e9", padding: "1px 5px", border: "1px solid #81c784", borderRadius: "2px" }}>
              +{exchangePlay.total_val} Net Eq
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#222" }}>
            Swap: <strong style={{ color: "#7b1fa2" }}>{exchangePlay.word.replace(/^EXCH\s*/i, "")}</strong> &bull; Retain: <strong>{exchangePlay.leave}</strong> ({exchangePlay.vc_ratio || exchangePlay.vcRatio})
          </div>
          <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
            {exchangePlay.rack_balance_desc || "Purges clunkers and preserves bingo stem for next turn."}
            {topBoardPlay && exchangePlay.total_val > topBoardPlay.total_val && (
              <span style={{ color: "#2e7d32", fontWeight: "bold", marginLeft: "4px" }}>
                (+{(exchangePlay.total_val - topBoardPlay.total_val).toFixed(1)} pts superior to {topBoardPlay.word})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Keyboard Navigation Quick Hint */}
      <div className="move-list-hint font-mono">
        <span>⌨️ <b>↑ / ↓</b>: Cycle &bull; <b>Enter</b>: Play &bull; <b>Esc</b>: Clear</span>
        <span style={{ color: "#000080", fontWeight: "bold" }}>
          {highlightedPlayIndex >= 0 ? `Move #${highlightedPlayIndex + 1}` : "Click/Focus"}
        </span>
      </div>

      <div className="plays-scrollable">
        {plays.slice(0, 30).map((play, idx) => (
          <ResultCard
            key={`${play.word}-${play.row}-${play.col}-${idx}`}
            play={play}
            rank={idx}
            onHover={(p) => {
              onHoverPlay(p);
              onSelectPlayIndex?.(idx);
            }}
            onLeave={() => {
              // Only clear if not selected by keyboard
              if (highlightedPlayIndex === -1) onHoverPlay(null);
            }}
            onClick={onApplyPlay}
            rack={rack}
            activeLexicon={activeLexicon}
            activePreset={activePreset}
            isSelected={highlightedPlayIndex === idx}
          />
        ))}
      </div>
    </div>
  );
}
