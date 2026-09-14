// src/components/BlunderShieldModal.jsx - Windows 98 Tactical Blunder Shield Dialog

import React, { useState } from "react";
import { playButtonClick, playTileClack } from "../lib/soundEffects";

export default function BlunderShieldModal({
  isOpen,
  hazard,
  onClose,
  onDisableShield,
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen || !hazard) return null;

  const handleConfirm = () => {
    playButtonClick();
    if (dontShowAgain && onDisableShield) {
      onDisableShield();
    }
    if (hazard.onConfirm) {
      hazard.onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    playTileClack();
    if (dontShowAgain && onDisableShield) {
      onDisableShield();
    }
    onClose();
  };

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
        zIndex: 9999999,
      }}
    >
      <div
        className="win98-window"
        style={{
          width: "440px",
          maxWidth: "92vw",
          boxShadow: "4px 4px 0px #000",
        }}
      >
        <div
          className="win98-titlebar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#800000",
          }}
        >
          <span style={{ fontWeight: "bold" }}>
            ⚠️ Tactical Warning: High Risk Play
          </span>
          <button className="win98-button win98-btn-sys" onClick={handleCancel}>
            ✕
          </button>
        </div>

        <div
          style={{
            padding: "16px",
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
            backgroundColor: "var(--w98-bg)",
          }}
        >
          <div
            style={{
              fontSize: "36px",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            ⚠️
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                fontWeight: "bold",
                fontSize: "12px",
                color: "#990000",
              }}
            >
              {hazard.title || "Tactical Hazard Detected"}
            </div>

            <div style={{ fontSize: "11px", color: "#111", lineHeight: 1.4 }}>
              {hazard.message}
            </div>

            {hazard.detail && (
              <div
                className="win98-inset font-mono"
                style={{
                  padding: "6px 8px",
                  fontSize: "10px",
                  backgroundColor: "#fff",
                  color: "#333",
                  lineHeight: 1.3,
                }}
              >
                {hazard.detail}
              </div>
            )}

            <label
              style={{
                marginTop: "6px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              Disable Blunder Shield for this session
            </label>
          </div>
        </div>

        <div
          style={{
            padding: "8px 14px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            backgroundColor: "var(--w98-bg)",
            borderTop: "1px solid var(--w98-border-light)",
          }}
        >
          <button
            className="win98-button"
            onClick={handleConfirm}
            style={{
              fontWeight: "bold",
              color: "#990000",
              minWidth: "110px",
              padding: "4px 12px",
            }}
          >
            Commit Anyway
          </button>
          <button
            className="win98-button"
            onClick={handleCancel}
            style={{
              fontWeight: "bold",
              minWidth: "100px",
              padding: "4px 12px",
            }}
          >
            Cancel Move
          </button>
        </div>
      </div>
    </div>
  );
}
