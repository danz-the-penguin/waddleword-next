// src/components/Board.jsx - Interactive 15x15 Scrabble Board with Win98 Theme
// Phase 2: Full board interaction with BoardCell, keyboard navigation, typing direction

import React, { useRef } from "react";
import BoardCell from "./BoardCell";
import { getDragData } from "../lib/dragDropManager";

const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];

// Standard Scrabble premium square map
const PREMIUMS = {};
for (const [r, c] of [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]]) {
  PREMIUMS[`${r},${c}`] = "3W";
}
for (const [r, c] of [[1,1],[2,2],[3,3],[4,4],[1,13],[2,12],[3,11],[4,10],
  [13,1],[12,2],[11,3],[10,4],[13,13],[12,12],[11,11],[10,10]]) {
  PREMIUMS[`${r},${c}`] = "2W";
}
PREMIUMS["7,7"] = "CENTER";
for (const [r, c] of [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],
  [9,1],[9,5],[9,9],[9,13],[13,5],[13,9]]) {
  PREMIUMS[`${r},${c}`] = "3L";
}
for (const [r, c] of [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],
  [6,2],[6,6],[6,8],[6,12],[7,3],[7,11],
  [8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],
  [12,6],[12,8],[14,3],[14,11]]) {
  PREMIUMS[`${r},${c}`] = "2L";
}

export { PREMIUMS, COLUMNS };

export default function Board({
  board,
  committedBoard,
  tileOwners,
  selectedCell,
  typingDir,
  isBoardLocked,
  hoveredPlay,
  dangerSquares,
  onCellClick,
  activePreset,
  onCommit,
  onRevert,
  onDropTile,
  onReturnTileToRack,
  inputMode = "me",
}) {
  const mobileInputRef = useRef(null);
  const currentPremiums = activePreset?.premiums || PREMIUMS;
  // Build ghost overlay maps from hoveredPlay
  const previewMap = {};
  const oppPreviewMap = {};

  const handleBoardContainerDragOver = (e) => {
    if (inputMode !== "me") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleBoardContainerDrop = (e) => {
    if (inputMode !== "me") return;
    e.preventDefault();
    const data = getDragData(e);
    if (!data) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cellEl = el?.closest?.("[data-row][data-col]");
    if (cellEl) {
      const r = parseInt(cellEl.getAttribute("data-row"), 10);
      const c = parseInt(cellEl.getAttribute("data-col"), 10);
      if (!isNaN(r) && !isNaN(c) && !board[r]?.[c]) {
        onDropTile?.(r, c, data);
      }
    }
  };

  if (hoveredPlay) {
    // Our play preview
    let ourPlay = null;
    let oppPlay = null;

    if (Array.isArray(hoveredPlay)) {
      ourPlay = hoveredPlay[0];
      oppPlay = hoveredPlay[1] || ourPlay?.oppBestReply;
    } else {
      ourPlay = hoveredPlay;
      oppPlay = hoveredPlay.oppBestReply;
    }

    if (ourPlay && ourPlay.word) {
      const { word, row, col } = ourPlay;
      const isVert = ourPlay.is_vertical || ourPlay.dir === "V";
      for (let i = 0; i < word.length; i++) {
        const r = isVert ? row + i : row;
        const c = isVert ? col : col + i;
        if (!board[r]?.[c]) {
          previewMap[`${r},${c}`] = word[i];
        }
      }
    }

    if (oppPlay && oppPlay.word) {
      const { word, row, col } = oppPlay;
      const isVert = oppPlay.is_vertical || oppPlay.dir === "V";
      for (let i = 0; i < word.length; i++) {
        const r = isVert ? row + i : row;
        const c = isVert ? col : col + i;
        if (!previewMap[`${r},${c}`] && !board[r]?.[c]) {
          oppPreviewMap[`${r},${c}`] = word[i];
        }
      }
    }
  }

  const handleCellClick = (r, c) => {
    mobileInputRef.current?.focus();
    onCellClick?.(r, c);
  };

  return (
    <div>
      <input
        id="hidden-board-input"
        ref={mobileInputRef}
        type="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        style={{
          position: "fixed",
          top: "-100px",
          left: "-100px",
          opacity: 0,
          fontSize: "16px",
        }}
        value=" "
        onChange={(e) => {
          const val = e.target.value;
          e.target.value = " "; // Reset
          if (val.length > 1) {
            const char = val.charAt(1);
            if (/^[a-zA-Z]$/.test(char)) {
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: char.toUpperCase(),
                  shiftKey: false,
                }),
              );
            } else if (char === "?") {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
            }
          } else if (val.length === 0) {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit?.();
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onRevert?.();
            return;
          }
          if (e.altKey || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            return;
          }
          if (
            /^[a-zA-Z]$/.test(e.key) ||
            e.key === "Backspace" ||
            e.key === "Delete" ||
            e.key === " " ||
            e.key === "?"
          ) {
            e.preventDefault();
          }
        }}
      />
      <div
        className="board-grid-container win98-inset"
        onDragOver={handleBoardContainerDragOver}
        onDrop={handleBoardContainerDrop}
      >
        <div
          className="board-grid"
          onDragOver={handleBoardContainerDragOver}
          onDrop={handleBoardContainerDrop}
        >
          {/* Top-left corner (empty header) */}
          <div className="board-header"></div>
          {/* Column headers A-O */}
          {COLUMNS.map((col) => (
            <div key={col} className="board-header">{col}</div>
          ))}

          {/* Board rows with row headers */}
          {board.map((row, r) => (
            <React.Fragment key={`row-${r}`}>
              <div className="board-header">{r + 1}</div>
              {row.map((tileVal, c) => {
                const key = `${r},${c}`;
                const isSelected =
                  !isBoardLocked &&
                  selectedCell &&
                  selectedCell[0] === r &&
                  selectedCell[1] === c;
                const isInActiveLine =
                  !isBoardLocked &&
                  selectedCell &&
                  (["Right", "Left"].includes(typingDir)
                    ? selectedCell[0] === r
                    : selectedCell[1] === c);
                const isUncommitted = Boolean(tileVal && committedBoard && !committedBoard[r]?.[c]);

                return (
                  <BoardCell
                    key={key}
                    r={r}
                    c={c}
                    dangerType={dangerSquares?.get?.(key)}
                    tileVal={tileVal}
                    isUncommitted={isUncommitted}
                    previewChar={previewMap[key]}
                    oppPreviewChar={oppPreviewMap[key]}
                    premium={currentPremiums[key]}
                    isSelected={isSelected}
                    isInActiveLine={isInActiveLine}
                    typingDir={typingDir}
                    onClick={handleCellClick}
                    owner={tileOwners?.[r]?.[c]}
                    scores={activePreset?.scores}
                    onDropTile={onDropTile}
                    onReturnTileToRack={onReturnTileToRack}
                    inputMode={inputMode}
                    isBoardLocked={isBoardLocked}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
