// src/components/EndgameExplorer.jsx - Interactive 4-Ply Terminal Endgame Explorer

import React from "react";

export default function EndgameExplorer({ endgamePlay }) {
  if (!endgamePlay) return null;

  const pv = endgamePlay.opp_best_reply ? endgamePlay.opp_best_reply.split(" -> ") : [];
  const margin = Math.round(endgamePlay.total_val);

  return (
    <div className="endgame-card">
      <div className="endgame-header">
        <span className="endgame-icon">🏁</span>
        <div>
          <h3 className="endgame-title">Terminal Endgame Solver</h3>
          <p className="endgame-sub">
            Bag Empty (100% Deterministic Minimax Solution)
          </p>
        </div>
        <span
          className={`endgame-margin-badge ${
            margin >= 0 ? "margin-positive" : "margin-negative"
          }`}
        >
          {margin >= 0 ? `+${margin}` : margin} pt Net Margin
        </span>
      </div>

      <div className="pv-timeline">
        <h4 className="pv-heading">Optimal Game-Ending Move Sequence:</h4>
        <div className="pv-steps">
          <div className="pv-step player-step">
            <span className="step-badge">1. You</span>
            <span className="step-content font-mono font-bold">
              {endgamePlay.word} ({endgamePlay.score} pts)
            </span>
          </div>

          {pv.map((step, idx) => (
            <div
              key={idx}
              className={`pv-step ${
                idx % 2 === 0 ? "opp-step" : "player-step"
              }`}
            >
              <span className="step-badge">
                {idx % 2 === 0 ? "2. Opponent" : "3. You"}
              </span>
              <span className="step-content font-mono">{step}</span>
            </div>
          ))}
        </div>

        <p className="endgame-explainer">
          💡 The engine guarantees this line maximizes your spread and accounts for
          the final double-tile penalty catch.
        </p>
      </div>
    </div>
  );
}
