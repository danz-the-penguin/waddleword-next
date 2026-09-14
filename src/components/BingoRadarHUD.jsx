// src/components/BingoRadarHUD.jsx - Live Bingo Probability & Runway Radar

import React from "react";

export default function BingoRadarHUD({ topPlay, runwayScore = 0 }) {
  const prob = topPlay ? Math.round(topPlay.bingo_prob_next_turn || 0) : 0;
  const isBingo = topPlay?.is_bingo;

  let tierColor = "#64748b"; // Slate
  let tierLabel = "Low Probability";

  if (isBingo) {
    tierColor = "#ec4899"; // Pink
    tierLabel = "Bingo On Board!";
  } else if (prob >= 70) {
    tierColor = "#10b981"; // Vibrant Emerald
    tierLabel = "Bingo Imminent!";
  } else if (prob >= 45) {
    tierColor = "#3b82f6"; // Blue
    tierLabel = "Strong Stem Retention";
  } else if (prob >= 20) {
    tierColor = "#f59e0b"; // Amber
    tierLabel = "Developing Stem";
  }

  return (
    <div className="bingo-radar-card">
      <div className="radar-header">
        <span className="radar-icon">🎯</span>
        <h3 className="radar-title">Live Bingo Radar</h3>
        <span className="radar-badge" style={{ backgroundColor: tierColor }}>
          {tierLabel}
        </span>
      </div>

      <div className="radar-body">
        <div className="prob-meter-container">
          <div className="prob-value-wrapper">
            <span className="prob-number" style={{ color: tierColor }}>
              {isBingo ? "100" : prob}%
            </span>
            <span className="prob-subtext">Next Turn Bingo Draw</span>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${isBingo ? 100 : prob}%`,
                backgroundColor: tierColor,
              }}
            />
          </div>
        </div>

        <div className="radar-stats-grid">
          <div className="radar-stat-item">
            <span className="stat-label">Runway Fertility</span>
            <span className="stat-val font-mono">
              {topPlay?.bingo_runway_score || runwayScore} pts
            </span>
            <span className="stat-hint">
              {runwayScore > 20 ? "Open Lanes" : "Cramped"}
            </span>
          </div>

          <div className="radar-stat-item">
            <span className="stat-label">Leave Retained</span>
            <span className="stat-val font-mono">
              {topPlay?.leave ? topPlay.leave : "(Out / All Tiles)"}
            </span>
            <span className="stat-hint">
              Equity: {topPlay?.leave_equity > 0 ? `+${topPlay.leave_equity}` : topPlay?.leave_equity || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
