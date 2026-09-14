// src/components/TournamentClock.jsx
// Phase 4: Authentic Win98 Dual LED Tournament Chess Clock with Overtime Penalty Tracking

import React, { useState, useEffect, useRef } from "react";
import { playButtonClick, playWin98Chord, playChime } from "../lib/soundEffects";

const PRESETS = [
  { label: "25 min (NASPA / WESPA Standard)", seconds: 25 * 60 },
  { label: "20 min (Rapid Tournament)", seconds: 20 * 60 },
  { label: "15 min (Club Rapid)", seconds: 15 * 60 },
  { label: "5 min (Blitz)", seconds: 5 * 60 },
];

function formatTime(totalSeconds) {
  const isNegative = totalSeconds < 0;
  const abs = Math.abs(totalSeconds);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const str = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return isNegative ? `-${str}` : str;
}

function calculateOvertimePenalty(totalSeconds) {
  if (totalSeconds >= 0) return 0;
  // NASPA / WESPA rule: -10 points per minute or fraction thereof
  const overdueSeconds = Math.abs(totalSeconds);
  const minutesOver = Math.ceil(overdueSeconds / 60);
  return minutesOver * 10;
}

export default function TournamentClock({
  inputMode = "me", // 'me' | 'opp'
  isVisible = true,
  onToggleVisible,
}) {
  const [selectedDuration, setSelectedDuration] = useState(25 * 60);
  const [p1Seconds, setP1Seconds] = useState(25 * 60);
  const [p2Seconds, setP2Seconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isColonVisible, setIsColonVisible] = useState(true);

  // Interval timer
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setIsColonVisible((v) => !v);
      if (inputMode === "me") {
        setP1Seconds((prev) => prev - 1);
      } else {
        setP2Seconds((prev) => prev - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, inputMode]);

  const handleToggleRunning = () => {
    playButtonClick();
    setIsRunning((prev) => !prev);
  };

  const handleReset = (duration = selectedDuration) => {
    playButtonClick();
    setIsRunning(false);
    setP1Seconds(duration);
    setP2Seconds(duration);
  };

  const handlePresetSelect = (duration) => {
    setSelectedDuration(duration);
    handleReset(duration);
  };

  if (!isVisible) return null;

  const p1Penalty = calculateOvertimePenalty(p1Seconds);
  const p2Penalty = calculateOvertimePenalty(p2Seconds);

  return (
    <div
      className="win98-fieldset"
      style={{
        margin: 0,
        padding: "4px 8px",
        background: "var(--w98-surface, #c0c0c0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      {/* Legend / Title */}
      <legend style={{ fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
        <span>⏱️ Tournament Chess Clock</span>
        {onToggleVisible && (
          <button
            className="win98-button win98-btn-sys"
            style={{ marginLeft: "4px", fontSize: "8px", width: "14px", height: "12px", padding: 0 }}
            onClick={onToggleVisible}
            title="Hide Clock"
          >
            ✕
          </button>
        )}
      </legend>

      {/* Dual LED Panels */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {/* Player 1 (Me) Clock */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "2px 6px",
            background: inputMode === "me" && isRunning ? "#e8f0fe" : "transparent",
            border: inputMode === "me" ? "1px solid #000080" : "1px solid transparent",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: "bold", color: inputMode === "me" ? "#000080" : "#555", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>{inputMode === "me" && isRunning ? "🟢" : "👤"} Player 1 (Me)</span>
            {p1Penalty > 0 && (
              <span style={{ color: "#cc0000", fontSize: "9px" }}>(-{p1Penalty} OT)</span>
            )}
          </div>
          <div
            className="win98-inset"
            style={{
              background: "#080c08",
              padding: "2px 8px",
              fontFamily: "'Courier New', Courier, monospace",
              fontWeight: "bold",
              fontSize: "18px",
              letterSpacing: "1px",
              color: p1Seconds < 0 ? "#ff3333" : p1Seconds <= 120 ? "#ffcc00" : "#33ff33",
              textShadow: p1Seconds < 0 ? "0 0 6px rgba(255,50,50,0.8)" : "0 0 6px rgba(50,255,50,0.8)",
              minWidth: "82px",
              textAlign: "center",
              marginTop: "2px",
            }}
          >
            {formatTime(p1Seconds)}
          </div>
        </div>

        {/* Player 2 (Opponent) Clock */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "2px 6px",
            background: inputMode === "opp" && isRunning ? "#fde8e8" : "transparent",
            border: inputMode === "opp" ? "1px solid #b71c1c" : "1px solid transparent",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: "bold", color: inputMode === "opp" ? "#b71c1c" : "#555", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>{inputMode === "opp" && isRunning ? "🔴" : "👿"} Opponent</span>
            {p2Penalty > 0 && (
              <span style={{ color: "#cc0000", fontSize: "9px" }}>(-{p2Penalty} OT)</span>
            )}
          </div>
          <div
            className="win98-inset"
            style={{
              background: "#080c08",
              padding: "2px 8px",
              fontFamily: "'Courier New', Courier, monospace",
              fontWeight: "bold",
              fontSize: "18px",
              letterSpacing: "1px",
              color: p2Seconds < 0 ? "#ff3333" : p2Seconds <= 120 ? "#ffcc00" : "#33ff33",
              textShadow: p2Seconds < 0 ? "0 0 6px rgba(255,50,50,0.8)" : "0 0 6px rgba(50,255,50,0.8)",
              minWidth: "82px",
              textAlign: "center",
              marginTop: "2px",
            }}
          >
            {formatTime(p2Seconds)}
          </div>
        </div>
      </div>

      {/* Clock Controls & Presets */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <button
          className="win98-button"
          style={{
            fontWeight: "bold",
            padding: "3px 10px",
            color: isRunning ? "#cc0000" : "#006600",
            minWidth: "68px",
          }}
          onClick={handleToggleRunning}
        >
          {isRunning ? "⏸ Pause" : "▶ Start"}
        </button>

        <button
          className="win98-button"
          style={{ padding: "3px 8px" }}
          onClick={() => handleReset()}
          title="Reset timer to selected preset"
        >
          🔄 Reset
        </button>

        <select
          className="win98-input"
          style={{ width: "135px", cursor: "pointer", padding: "2px 4px", fontSize: "10px" }}
          value={selectedDuration}
          onChange={(e) => handlePresetSelect(Number(e.target.value))}
        >
          {PRESETS.map((p) => (
            <option key={p.seconds} value={p.seconds}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
