// src/components/HelpModal.jsx - Hotkey Reference & Credits
import React from "react";
import { useDraggable } from "../hooks/useDraggable";

/**
 * HelpModal - Displays keyboard shortcut references and development credits.
 */
export default function HelpModal({ isOpen, onClose }) {
  const { position, handlePointerDown } = useDraggable();

  if (!isOpen) return null;

  return (
    <div
      className="win98-window"
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        zIndex: 10000,
        padding: "10px",
        width: "380px",
        maxWidth: "95vw",
        boxShadow: "2px 2px 10px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="win98-titlebar"
        onPointerDown={handlePointerDown}
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
          cursor: "grab",
        }}
      >
        <span>Help &amp; Hotkeys</span>
        <button className="win98-button win98-btn-sys" onClick={onClose}>
          ✕
        </button>
      </div>
      <div
        className="win98-inset"
        style={{
          padding: "10px",
          fontSize: "12px",
          lineHeight: "1.5",
          backgroundColor: "#fff",
          maxHeight: "60vh",
          overflowY: "auto",
        }}
      >
        <h4
          style={{
            margin: "0 0 8px 0",
            color: "var(--w98-title-start)",
          }}
        >
          Keyboard Shortcuts
        </h4>
        <ul
          style={{
            paddingLeft: "20px",
            margin: "0 0 12px 0",
            color: "#222",
          }}
        >
          <li style={{ marginBottom: "4px" }}>
            <strong>Arrow Keys:</strong> Move the cursor around the board.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Shift + Arrow Keys:</strong> Change typing direction (►, ◄, ▼, ▲) without moving cursor.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Spacebar:</strong> Toggle typing direction between Horizontal and Vertical.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>? or / :</strong> Open the Blank Tile selector. Type a letter or press Shift+Letter to place a 0-point blank tile.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Enter:</strong> Commit currently placed tiles onto the permanent board, or apply selected candidate play.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Escape:</strong> Cancel and revert uncommitted staged tiles.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Tab:</strong> Preview the top suggested play on the board.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>↑ / ↓:</strong> Navigate candidate moves in the Move List.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Alt + O:</strong> Switch between &quot;My Play&quot; and &quot;Opponent Play&quot;.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Ctrl + Z / Ctrl + Y:</strong> Undo or Redo board and score history.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Ctrl + F:</strong> Open Anagram Explorer for rack or custom query.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Ctrl + T:</strong> Open Training &amp; Leave Equity Studio.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Ctrl + E:</strong> Export current match to standard <code>.gcg</code> file.
          </li>
          <li style={{ marginBottom: "4px" }}>
            <strong>Shift + Ctrl + C:</strong> Copy board screenshot snapshot to clipboard.
          </li>
          <li>
            <strong>Ctrl + + / - / 0:</strong> Zoom UI in, zoom out, or reset to 100%.
          </li>
        </ul>

        <h4
          style={{
            margin: "12px 0 8px 0",
            color: "var(--w98-title-start)",
          }}
        >
          Credits &amp; Acknowledgments
        </h4>
        <div style={{ fontSize: "11px", color: "#333" }}>
          This project stands on the shoulders of giants within the computer science and competitive word game
          communities:
          <ul
            style={{
              paddingLeft: "16px",
              margin: "8px 0",
              listStyleType: "square",
            }}
          >
            <li style={{ marginBottom: "6px" }}>
              <strong>Kamil Mielnik (Scrabble Solver):</strong> Pioneer of open-source web-based board solvers, whose
              work served as an architectural reference and inspiration.
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>Quackle:</strong> The gold-standard open-source crossword AI. Strategy and leave valuations
              inspired by Quackle&apos;s pre-calculated strategy datasets.
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>Woogles.io &amp; Cross-Tables.com:</strong> For providing an incredible open platform, UI workflows,
              exhaustive public archives of Grandmaster .gcg tournament files, and the official AI sparring benchmark ladder
              credited herein: <em>BeginnerBot (240 Pt Avg)</em>, <em>BasicBot (330 Pt Avg)</em>, <em>BetterBot (370 Pt Avg)</em>, <em>STEEBot (410 Pt Avg)</em>, and <em>HastyBot (460 Pt Avg)</em>.
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>Steven A. Gordon:</strong> For formulating the GADDAG Data Structure (1994), the deterministic
              acyclic finite state automaton that powers this engine&apos;s move generation.
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>Albert Zobrist:</strong> For Zobrist Hashing, used within the Transposition Table to cache board
              states in O(1) time during Alpha-Beta pruning.
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>NASPA &amp; WESPA:</strong> For the curation and maintenance of official competitive Scrabble
              lexicons (NWL and CSW).
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>Sierra On-Line (Hoyle Classic Games):</strong> A primary design inspiration for the customized,
              wooden Windows 98 aesthetic.
            </li>
          </ul>
        </div>

        <div style={{ textAlign: "center", marginTop: "10px" }}>
          <button className="win98-button" onClick={onClose} style={{ minWidth: "75px" }}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
