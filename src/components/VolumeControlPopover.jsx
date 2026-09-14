// src/components/VolumeControlPopover.jsx - Authentic Windows 98 Sound & Volume Popover
// Supports volume slider, mute toggle, and soundpack selection (Win98, Wood, Silent).

import React, { useState, useEffect, useRef } from "react";
import {
  getSoundVolume,
  setSoundVolume,
  isSoundMuted,
  setSoundMuted,
  getSoundpack,
  setSoundpack,
  playTileClack,
  playBingoChime,
} from "../lib/soundEffects";

export default function VolumeControlPopover({ isOpen, onClose, anchorRef }) {
  const [volume, setVolume] = useState(() => Math.round(getSoundVolume() * 100));
  const [muted, setMuted] = useState(() => isSoundMuted());
  const [soundpack, setPack] = useState(() => getSoundpack());
  const popoverRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        !anchorRef?.current?.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    setSoundVolume(val / 100);
  };

  const handleToggleMute = (e) => {
    const isNowMuted = e.target.checked;
    setMuted(isNowMuted);
    setSoundMuted(isNowMuted);
  };

  const handleSoundpackChange = (pack) => {
    setPack(pack);
    setSoundpack(pack);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="win98-window"
      style={{
        position: "absolute",
        top: "42px",
        right: "12px",
        width: "240px",
        zIndex: 99999,
        boxShadow: "3px 3px 10px rgba(0, 0, 0, 0.5)",
        padding: "6px",
      }}
    >
      {/* Title bar */}
      <div
        className="win98-titlebar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "2px 4px",
          marginBottom: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>🔊</span>
          <span style={{ fontSize: "11px", fontWeight: "bold" }}>Sound Options</span>
        </div>
        <button
          className="win98-button win98-btn-sys"
          style={{ width: "16px", height: "14px", fontSize: "9px", padding: 0 }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Volume slider well */}
      <div
        className="win98-sunken"
        style={{
          padding: "8px",
          background: "#fff",
          marginBottom: "6px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
          <span style={{ fontWeight: "bold" }}>Master Volume:</span>
          <span>{muted ? "Muted" : `${volume}%`}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          disabled={muted}
          onChange={handleVolumeChange}
          style={{ width: "100%", cursor: muted ? "not-allowed" : "pointer" }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={muted}
            onChange={handleToggleMute}
            style={{ cursor: "pointer" }}
          />
          <span>Mute all sounds</span>
        </label>
      </div>

      {/* Soundpack selection well */}
      <div
        className="win98-sunken"
        style={{
          padding: "8px",
          background: "#f0f0f0",
          marginBottom: "6px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: "bold" }}>Soundpack Profile:</span>

        {[
          { id: "win98", label: "💾 Vintage Win98 (Synthesized)" },
          { id: "wood", label: "🪵 Physical Wood (Acoustic)" },
          { id: "silent", label: "🤫 Silent Mode (Visual Only)" },
        ].map((item) => (
          <label
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="soundpack"
              checked={soundpack === item.id}
              onChange={() => handleSoundpackChange(item.id)}
              style={{ cursor: "pointer" }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      {/* Test Buttons */}
      <div style={{ display: "flex", gap: "4px", justifyContent: "space-between" }}>
        <button
          className="win98-button"
          style={{ fontSize: "10px", padding: "2px 6px" }}
          onClick={() => playTileClack()}
          disabled={muted || soundpack === "silent"}
          title="Play Tile Clack sound"
        >
          ▶ Clack
        </button>
        <button
          className="win98-button"
          style={{ fontSize: "10px", padding: "2px 6px" }}
          onClick={() => playBingoChime()}
          disabled={muted || soundpack === "silent"}
          title="Play Bingo Chime"
        >
          ▶ Chime
        </button>
        <button
          className="win98-button"
          style={{ fontSize: "10px", padding: "2px 8px", fontWeight: "bold" }}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
