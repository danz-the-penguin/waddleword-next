import React, { useState } from "react";

import { setDragData, getDragData, clearActiveDragPayload } from "../lib/dragDropManager";

const TILE_SCORES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
  M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, v: 4, W: 4, X: 8,
  Y: 4, Z: 10,
};

/**
 * BoardCell - Individual cell in the 15x15 Scrabble board.
 * Supports HTML5 Drag & Drop:
 * - Empty cells accept tile drops from rack or other board cells
 * - Uncommitted tiles can be dragged across the board or returned to rack
 * - Move ghost pulse animation on hover (Feature 8)
 */
const BoardCell = React.memo(
  ({
    r,
    c,
    dangerType,
    tileVal,
    isUncommitted,
    previewChar,
    oppPreviewChar,
    premium,
    isSelected,
    isInActiveLine,
    typingDir,
    onClick,
    owner,
    scores,
    onDropTile,
    onReturnTileToRack,
    inputMode = "me",
    isBoardLocked = false,
  }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    let cellClass = tileVal ? "" : premium ? `cell-${premium}` : "";
    if (previewChar) {
      cellClass += " cell-ghost-active";
    }
    if (!tileVal && dangerType) {
      if (dangerType === "9x-corridor") cellClass += " cell-danger-9x-corridor";
      else if (dangerType === "4x-corridor") cellClass += " cell-danger-4x-corridor";
      else if (dangerType === "3W-center") cellClass += " cell-danger-3w-center";
      else if (dangerType === "3W-adj") cellClass += " cell-danger-3w-adj";
      else if (dangerType === "2W-center") cellClass += " cell-danger-2w-center";
      else if (dangerType === "2W-adj") cellClass += " cell-danger-2w-adj";
    }

    const handleDragEnter = (e) => {
      if (tileVal || inputMode !== "me") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    };

    const handleDragOver = (e) => {
      if (tileVal || inputMode !== "me") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isDragOver) setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setIsDragOver(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (tileVal || inputMode !== "me") return;
      try {
        const data = getDragData(e);
        if (!data) return;
        onDropTile?.(r, c, data);
      } catch (err) {
        console.warn("BoardCell drop error:", err);
      } finally {
        clearActiveDragPayload();
      }
    };

    const handleTileDragStart = (e) => {
      if (!isUncommitted || inputMode !== "me") {
        e.preventDefault();
        return;
      }
      const isBlank = tileVal >= "a" && tileVal <= "z";
      const data = {
        source: "board",
        fromR: r,
        fromC: c,
        letter: tileVal,
        isBlank,
      };
      setDragData(e, data);
    };

    const handleTileDragEnd = () => {
      clearActiveDragPayload();
    };

    let renderTile = null;
    if (tileVal) {
      const isBlank = tileVal >= "a" && tileVal <= "z";
      const score = isBlank
        ? 0
        : (scores?.[tileVal.toLowerCase()] ?? (TILE_SCORES[tileVal.toUpperCase()] || 0));
      const canDragThisTile = isUncommitted && inputMode === "me";

      renderTile = (
        <div
          className={`cell-tile ${owner === "opp" ? "cell-tile-opponent" : ""} ${isUncommitted ? "cell-tile-uncommitted" : ""}`}
          draggable={canDragThisTile}
          onDragStart={handleTileDragStart}
          onDragEnd={handleTileDragEnd}
          onDoubleClick={() => {
            if (isUncommitted && inputMode === "me") {
              onReturnTileToRack?.(r, c);
            }
          }}
          style={{
            color: isBlank ? "var(--w98-highlight)" : "",
            boxShadow: isUncommitted ? "inset 0 0 0 2px #008080" : undefined,
            cursor: canDragThisTile ? "grab" : "pointer",
          }}
          title={
            isUncommitted
              ? `${tileVal.toUpperCase()} (Uncommitted • Drag to move, or double-click to return to rack)`
              : `${tileVal.toUpperCase()} (${score} pts)`
          }
        >
          <span>{tileVal.toUpperCase()}</span>
          <span className="tile-score-sub">{score}</span>
        </div>
      );
    } else if (previewChar) {
      const isBlank = previewChar >= "a" && previewChar <= "z";
      const score = isBlank
        ? 0
        : (scores?.[previewChar.toLowerCase()] ?? (TILE_SCORES[previewChar.toUpperCase()] || 0));
      renderTile = (
        <div className="cell-preview" style={{ pointerEvents: "none", userSelect: "none" }}>
          {previewChar.toUpperCase()}
          <span className="tile-score-sub" style={{ color: "#ffffff", pointerEvents: "none" }}>
            {score}
          </span>
        </div>
      );
    } else if (oppPreviewChar) {
      const isBlank = oppPreviewChar >= "a" && oppPreviewChar <= "z";
      const score = isBlank
        ? 0
        : (scores?.[oppPreviewChar.toLowerCase()] ?? (TILE_SCORES[oppPreviewChar.toUpperCase()] || 0));
      renderTile = (
        <div className="cell-opp-preview" title="Opponent Counter-Play" style={{ pointerEvents: "none", userSelect: "none" }}>
          {oppPreviewChar.toUpperCase()}
          <span className="tile-score-sub" style={{ pointerEvents: "none" }}>{score}</span>
        </div>
      );
    }

    return (
      <div
        className={`board-cell ${cellClass} ${isSelected ? "selected" : ""} ${
          isInActiveLine ? "cell-in-active-line" : ""
        } ${isDragOver ? "cell-drag-over" : ""}`}
        data-row={r}
        data-col={c}
        onClick={() => onClick(r, c)}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          borderTop:
            isSelected || isInActiveLine
              ? ["Down", "Up"].includes(typingDir)
                ? "2px solid var(--w98-highlight)"
                : undefined
              : undefined,
          borderBottom:
            isSelected || isInActiveLine
              ? ["Down", "Up"].includes(typingDir)
                ? "2px solid var(--w98-highlight)"
                : undefined
              : undefined,
          borderLeft:
            isSelected || isInActiveLine
              ? ["Right", "Left"].includes(typingDir)
                ? "2px solid var(--w98-highlight)"
                : undefined
              : undefined,
          borderRight:
            isSelected || isInActiveLine
              ? ["Right", "Left"].includes(typingDir)
                ? "2px solid var(--w98-highlight)"
                : undefined
              : undefined,
          outline: isDragOver ? "3px dashed #000080" : undefined,
          backgroundColor: isDragOver ? "#ffffcc" : undefined,
        }}
      >
        {renderTile || (
          <span style={{ pointerEvents: "none", userSelect: "none" }}>
            {premium === "CENTER" ? "★" : premium || ""}
          </span>
        )}

        {isSelected && (
          <div
            style={{
              position: "absolute",
              bottom: "1px",
              right: "2px",
              fontSize: "8px",
              color: "#ff0000",
              fontWeight: "bold",
              lineHeight: 1,
              pointerEvents: "none",
              textShadow: "1px 1px 0px #ffffff",
            }}
          >
            {typingDir === "Right" ? "►" : typingDir === "Left" ? "◄" : typingDir === "Down" ? "▼" : "▲"}
          </div>
        )}
      </div>
    );
  },
);
BoardCell.displayName = "BoardCell";

export default BoardCell;
