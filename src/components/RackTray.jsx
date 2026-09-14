import React, { useState, useEffect } from "react";
import { playTileClack, playChime } from "../lib/soundEffects";
import { evaluateTileExchange, findBestExchange } from "../tauriBridge";
import { setDragData, getDragData, clearActiveDragPayload } from "../lib/dragDropManager";

const DEFAULT_SCORES = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1,
  m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8,
  y: 4, z: 10,
};

/**
 * RackTray - Interactive wooden tile rack with Drag & Drop anagram reordering,
 * board-to-rack returns, turn-gated manipulation, and strategic Tile Exchange simulation.
 */
export default function RackTray({
  rack,
  onRackChange,
  onShuffle,
  scores,
  inputMode = "me",
  isBoardLocked = false,
  onDropTileFromBoard,
  onDropTileOnBoard,
  onRackTileClick,
  selectedRackTileIdx = null,
  candidatePlays = [],
  bagCount = null,
  equityMode = "trained",
  onConfirmExchange,
  onOpenAnagramExplorer,
}) {
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [isTrayOver, setIsTrayOver] = useState(false);
  const [isExchangeMode, setIsExchangeMode] = useState(false);
  const [selectedExchangeIndices, setSelectedExchangeIndices] = useState([]);
  const [exchangeAnalysis, setExchangeAnalysis] = useState(null);
  const [isEvaluatingExchange, setIsEvaluatingExchange] = useState(false);
  const [pointerDragState, setPointerDragState] = useState(null);

  const tileScores = scores || DEFAULT_SCORES;
  const canDrag = inputMode === "me" && !isExchangeMode;

  // Best candidate board play for comparative advice
  const bestPlay = candidatePlays && candidatePlays.length > 0 ? candidatePlays[0] : null;

  // Re-evaluate exchange when selection changes
  useEffect(() => {
    if (!isExchangeMode || selectedExchangeIndices.length === 0) {
      setExchangeAnalysis(null);
      return;
    }

    let isSubscribed = true;
    const tilesToExchange = selectedExchangeIndices
      .filter((i) => i < rack.length)
      .map((i) => rack[i])
      .join("");

    if (!tilesToExchange) {
      setExchangeAnalysis(null);
      return;
    }

    setIsEvaluatingExchange(true);
    evaluateTileExchange({
      tilesToExchange,
      fullRack: rack,
      bagCount,
      equityMode,
    })
      .then((res) => {
        if (isSubscribed) {
          setExchangeAnalysis(res);
          setIsEvaluatingExchange(false);
        }
      })
      .catch((err) => {
        console.error("Exchange evaluation failed:", err);
        if (isSubscribed) setIsEvaluatingExchange(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isExchangeMode, selectedExchangeIndices, rack, bagCount, equityMode]);

  const toggleTileExchangeSelection = (idx) => {
    playTileClack();
    setSelectedExchangeIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleSortAlphabetical = () => {
    if (!rack) return;
    playTileClack();
    const sorted = rack
      .split("")
      .sort((a, b) => {
        const isBlankA = ["?", ".", "*", "_", "0"].includes(a);
        const isBlankB = ["?", ".", "*", "_", "0"].includes(b);
        if (isBlankA && !isBlankB) return 1;
        if (!isBlankA && isBlankB) return -1;
        return a.localeCompare(b);
      })
      .join("");
    onRackChange(sorted);
  };

  const handleSortVowelsConsonants = () => {
    if (!rack) return;
    playTileClack();
    const VOWELS = new Set(["A", "E", "I", "O", "U"]);
    const vowels = [];
    const consonants = [];
    const blanks = [];
    for (const ch of rack.split("")) {
      const upper = ch.toUpperCase();
      if (["?", ".", "*", "_", "0"].includes(ch)) {
        blanks.push(ch);
      } else if (VOWELS.has(upper)) {
        vowels.push(ch);
      } else {
        consonants.push(ch);
      }
    }
    vowels.sort((a, b) => a.localeCompare(b));
    consonants.sort((a, b) => a.localeCompare(b));
    onRackChange([...vowels, ...consonants, ...blanks].join(""));
  };

  const handleTilePointerDown = (e, ch, idx) => {
    if (e.button !== 0) return; // left click only
    if (isExchangeMode) return; // exchange mode uses onClick
    if (!canDrag) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    const isBlank = ["?", ".", "0", "*", "_"].includes(ch);
    const score = isBlank ? 0 : (tileScores?.[ch.toLowerCase()] ?? 0);
    const dragPayload = {
      source: "rack",
      index: idx,
      letter: ch,
      isBlank,
    };

    const handlePointerMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isDragging = true;
        setActiveDragPayload(dragPayload);
        setPointerDragState({
          active: true,
          letter: ch,
          score,
          x: moveEvt.clientX,
          y: moveEvt.clientY,
        });
      } else if (isDragging) {
        setPointerDragState({
          active: true,
          letter: ch,
          score,
          x: moveEvt.clientX,
          y: moveEvt.clientY,
        });
      }
    };

    const handlePointerUp = (upEvt) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      if (isDragging) {
        setPointerDragState(null);
        const el = document.elementFromPoint(upEvt.clientX, upEvt.clientY);
        const cellEl = el?.closest?.("[data-row][data-col]");
        const rackTileEl = el?.closest?.("[data-rack-index]");

        if (cellEl) {
          const r = parseInt(cellEl.getAttribute("data-row"), 10);
          const c = parseInt(cellEl.getAttribute("data-col"), 10);
          if (!isNaN(r) && !isNaN(c)) {
            onDropTileOnBoard?.(r, c, dragPayload);
          }
        } else if (rackTileEl) {
          const targetIdx = parseInt(rackTileEl.getAttribute("data-rack-index"), 10);
          if (!isNaN(targetIdx) && targetIdx !== idx) {
            const arr = rack.split("");
            const [moved] = arr.splice(idx, 1);
            arr.splice(targetIdx, 0, moved);
            onRackChange(arr.join(""));
            playTileClack();
          }
        }
        clearActiveDragPayload();
      } else {
        onRackTileClick?.(ch, idx);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const handleDragStart = (e, ch, idx) => {
    if (!canDrag) {
      e.preventDefault();
      return;
    }
    const isBlank = ["?", ".", "0", "*", "_"].includes(ch);
    const data = {
      source: "rack",
      index: idx,
      letter: ch,
      isBlank,
    };
    setDragData(e, data);
  };

  const handleDragEnd = () => {
    clearActiveDragPayload();
  };

  const handleTileDragOver = (e, idx) => {
    if (!canDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleTileDrop = (e, targetIdx) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIdx(null);
    setIsTrayOver(false);

    try {
      const data = getDragData(e);
      if (!data) return;

      if (data.source === "rack") {
        const sourceIdx = data.index;
        if (sourceIdx === targetIdx) return;
        const arr = rack.split("");
        const [moved] = arr.splice(sourceIdx, 1);
        arr.splice(targetIdx, 0, moved);
        const newRack = arr.join("");
        onRackChange(newRack);
        playTileClack();
      } else if (data.source === "board") {
        onDropTileFromBoard?.(data.fromR, data.fromC, targetIdx);
      }
    } catch (err) {
      console.warn("Rack tile drop error:", err);
    } finally {
      clearActiveDragPayload();
    }
  };

  const handleTrayDragOver = (e) => {
    if (!canDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsTrayOver(true);
  };

  const handleTrayDrop = (e) => {
    e.preventDefault();
    setIsTrayOver(false);
    setDragOverIdx(null);

    try {
      const data = getDragData(e);
      if (!data) return;
      if (data.source === "board") {
        onDropTileFromBoard?.(data.fromR, data.fromC);
      }
    } catch (err) {
      console.warn("Tray drop error:", err);
    } finally {
      clearActiveDragPayload();
    }
  };

  const handleExecuteExchange = () => {
    if (!exchangeAnalysis || selectedExchangeIndices.length === 0) return;
    const tilesToExchange = selectedExchangeIndices
      .map((i) => rack[i])
      .join("");
    playChime();
    onConfirmExchange?.(tilesToExchange, exchangeAnalysis);
    setIsExchangeMode(false);
    setSelectedExchangeIndices([]);
    setExchangeAnalysis(null);
  };

  const handleAutoOptimizeExchange = async () => {
    // 1. Check if candidatePlays has an optimal exchange play
    const exchPlay = candidatePlays?.find((p) => p.is_exchange || p.word?.startsWith("EXCH "));
    let swapStr = "";
    if (exchPlay) {
      swapStr = exchPlay.word.replace(/^EXCH\s*/i, "");
    } else {
      const res = await findBestExchange({
        rack,
        bagCount,
        equityMode,
      });
      if (res) {
        swapStr = res.word.replace(/^EXCH\s*/i, "");
      }
    }

    if (swapStr) {
      let tempRack = rack.split("");
      const indices = [];
      for (const ch of swapStr) {
        const idx = tempRack.findIndex(
          (t, i) => !indices.includes(i) && t.toUpperCase() === ch.toUpperCase()
        );
        if (idx !== -1) {
          indices.push(idx);
        }
      }
      setSelectedExchangeIndices(indices);
      playChime();
    }
  };

  return (
    <div className="rack-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: "bold" }}>
            Your Rack Tiles:
          </label>
          {isExchangeMode && (
            <span
              style={{
                fontSize: "10px",
                color: "#b8860b",
                fontWeight: "bold",
                backgroundColor: "#fffde7",
                padding: "1px 4px",
                border: "1px solid #ffd54f",
              }}
            >
              🔄 Exchange Mode: Click tiles to trade
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {onOpenAnagramExplorer && (
            <button
              className="win98-button"
              style={{ fontSize: "10px", padding: "1px 6px" }}
              onClick={onOpenAnagramExplorer}
              title="Open Anagram & Sub-Anagram Explorer (Ctrl+F)"
            >
              🔤 Anagrams
            </button>
          )}
          <button
            className={`win98-button ${isExchangeMode ? "win98-btn-active" : ""}`}
            style={{
              fontSize: "10px",
              padding: "1px 6px",
              fontWeight: isExchangeMode ? "bold" : "normal",
              backgroundColor: isExchangeMode ? "#e0e0e0" : undefined,
            }}
            onClick={() => {
              setIsExchangeMode(!isExchangeMode);
              setSelectedExchangeIndices([]);
              setExchangeAnalysis(null);
              playTileClack();
            }}
            title="Toggle Tile Exchange Analysis mode"
          >
            {isExchangeMode ? "Cancel Exch" : "🔄 Exchange"}
          </button>
          {inputMode === "opp" && (
            <span
              style={{
                fontSize: "10px",
                color: "#cc0000",
                fontWeight: "bold",
              }}
            >
              🔒 Locked
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          maxLength={7}
          className="win98-input"
          style={{ fontSize: "14px", padding: "4px 6px", flex: "1 1 auto", minWidth: "120px" }}
          value={rack}
          onChange={(e) => onRackChange(e.target.value)}
          onKeyDown={(e) => {
            if (/^[a-zA-Z?]$/.test(e.key) || e.key === "Backspace") {
              playTileClack();
            } else if (e.key === " " && e.shiftKey) {
              e.preventDefault();
              onShuffle?.();
            }
          }}
          disabled={isExchangeMode}
          placeholder="E.g. REOPMAJ? or ? for blank"
        />
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            className="win98-button"
            onClick={handleSortAlphabetical}
            disabled={isExchangeMode || !rack}
            title="Sort rack alphabetically A-Z (blanks at end)"
            style={{ fontSize: "11px", padding: "2px 6px" }}
          >
            🔤 A-Z
          </button>
          <button
            className="win98-button"
            onClick={handleSortVowelsConsonants}
            disabled={isExchangeMode || !rack}
            title="Tournament V/C: Group Vowels on left, Consonants on right"
            style={{ fontSize: "11px", padding: "2px 6px" }}
          >
            🅰️/🅱️ V/C
          </button>
          <button
            className="win98-button"
            onClick={onShuffle}
            disabled={isExchangeMode || !rack}
            title="Shuffle tiles (Space)"
            style={{ fontSize: "11px", padding: "2px 6px" }}
          >
            🔀 Shuffle
          </button>
        </div>
      </div>

      {/* Tray Display */}
      <div
        className={`rack-tray ${isTrayOver ? "tray-drag-over" : ""}`}
        onDragOver={handleTrayDragOver}
        onDragLeave={() => setIsTrayOver(false)}
        onDrop={handleTrayDrop}
        style={{
          boxShadow: isTrayOver
            ? "inset 0 0 0 2px #000080, 0 0 8px rgba(0,0,128,0.5)"
            : undefined,
          transition: "box-shadow 0.15s ease",
        }}
      >
        {rack.trim().length === 0 ? (
          <span
            style={{
              fontSize: "11px",
              color: "#d4a373",
              fontStyle: "italic",
              padding: "4px",
            }}
          >
            Empty rack (Type letters above or drop tiles here)...
          </span>
        ) : (
          rack.split("").map((ch, idx) => {
            const isBlank = ["?", ".", "0", "*", "_"].includes(ch);
            const score = isBlank ? 0 : (tileScores?.[ch.toLowerCase()] ?? 0);
            const isTargetOver = dragOverIdx === idx;
            const isSelectedForExchange = selectedExchangeIndices.includes(idx);
            const isSelectedForPlay = selectedRackTileIdx === idx;

            return (
              <div
                key={`${ch}-${idx}`}
                data-rack-index={idx}
                className={`scrabble-tile-rack ${isSelectedForPlay ? "rack-tile-selected" : ""}`}
                draggable={canDrag}
                onPointerDown={(e) => handleTilePointerDown(e, ch, idx)}
                onClick={
                  isExchangeMode
                    ? () => toggleTileExchangeSelection(idx)
                    : () => onRackTileClick?.(ch, idx)
                }
                onDragStart={(e) => handleDragStart(e, ch, idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleTileDragOver(e, idx)}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(e) => handleTileDrop(e, idx)}
                style={{
                  cursor: isExchangeMode ? "pointer" : canDrag ? "grab" : "not-allowed",
                  opacity: canDrag || isExchangeMode ? 1 : 0.75,
                  transform: isSelectedForExchange
                    ? "translateY(-6px) scale(1.06)"
                    : isSelectedForPlay
                    ? "translateY(-8px) scale(1.1)"
                    : isTargetOver
                    ? "scale(1.08)"
                    : undefined,
                  outline: isSelectedForExchange
                    ? "3px solid #d32f2f"
                    : isSelectedForPlay
                    ? "3px solid #000080"
                    : isTargetOver
                    ? "2px dashed #000080"
                    : undefined,
                  boxShadow: isSelectedForExchange
                    ? "0 4px 8px rgba(211, 47, 47, 0.4)"
                    : isSelectedForPlay
                    ? "0 6px 12px rgba(0, 0, 128, 0.4), 0 0 6px #ffff80"
                    : undefined,
                  backgroundColor: isSelectedForExchange
                    ? "#ffebee"
                    : isSelectedForPlay
                    ? "#ffffd0"
                    : undefined,
                  transition: "transform 0.12s ease, outline 0.12s ease, box-shadow 0.12s ease",
                  position: "relative",
                }}
                title={
                  isExchangeMode
                    ? isSelectedForExchange
                      ? `Click to keep ${ch.toUpperCase()}`
                      : `Click to trade ${ch.toUpperCase()}`
                    : !canDrag
                    ? "Tile dragging disabled during opponent's turn"
                    : isSelectedForPlay
                    ? `${ch.toUpperCase()} is SELECTED! Click any board square to paste it`
                    : isBlank
                    ? "Blank / Wildcard Tile (0 pts) • Click to select/paste, or Drag to Board"
                    : `${ch.toUpperCase()} (${score} pts) • Click to select/paste, or Drag to Board`
                }
              >
                <span>{isBlank ? "" : ch.toUpperCase()}</span>
                {!isBlank && <sub className="tile-score-sub">{score}</sub>}
                {isExchangeMode && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      fontSize: "8px",
                      fontWeight: "bold",
                      color: isSelectedForExchange ? "#d32f2f" : "#2e7d32",
                      textTransform: "uppercase",
                    }}
                  >
                    {isSelectedForExchange ? "SWAP" : "KEEP"}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating tile during pointer-based drag */}
      {pointerDragState?.active && (
        <div
          className="scrabble-tile-rack"
          style={{
            position: "fixed",
            left: pointerDragState.x,
            top: pointerDragState.y,
            transform: "translate(-50%, -50%) scale(1.12)",
            pointerEvents: "none",
            zIndex: 999999,
            boxShadow: "0 8px 16px rgba(0,0,0,0.5), 0 0 10px rgba(0,0,128,0.5)",
            outline: "2px solid #000080",
          }}
        >
          <span>{pointerDragState.letter === "?" ? "" : pointerDragState.letter.toUpperCase()}</span>
          {pointerDragState.letter !== "?" && (
            <sub className="tile-score-sub">{pointerDragState.score}</sub>
          )}
        </div>
      )}

      {/* Strategic Exchange Evaluation Panel */}
      {isExchangeMode && (
        <div
          className="win98-sunken"
          style={{
            marginTop: "6px",
            padding: "6px 8px",
            background: "#f7f7f7",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#111" }}>
              📊 Tile Exchange Simulation:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                className="win98-button"
                style={{ fontSize: "10px", padding: "1px 6px", fontWeight: "bold", color: "#4a148c" }}
                onClick={handleAutoOptimizeExchange}
                title="Automatically select mathematically optimal tiles to exchange"
              >
                ⚡ Auto-Optimize Swap
              </button>
              <span style={{ fontSize: "10px", color: "#555" }}>
                {selectedExchangeIndices.length === 0
                  ? "Select 1 to 7 tiles"
                  : `${selectedExchangeIndices.length} tile(s) selected`}
              </span>
            </div>
          </div>

          {selectedExchangeIndices.length > 0 && exchangeAnalysis && (
            <div style={{ fontSize: "11px", display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Retained Leave: <strong>{exchangeAnalysis.leave}</strong></span>
                <span>Leave Equity: <strong>{exchangeAnalysis.leave_equity >= 0 ? `+${exchangeAnalysis.leave_equity.toFixed(1)}` : exchangeAnalysis.leave_equity.toFixed(1)}</strong></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Bingo Odds Next Turn: <strong>{exchangeAnalysis.bingo_prob_next_turn.toFixed(1)}%</strong></span>
                <span>Total Net Equity: <strong>{exchangeAnalysis.total_val >= 0 ? `+${exchangeAnalysis.total_val.toFixed(1)}` : exchangeAnalysis.total_val.toFixed(1)}</strong></span>
              </div>

              {/* Comparative Advice vs Top Board Play */}
              <div
                style={{
                  marginTop: "4px",
                  padding: "4px 6px",
                  border: "1px solid #ccc",
                  backgroundColor:
                    bestPlay && exchangeAnalysis.total_val > bestPlay.total_val
                      ? "#e8f5e9"
                      : "#fffde7",
                  fontSize: "11px",
                }}
              >
                {bestPlay ? (
                  exchangeAnalysis.total_val > bestPlay.total_val ? (
                    <span style={{ color: "#2e7d32", fontWeight: "bold" }}>
                      ★ EXCHANGE STRATEGICALLY OPTIMAL (+{(exchangeAnalysis.total_val - bestPlay.total_val).toFixed(1)} EQ over {bestPlay.word})
                    </span>
                  ) : (
                    <span style={{ color: "#444" }}>
                      Board play <strong>{bestPlay.word}</strong> (+{bestPlay.score} pts, total {bestPlay.total_val.toFixed(1)}) is <strong>+{(bestPlay.total_val - exchangeAnalysis.total_val).toFixed(1)} EQ</strong> superior.
                    </span>
                  )
                ) : (
                  <span>Exchange net value: {exchangeAnalysis.total_val.toFixed(1)} pts.</span>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px", marginTop: "4px", justifyContent: "flex-end" }}>
                <button
                  className="win98-button"
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                  onClick={() => setSelectedExchangeIndices([])}
                >
                  Clear Selection
                </button>
                <button
                  className="win98-button"
                  style={{ fontSize: "11px", padding: "2px 10px", fontWeight: "bold" }}
                  onClick={handleExecuteExchange}
                >
                  Confirm Exchange ({selectedExchangeIndices.length})
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
