import React, { useState, useEffect, useMemo, useRef } from "react";
import { findRackAnagrams } from "../tauriBridge";
import { fetchDefinition, getCachedDefinition } from "../lib/dictionaryService";
import { playTileClack, playChime } from "../lib/soundEffects";

export default function AnagramExplorerModal({
  isOpen,
  onClose,
  initialRack = "",
  activeLexicon = "TWL06",
}) {
  const [rackInput, setRackInput] = useState(initialRack || "");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedLength, setSelectedLength] = useState("ALL");
  const [copiedWord, setCopiedWord] = useState(null);
  const [hoveredWord, setHoveredWord] = useState(null);
  const [hoverDefinition, setHoverDefinition] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const inputRef = useRef(null);

  // Sync initialRack when opened
  useEffect(() => {
    if (isOpen) {
      setRackInput(initialRack || "");
      setSearchFilter("");
      setSelectedLength("ALL");
      setCopiedWord(null);
      setHoveredWord(null);
      setHoverDefinition(null);
      if (initialRack && initialRack.trim().length >= 2) {
        runSearch(initialRack.trim());
      }
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, initialRack]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const runSearch = async (rackToSolve) => {
    const clean = (rackToSolve || rackInput || "").trim().toUpperCase();
    if (clean.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const words = await findRackAnagrams(clean, activeLexicon.toLowerCase());
      // Sort words by length descending, then alphabetically
      const sorted = [...words].sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return a.localeCompare(b);
      });
      setResults(sorted);
      playTileClack();
    } catch (err) {
      console.error("Anagram search error:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Group results by length
  const lengthCounts = useMemo(() => {
    const counts = { ALL: results.length };
    for (const w of results) {
      const len = w.length;
      counts[len] = (counts[len] || 0) + 1;
    }
    return counts;
  }, [results]);

  // Filtered words
  const filteredWords = useMemo(() => {
    let list = results;
    if (selectedLength !== "ALL") {
      const len = Number(selectedLength);
      list = list.filter((w) => w.length === len);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toUpperCase();
      list = list.filter((w) => w.includes(q));
    }
    return list;
  }, [results, selectedLength, searchFilter]);

  const handleCopy = (word) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(word);
    }
    setCopiedWord(word);
    playChime();
    setTimeout(() => {
      setCopiedWord((prev) => (prev === word ? null : prev));
    }, 2000);
  };

  const handleMouseEnterWord = async (word) => {
    setHoveredWord(word);
    const cached = getCachedDefinition(word);
    if (cached) {
      setHoverDefinition(cached);
    } else {
      setHoverDefinition({ loading: true });
      const def = await fetchDefinition(word);
      setHoverDefinition(def);
    }
  };

  const handleMouseLeaveWord = () => {
    setHoveredWord(null);
    setHoverDefinition(null);
  };

  // Dragging handlers for Win98 titlebar
  const handlePointerDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
  };
  const handlePointerMove = (e) => {
    if (!dragging) return;
    setDragOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handlePointerUp = () => setDragging(false);

  if (!isOpen) return null;

  const lengthTabs = [
    { id: "ALL", label: `All (${lengthCounts.ALL || 0})` },
    { id: "8", label: `8L (${lengthCounts[8] || 0})` },
    { id: "7", label: `⭐ 7L Bingo (${lengthCounts[7] || 0})` },
    { id: "6", label: `6L (${lengthCounts[6] || 0})` },
    { id: "5", label: `5L (${lengthCounts[5] || 0})` },
    { id: "4", label: `4L (${lengthCounts[4] || 0})` },
    { id: "3", label: `3L (${lengthCounts[3] || 0})` },
    { id: "2", label: `2L (${lengthCounts[2] || 0})` },
  ].filter((tab) => tab.id === "ALL" || (lengthCounts[tab.id] || 0) > 0);

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="win98-window"
        style={{
          width: "620px",
          maxWidth: "95vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
          boxShadow: "3px 3px 12px rgba(0, 0, 0, 0.6)",
          zIndex: 9999,
        }}
      >
        {/* Win98 Titlebar */}
        <div
          className="win98-titlebar"
          onPointerDown={handlePointerDown}
          style={{
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "3px 4px",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}>
            <span>🔤</span>
            <span>Rack Anagram &amp; Sub-Word Explorer</span>
            <span style={{ fontSize: "10px", opacity: 0.85, fontWeight: "normal" }}>
              [{activeLexicon.toUpperCase()}]
            </span>
          </div>
          <div style={{ display: "flex", gap: "2px" }}>
            <button
              className="win98-button win98-btn-sys"
              style={{ width: "16px", height: "14px", fontSize: "9px", padding: 0 }}
              onClick={onClose}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflow: "hidden" }}>
          {/* Rack Input Controls */}
          <div
            className="win98-sunken"
            style={{
              padding: "6px 8px",
              background: "#c0c0c0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <label style={{ fontSize: "12px", fontWeight: "bold", whiteSpace: "nowrap" }}>
              Rack / Letters:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={rackInput}
              maxLength={8}
              onChange={(e) => setRackInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && runSearch(rackInput)}
              placeholder="e.g. SATINES or RETINA?"
              className="win98-input"
              style={{
                flex: 1,
                fontFamily: "monospace",
                fontWeight: "bold",
                fontSize: "14px",
                letterSpacing: "2px",
                padding: "2px 6px",
                textTransform: "uppercase",
              }}
            />
            <button
              className="win98-button"
              style={{ fontWeight: "bold", padding: "3px 12px", minWidth: "90px" }}
              disabled={isLoading || rackInput.trim().length < 2}
              onClick={() => runSearch(rackInput)}
            >
              {isLoading ? "Searching..." : "🔍 Find Words"}
            </button>
          </div>

          {/* Word Length Filter Tabs */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2px",
              borderBottom: "2px solid #808080",
              paddingBottom: "2px",
            }}
          >
            {lengthTabs.map((tab) => {
              const isActive = selectedLength === tab.id;
              return (
                <button
                  key={tab.id}
                  className="win98-button"
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    fontWeight: isActive ? "bold" : "normal",
                    backgroundColor: isActive ? "#dcdcdc" : undefined,
                    borderBottomColor: isActive ? "#dcdcdc" : undefined,
                  }}
                  onClick={() => {
                    setSelectedLength(tab.id);
                    playTileClack();
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Quick Filter Box */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#333" }}>Filter results:</span>
            <input
              type="text"
              className="win98-input"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value.toUpperCase())}
              placeholder="Contains letters..."
              style={{
                fontSize: "11px",
                padding: "2px 4px",
                width: "160px",
                textTransform: "uppercase",
              }}
            />
            <span style={{ fontSize: "11px", color: "#555", marginLeft: "auto" }}>
              Showing {filteredWords.length} of {results.length} words
            </span>
          </div>

          {/* Results Grid Sunken Container */}
          <div
            className="win98-sunken"
            style={{
              background: "#fff",
              flex: 1,
              minHeight: "220px",
              maxHeight: "320px",
              overflowY: "auto",
              padding: "6px",
              display: "flex",
              flexWrap: "wrap",
              alignContent: "flex-start",
              gap: "4px",
            }}
          >
            {isLoading ? (
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "40px 10px",
                  color: "#666",
                  fontSize: "12px",
                }}
              >
                Traversing GADDAG nodes for subwords...
              </div>
            ) : filteredWords.length === 0 ? (
              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "40px 10px",
                  color: "#888",
                  fontSize: "12px",
                }}
              >
                {results.length === 0
                  ? "Enter at least 2 letters and click 'Find Words' (supports ? wildcards)."
                  : "No words match your filter."}
              </div>
            ) : (
              filteredWords.map((word) => {
                const isBingo = word.length >= 7;
                const isCopied = copiedWord === word;
                return (
                  <button
                    key={word}
                    className="win98-button"
                    onClick={() => handleCopy(word)}
                    onMouseEnter={() => handleMouseEnterWord(word)}
                    onMouseLeave={handleMouseLeaveWord}
                    title="Click to copy word to clipboard"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 6px",
                      fontSize: "12px",
                      fontWeight: isBingo ? "bold" : "normal",
                      fontFamily: "monospace",
                      backgroundColor: isCopied
                        ? "#cce5ff"
                        : isBingo
                        ? "#fff8e1"
                        : undefined,
                      borderColor: isBingo ? "#d4af37" : undefined,
                      cursor: "pointer",
                      transition: "transform 0.05s ease",
                    }}
                  >
                    <span>{word}</span>
                    <span
                      style={{
                        fontSize: "9px",
                        color: isBingo ? "#b8860b" : "#777",
                        fontWeight: "normal",
                      }}
                    >
                      ({word.length})
                    </span>
                    {isCopied && <span style={{ fontSize: "10px", color: "#0066cc" }}>✓</span>}
                  </button>
                );
              })
            )}
          </div>

          {/* Definition Preview Bar */}
          <div
            className="win98-sunken"
            style={{
              minHeight: "44px",
              padding: "4px 8px",
              background: "#ffffe1",
              fontSize: "11px",
              color: "#222",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {hoveredWord ? (
              <div>
                <span style={{ fontWeight: "bold", fontFamily: "monospace", marginRight: "6px" }}>
                  {hoveredWord}:
                </span>
                {hoverDefinition?.loading ? (
                  <span style={{ color: "#777", fontStyle: "italic" }}>Looking up definition...</span>
                ) : hoverDefinition?.definition ? (
                  <span>
                    <span style={{ fontStyle: "italic", color: "#666", marginRight: "4px" }}>
                      ({hoverDefinition.partOfSpeech || "def"})
                    </span>
                    {hoverDefinition.definition}
                  </span>
                ) : (
                  <span style={{ color: "#888", fontStyle: "italic" }}>
                    Valid tournament word ({activeLexicon}). No abridged definition found.
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: "#777", fontStyle: "italic" }}>
                Hover over any word to view definition. Click word to copy to clipboard.
              </span>
            )}
          </div>

          {/* Bottom Status / Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "11px", color: "#444" }}>
              {copiedWord && (
                <span style={{ color: "#008000", fontWeight: "bold" }}>
                  ✓ Copied "{copiedWord}" to clipboard!
                </span>
              )}
            </div>
            <button
              className="win98-button"
              style={{ minWidth: "75px", padding: "4px 14px", fontWeight: "bold" }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
