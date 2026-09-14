import React from "react";

/**
 * StatusBar - Windows 98 status bar displaying engine calculation status,
 * active turn, and score differential.
 * Ported from the original waddleword web app.
 */
export default function StatusBar({
  isSolving,
  inputMode,
  scoreDifferential,
  stagedMoveEvaluation,
}) {
  let projectedDiff = null;
  if (
    stagedMoveEvaluation?.isValid &&
    typeof stagedMoveEvaluation.score === "number"
  ) {
    projectedDiff =
      inputMode === "me"
        ? scoreDifferential + stagedMoveEvaluation.score
        : scoreDifferential - stagedMoveEvaluation.score;
  }

  const posture = (() => {
    if (scoreDifferential <= -30) {
      return { label: "DEFICIT (Aggressive)", bg: "#c62828" };
    }
    if (scoreDifferential < 0) {
      return { label: "BEHIND (Turnover)", bg: "#e65100" };
    }
    if (scoreDifferential === 0) {
      return { label: "TIED (Equilibrium)", bg: "#2e7d32" };
    }
    if (scoreDifferential < 30) {
      return { label: "AHEAD (Defend Lead)", bg: "#1565c0" };
    }
    return { label: "COMMANDING (Lockdown)", bg: "#1b5e20" };
  })();

  return (
    <div className="win98-statusbar">
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {stagedMoveEvaluation ? (
          stagedMoveEvaluation.isValid ? (
            <span style={{ color: "#006600", fontWeight: "bold" }}>
              ✍ Staged: {stagedMoveEvaluation.word} ({stagedMoveEvaluation.posString}) +
              {stagedMoveEvaluation.score} pts
              {stagedMoveEvaluation.leave && stagedMoveEvaluation.leave !== "None" && (
                <span
                  style={{
                    marginLeft: "6px",
                    padding: "1px 4px",
                    backgroundColor: "#e8f5e9",
                    border: "1px solid #a5d6a7",
                    borderRadius: "2px",
                    color: "#1b5e20",
                    fontWeight: "normal",
                    fontSize: "10px",
                  }}
                  title={`Post-Placement Leave: ${stagedMoveEvaluation.leave} (${stagedMoveEvaluation.vcRatio})`}
                >
                  Leave: {stagedMoveEvaluation.leave} ({stagedMoveEvaluation.vcRatio})
                </span>
              )}
              <span
                style={{
                  fontWeight: "normal",
                  color: "#444",
                  marginLeft: "6px",
                }}
              >
                [Main: {stagedMoveEvaluation.mainScore}
                {stagedMoveEvaluation.crossWords?.length > 0 &&
                  ` + ${stagedMoveEvaluation.crossWords.length} Cross (${stagedMoveEvaluation.crossScore})`}
                {stagedMoveEvaluation.isBingo &&
                  ` + Bingo (${stagedMoveEvaluation.bingoBonus})`}
                ]
              </span>
            </span>
          ) : (
            <span style={{ color: "#cc0000", fontWeight: "bold" }}>
              ⚠ Staged: {stagedMoveEvaluation.reason}
            </span>
          )
        ) : (
          <span>
            {isSolving
              ? "⏳ Solving (Rust Engine)..."
              : "✔ Rust Engine Ready (1.5M moves/s)"}
          </span>
        )}
      </div>
      <div>
        Turn: {inputMode === "me" ? "Player (Alt+O)" : "Opponent (Alt+O)"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span>
          Diff:{" "}
          <b>{scoreDifferential > 0 ? `+${scoreDifferential}` : scoreDifferential}</b>
          {projectedDiff !== null && (
            <span
              style={{
                color:
                  projectedDiff >= scoreDifferential ? "#006600" : "#cc0000",
                fontWeight: "bold",
              }}
            >
              {" "}
              ➔ {projectedDiff > 0 ? `+${projectedDiff}` : projectedDiff}
            </span>
          )}
        </span>
        <span
          style={{
            fontSize: "9px",
            fontWeight: "bold",
            color: "#ffffff",
            backgroundColor: posture.bg,
            padding: "1px 4px",
            borderRadius: "2px",
            letterSpacing: "0.5px",
          }}
          title={`Strategic Context: ${posture.label}`}
        >
          {posture.label}
        </span>
      </div>
      <div
        style={{
          padding: "0 2px",
          color: "var(--w98-border-dark)",
          letterSpacing: "1px",
        }}
      >
        {"///"}
      </div>
    </div>
  );
}
