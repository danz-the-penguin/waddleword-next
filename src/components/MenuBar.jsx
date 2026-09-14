import React, { useState, useEffect, useRef } from "react";
import { playButtonClick } from "../lib/soundEffects";

/**
 * MenuBar - Authentic Windows 98 cascading menu bar for WaddleWord Next.
 * Supports File, Edit, View (Zoom & Layout modes), Tutorial, and Help.
 */
export default function MenuBar({
  onOpenTutorial,
  onOpenHelp,
  onNewGame,
  onExportGame,
  onOpenReview,
  onUndo,
  onRedo,
  onClearBoard,
  onImportClick,
  zoomLevel = 1,
  onSetZoom,
  isTournamentLayout = false,
  onToggleTournamentLayout,
  onToggleMaximize,
  canUndo = false,
  canRedo = false,
  onDownloadSnapshot,
  onCopySnapshot,
  onOpenAnagramExplorer,
  onOpenVolumePopover,
  simQuality = "standard",
  onSetSimQuality,
  onOpenTrainingStudio,
  onExportGcg,
  onToggleClock,
  isClockVisible = true,
  enableBlunderShield = true,
  onToggleBlunderShield,
  onOpenSteebotArena,
  isSparringActive = false,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuBarRef = useRef(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleMenuClick = (menuName) => {
    playButtonClick();
    setOpenMenu((prev) => (prev === menuName ? null : menuName));
  };

  const handleMenuHover = (menuName) => {
    if (openMenu && openMenu !== menuName) {
      setOpenMenu(menuName);
    }
  };

  const handleItemSelect = (action) => {
    playButtonClick();
    setOpenMenu(null);
    action?.();
  };

  return (
    <div className="win98-menubar" ref={menuBarRef}>
      {/* FILE MENU */}
      <div className="menu-item-wrapper">
        <span
          className={`menu-item ${openMenu === "file" ? "active" : ""}`}
          onClick={() => handleMenuClick("file")}
          onMouseEnter={() => handleMenuHover("file")}
        >
          <u>F</u>ile
        </span>
        {openMenu === "file" && (
          <div className="win98-menu-dropdown">
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onNewGame)}
            >
              <span>📄 New Game</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+N</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenSteebotArena)}
            >
              <span>🤖 Spar vs AI Bot Match (Woogles Roster)...</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onImportClick)}
            >
              <span>📂 Open Game...</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+O</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onExportGame)}
            >
              <span>💾 Save Game...</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+S</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onExportGcg)}
            >
              <span>📜 Export Match to GCG (.gcg)...</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+E</span>
            </div>
            <div className="menu-divider" />
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onDownloadSnapshot)}
            >
              <span>📸 Export Board Snapshot (PNG)...</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onCopySnapshot)}
            >
              <span>📋 Copy Board Snapshot to Clipboard</span>
            </div>
            <div className="menu-divider" />
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenReview)}
            >
              <span>📊 Tournament Match Review (GCG / Woogles)...</span>
            </div>
          </div>
        )}
      </div>

      {/* EDIT MENU */}
      <div className="menu-item-wrapper">
        <span
          className={`menu-item ${openMenu === "edit" ? "active" : ""}`}
          onClick={() => handleMenuClick("edit")}
          onMouseEnter={() => handleMenuHover("edit")}
        >
          <u>E</u>dit
        </span>
        {openMenu === "edit" && (
          <div className="win98-menu-dropdown">
            <div
              className={`menu-dropdown-item ${!canUndo ? "disabled" : ""}`}
              onClick={() => canUndo && handleItemSelect(onUndo)}
            >
              <span>↩ Undo</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+Z</span>
            </div>
            <div
              className={`menu-dropdown-item ${!canRedo ? "disabled" : ""}`}
              onClick={() => canRedo && handleItemSelect(onRedo)}
            >
              <span>↪ Redo</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+Y</span>
            </div>
            <div className="menu-divider" />
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onClearBoard)}
            >
              <span>🧹 Clear Board</span>
            </div>
          </div>
        )}
      </div>

      {/* VIEW MENU (Feature 2) */}
      <div className="menu-item-wrapper">
        <span
          className={`menu-item ${openMenu === "view" ? "active" : ""}`}
          onClick={() => handleMenuClick("view")}
          onMouseEnter={() => handleMenuHover("view")}
        >
          <u>V</u>iew
        </span>
        {openMenu === "view" && (
          <div className="win98-menu-dropdown">
            <div
              className="menu-dropdown-item"
              onClick={() =>
                handleItemSelect(() =>
                  onSetZoom?.(Math.min(1.5, Number((zoomLevel + 0.1).toFixed(2))))
                )
              }
            >
              <span>🔍 Zoom In</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl++</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() =>
                handleItemSelect(() =>
                  onSetZoom?.(Math.max(0.75, Number((zoomLevel - 0.1).toFixed(2))))
                )
              }
            >
              <span>🔍 Zoom Out</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+-</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(() => onSetZoom?.(1))}
            >
              <span>🔍 Reset Zoom (100%)</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+0</span>
            </div>
            <div className="menu-divider" />
            {[
              { label: "75% Zoom", val: 0.75 },
              { label: "90% Zoom", val: 0.9 },
              { label: "100% Normal", val: 1 },
              { label: "110% Zoom", val: 1.1 },
              { label: "125% Large", val: 1.25 },
              { label: "150% Extra Large", val: 1.5 },
            ].map(({ label, val }) => (
              <div
                key={val}
                className="menu-dropdown-item"
                onClick={() => handleItemSelect(() => onSetZoom?.(val))}
              >
                <span>
                  {Math.abs(zoomLevel - val) < 0.04 ? "✔ " : "   "}
                  {label}
                </span>
              </div>
            ))}
            <div className="menu-divider" />
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onToggleTournamentLayout)}
            >
              <span>
                {isTournamentLayout ? "✔ " : "   "}
                🏆 Tournament Layout Mode
              </span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onToggleClock)}
            >
              <span>
                {isClockVisible ? "✔ " : "   "}
                ⏱️ Tournament Chess Clock
              </span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onToggleMaximize)}
            >
              <span>🔲 Fullscreen / Maximize</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>F11</span>
            </div>
          </div>
        )}
      </div>

      {/* TOOLS MENU (Features 3, 4, 5, 7) */}
      <div className="menu-item-wrapper">
        <span
          className={`menu-item ${openMenu === "tools" ? "active" : ""}`}
          onClick={() => handleMenuClick("tools")}
          onMouseEnter={() => handleMenuHover("tools")}
        >
          <u>T</u>ools
        </span>
        {openMenu === "tools" && (
          <div className="win98-menu-dropdown">
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenAnagramExplorer)}
            >
              <span>🔤 Anagram &amp; Sub-Word Explorer...</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+F</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenTrainingStudio)}
            >
              <span>🧠 Training &amp; Lexicon Studio...</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>Ctrl+T</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenReview)}
            >
              <span>🌐 Fetch Woogles Match / GCG Review...</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenSteebotArena)}
            >
              <span>🤖 Spar vs AI Arena &amp; Coaching (Woogles Roster)...</span>
            </div>
            <div className="menu-divider" />
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onCopySnapshot)}
            >
              <span>📋 Copy Board Snapshot to Clipboard</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onDownloadSnapshot)}
            >
              <span>📸 Save Board Snapshot (PNG)...</span>
            </div>
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenVolumePopover)}
            >
              <span>🔊 Sound &amp; Volume Options...</span>
            </div>
            <div className="menu-divider" />
            <div style={{ padding: "2px 10px", fontSize: "10px", fontWeight: "bold", color: "#666" }}>
              M1 ANALYSIS DEPTH
            </div>
            {[
              { key: "blitz", label: "⚡ Blitz (~10ms)" },
              { key: "standard", label: "⚖️ Standard (~40ms)" },
              { key: "deep", label: "🧠 Deep M1 (~150ms)" },
              { key: "championship", label: "👑 Championship M1 (~450ms)" },
            ].map(({ key, label }) => (
              <div
                key={key}
                className="menu-dropdown-item"
                onClick={() => handleItemSelect(() => onSetSimQuality?.(key))}
              >
                <span>
                  {simQuality === key ? "✔ " : "   "}
                  {label}
                </span>
              </div>
            ))}
            <div className="menu-divider" />
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onToggleBlunderShield)}
            >
              <span>
                {enableBlunderShield ? "✔ " : "   "}
                🛡️ Tactical Blunder Shield
              </span>
            </div>
          </div>
        )}
      </div>

      {/* TUTORIAL MENU */}
      <div className="menu-item-wrapper">
        <span
          className={`menu-item ${openMenu === "tutorial" ? "active" : ""}`}
          onClick={() => handleMenuClick("tutorial")}
          onMouseEnter={() => handleMenuHover("tutorial")}
        >
          <u>T</u>utorial
        </span>
        {openMenu === "tutorial" && (
          <div className="win98-menu-dropdown">
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenTutorial)}
            >
              <span>📖 Interactive Quick Tour...</span>
            </div>
          </div>
        )}
      </div>

      {/* HELP MENU */}
      <div className="menu-item-wrapper">
        <span
          className={`menu-item ${openMenu === "help" ? "active" : ""}`}
          onClick={() => handleMenuClick("help")}
          onMouseEnter={() => handleMenuHover("help")}
        >
          <u>H</u>elp
        </span>
        {openMenu === "help" && (
          <div className="win98-menu-dropdown">
            <div
              className="menu-dropdown-item"
              onClick={() => handleItemSelect(onOpenHelp)}
            >
              <span>❓ Keyboard Shortcuts & Help</span>
              <span style={{ opacity: 0.6, fontSize: "10px" }}>F1</span>
            </div>
            <div className="menu-divider" />
            <div
              className="menu-dropdown-item"
              onClick={() =>
                handleItemSelect(() =>
                  alert(
                    "WaddleWord Next Pro Scrabble Engine\nVersion 0.1.0 (Tauri Desktop)\nNative Rust GADDAG Solver & Strategic Heuristics."
                  )
                )
              }
            >
              <span>ℹ️ About WaddleWord Next...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
