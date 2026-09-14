// src/components/TrainingStudioModal.jsx
// Phase 3: In-App Leave Equity Studio, Native GADDAG Compiler, and Apple M1 Worker Scaler

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  compileAndLoadCustomGaddag,
  getLeaveWeightsMap,
  setCustomLeaveWeight,
  importLeaveWeights,
  exportLeaveWeights,
  resetLeaveWeights,
  getSystemSpecs,
  setWorkerThreads,
} from "../tauriBridge";
import { playButtonClick, playWin98Chord, playTileClack, playChime } from "../lib/soundEffects";

const SAMPLE_TWO_LETTER_WORDS = `AA
AB
AD
AE
AG
AH
AI
AL
AM
AN
AR
AS
AT
AW
AX
AY
BA
BE
BI
BO
BY
CH
DA
DE
DI
DO
EA
ED
EE
EF
EH
EL
EM
EN
ER
ES
ET
EX
EY
FA
FE
FY
GI
GO
GU
HA
HE
HI
HM
HO
ID
IF
IN
IO
IS
IT
JA
JO
KA
KI
KO
KY
LA
LI
LO
MA
ME
MI
MM
MO
MU
MY
NA
NE
NO
NU
NY
OB
OD
OE
OF
OH
OI
OK
OM
ON
OP
OR
OS
OU
OW
OX
OY
PA
PE
PI
PO
QI
RE
SH
SI
SO
ST
TA
TE
TI
TO
UG
UH
UM
UN
UP
UR
US
UT
WE
WO
XI
XU
YA
YE
YO
YU
ZA
ZO`;

const SAMPLE_HIGH_STEMS = `RETINA
SATINES
STARE
TRAINS
RETAINS
TARE
RATES
TIRES
ASTER
ARREST
CANTER
CARPET
DENTAL
ENROBE
FALTER
GARNET
HORNET
INTERN
LANCET
MASTER
NECTAR
ORIENT
PATENT
RECAST
SENATOR
TINKER`;

const COMMON_PRESET_LEAVES = [
  { leave: "?", weight: 24.5, desc: "Wildcard Blank (Highest Value)" },
  { leave: "RETINA", weight: 31.5, desc: "Tournament 6-letter Bingo Core" },
  { leave: "SATIN", weight: 16.8, desc: "High-probability Bingo Core" },
  { leave: "S", weight: 8.2, desc: "Hook Multiplier" },
  { leave: "ER", weight: 3.5, desc: "Natural Suffix" },
  { leave: "ING", weight: 4.8, desc: "Natural Suffix" },
  { leave: "C", weight: -1.2, desc: "Awkward Consonant" },
  { leave: "U", weight: -2.1, desc: "Vowel Sink" },
  { leave: "V", weight: -5.8, desc: "Severe Tournament Penalty" },
  { leave: "Q", weight: -7.5, desc: "Severe Tournament Penalty (Needs U)" },
];

export default function TrainingStudioModal({
  isOpen,
  onClose,
  activeLexicon,
  onSetActiveLexicon,
  equityMode,
  onSetEquityMode,
}) {
  const [activeTab, setActiveTab] = useState("equity"); // 'equity' | 'lexicon' | 'scaler'

  // Tab 1: Leave Equity Matrix state
  const [leaveWeights, setLeaveWeights] = useState({});
  const [equityFilter, setEquityFilter] = useState("");
  const [inputLeave, setInputLeave] = useState("");
  const [inputWeight, setInputWeight] = useState("");
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [equityMessage, setEquityMessage] = useState(null);

  // Tab 2: Custom Lexicon & GADDAG Compiler state
  const [wordListInput, setWordListInput] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStats, setCompileStats] = useState(null);
  const [compileError, setCompileError] = useState(null);
  const fileInputRef = useRef(null);

  // Tab 3: M1 Hardware & Worker Scaler state
  const [systemSpecs, setSystemSpecs] = useState({
    cpu_arch: "Apple Silicon (aarch64)",
    logical_cores: 8,
    active_workers: 8,
    simd_feature: "NEON 128-bit SIMD Vector Acceleration",
    os: "macOS",
  });
  const [sliderThreads, setSliderThreads] = useState(8);
  const [scalerMessage, setScalerMessage] = useState(null);

  // Window drag state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load initial data on open
  useEffect(() => {
    if (isOpen) {
      loadLeaveWeights();
      loadSystemSpecs();
    }
  }, [isOpen]);

  const loadLeaveWeights = async () => {
    try {
      const map = await getLeaveWeightsMap();
      setLeaveWeights(map || {});
    } catch (err) {
      console.error("Failed to load leave weights:", err);
    }
  };

  const loadSystemSpecs = async () => {
    try {
      const specs = await getSystemSpecs();
      if (specs) {
        setSystemSpecs(specs);
        setSliderThreads(specs.active_workers || specs.logical_cores || 8);
      }
    } catch (err) {
      console.error("Failed to load system specs:", err);
    }
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

  // Leave Equity actions
  const handleSaveWeight = async (leaveToSave, weightToSave) => {
    const l = (leaveToSave || inputLeave).trim().toUpperCase();
    const w = parseFloat(weightToSave !== undefined ? weightToSave : inputWeight);
    if (!l || isNaN(w)) {
      setEquityMessage({ type: "error", text: "Please enter a valid leave (e.g. RETINA) and numeric weight." });
      return;
    }
    setIsSavingWeight(true);
    try {
      await setCustomLeaveWeight(l, w);
      setLeaveWeights((prev) => ({ ...prev, [l]: w }));
      setInputLeave("");
      setInputWeight("");
      setEquityMessage({ type: "success", text: `Saved leave '${l}' = ${w > 0 ? "+" : ""}${w.toFixed(1)} pts` });
      playChime();
    } catch (err) {
      setEquityMessage({ type: "error", text: `Error saving leave: ${err}` });
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleExportWeights = async () => {
    try {
      const jsonStr = await exportLeaveWeights();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waddleword_leaves_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      playChime();
      setEquityMessage({ type: "success", text: "Exported custom leave matrix JSON to Downloads." });
    } catch (err) {
      setEquityMessage({ type: "error", text: `Export failed: ${err}` });
    }
  };

  const handleImportWeightsFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target.result;
        const count = await importLeaveWeights(text);
        await loadLeaveWeights();
        setEquityMessage({ type: "success", text: `Successfully imported ${count} custom leaves.` });
        playWin98Chord();
      } catch (err) {
        setEquityMessage({ type: "error", text: `Import failed: ${err}` });
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleResetWeights = async () => {
    if (!window.confirm("Reset all custom leave weights back to empty? (The solver will revert to Trained ML defaults)")) return;
    try {
      await resetLeaveWeights();
      setLeaveWeights({});
      setEquityMessage({ type: "success", text: "Custom leaves reset to default ML trained dataset." });
      playWin98Chord();
    } catch (err) {
      setEquityMessage({ type: "error", text: `Reset failed: ${err}` });
    }
  };

  const filteredLeaves = useMemo(() => {
    const q = equityFilter.trim().toUpperCase();
    const entries = Object.entries(leaveWeights);
    if (!q) return entries;
    return entries.filter(([leave]) => leave.includes(q));
  }, [leaveWeights, equityFilter]);

  // GADDAG Compiler actions
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setWordListInput(ev.target.result || "");
      playTileClack();
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleCompileGaddag = async () => {
    if (!wordListInput.trim()) {
      setCompileError("Word list cannot be empty. Paste words or load a sample first.");
      return;
    }
    setIsCompiling(true);
    setCompileError(null);
    setCompileStats(null);
    playButtonClick();

    const t0 = performance.now();
    try {
      const res = await compileAndLoadCustomGaddag(wordListInput);
      const elapsed = Math.round(performance.now() - t0);
      setCompileStats({
        ...res,
        elapsed_ms: elapsed,
      });
      playWin98Chord();
      if (onSetActiveLexicon) {
        onSetActiveLexicon("custom");
      }
    } catch (err) {
      console.error("Compilation failed:", err);
      setCompileError(typeof err === "string" ? err : err.message || "Compilation failed.");
    } finally {
      setIsCompiling(false);
    }
  };

  // Hardware Scaler actions
  const handleSliderChange = async (val) => {
    const threads = parseInt(val, 10);
    setSliderThreads(threads);
    try {
      const active = await setWorkerThreads(threads);
      setSystemSpecs((prev) => ({ ...prev, active_workers: active }));
      setScalerMessage(`✓ Active Rayon worker threads set to ${active}.`);
      playButtonClick();
    } catch (err) {
      console.error("Failed to set worker threads:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="win98-window"
        style={{
          width: "720px",
          maxWidth: "96vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
          boxShadow: "4px 4px 16px rgba(0, 0, 0, 0.65)",
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
            padding: "3px 6px",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}>
            <span>🧠</span>
            <span>Training &amp; Lexicon Studio - [Apple M1 Native Architecture]</span>
          </div>
          <button
            className="win98-button win98-btn-sys"
            style={{ width: "16px", height: "14px", fontSize: "9px", padding: 0 }}
            onClick={onClose}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Win98 Tab Bar */}
        <div
          style={{
            display: "flex",
            gap: "2px",
            padding: "6px 8px 0 8px",
            background: "var(--w98-surface, #c0c0c0)",
            borderBottom: "2px solid #808080",
          }}
        >
          {[
            { id: "equity", label: "📊 Leave Equity Matrix Studio", icon: "📊" },
            { id: "lexicon", label: "📚 Lexicon & GADDAG Compiler", icon: "📚" },
            { id: "scaler", label: "⚡ Apple M1 Worker Scaler", icon: "⚡" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className="win98-button"
                onClick={() => {
                  setActiveTab(tab.id);
                  playButtonClick();
                }}
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  fontWeight: isActive ? "bold" : "normal",
                  backgroundColor: isActive ? "#ffffff" : "#c0c0c0",
                  borderBottom: isActive ? "2px solid #ffffff" : undefined,
                  transform: isActive ? "translateY(2px)" : "none",
                  zIndex: isActive ? 2 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div
          style={{
            padding: "10px",
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            backgroundColor: "#ffffff",
          }}
        >
          {/* TAB 1: LEAVE EQUITY MATRIX STUDIO */}
          {activeTab === "equity" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Top Banner & Mode Toggle */}
              <div
                className="win98-inset"
                style={{
                  padding: "6px 10px",
                  backgroundColor: "#f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "bold", color: "#000080" }}>
                    Dynamic Leave Equity Evaluator
                  </div>
                  <div style={{ fontSize: "10px", color: "#555" }}>
                    Current Engine Mode: <strong>{equityMode.toUpperCase()}</strong> (
                    {equityMode === "custom" ? "Evaluating custom fine-tuned leaves" : "Using standard ML weights"}
                    )
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {equityMode !== "custom" && (
                    <button
                      className="win98-button"
                      style={{ fontWeight: "bold", color: "#006600" }}
                      onClick={() => {
                        onSetEquityMode("custom");
                        playChime();
                      }}
                    >
                      ✔ Switch to Custom Mode
                    </button>
                  )}
                  <button className="win98-button" onClick={handleExportWeights} title="Save custom leaves to JSON">
                    💾 Export JSON
                  </button>
                  <label className="win98-button" style={{ cursor: "pointer", margin: 0 }}>
                    📂 Import JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportWeightsFile}
                      style={{ display: "none" }}
                    />
                  </label>
                  <button className="win98-button" onClick={handleResetWeights} style={{ color: "#cc0000" }}>
                    🧹 Reset All
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {equityMessage && (
                <div
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    backgroundColor: equityMessage.type === "success" ? "#e8ffe8" : "#ffe8e8",
                    color: equityMessage.type === "success" ? "#006600" : "#cc0000",
                    border: "1px solid",
                    borderColor: equityMessage.type === "success" ? "#006600" : "#cc0000",
                  }}
                >
                  {equityMessage.text}
                </div>
              )}

              {/* Add / Edit Input Bar */}
              <fieldset className="win98-fieldset" style={{ margin: 0 }}>
                <legend>Add or Fine-Tune Leave Weight</legend>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "11px", fontWeight: "bold" }}>
                    Leave:
                    <input
                      type="text"
                      className="win98-input"
                      placeholder="e.g. RETINA or ?"
                      value={inputLeave}
                      onChange={(e) => setInputLeave(e.target.value.toUpperCase())}
                      style={{ width: "110px", marginLeft: "4px", padding: "2px 4px" }}
                    />
                  </label>
                  <label style={{ fontSize: "11px", fontWeight: "bold" }}>
                    Weight (pts):
                    <input
                      type="number"
                      step="0.1"
                      className="win98-input"
                      placeholder="e.g. 15.5"
                      value={inputWeight}
                      onChange={(e) => setInputWeight(e.target.value)}
                      style={{ width: "90px", marginLeft: "4px", padding: "2px 4px" }}
                    />
                  </label>
                  <button
                    className="win98-button"
                    style={{ fontWeight: "bold", color: "#000080", padding: "3px 12px" }}
                    disabled={isSavingWeight}
                    onClick={() => handleSaveWeight()}
                  >
                    {isSavingWeight ? "Saving..." : "💾 Set Weight"}
                  </button>
                </div>
              </fieldset>

              {/* Quick Preset Chips */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#555" }}>
                  Quick Preset Weights (Click to inject):
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {COMMON_PRESET_LEAVES.map((item) => (
                    <button
                      key={item.leave}
                      className="win98-button"
                      style={{ fontSize: "10px", padding: "2px 6px" }}
                      onClick={() => handleSaveWeight(item.leave, item.weight)}
                      title={item.desc}
                    >
                      {item.leave}: <strong>{item.weight > 0 ? `+${item.weight}` : item.weight}</strong>
                    </button>
                  ))}
                </div>
              </div>

              {/* Leaves Table */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                  Active Custom Leaves ({Object.keys(leaveWeights).length}):
                </span>
                <input
                  type="text"
                  className="win98-input"
                  placeholder="Filter leaves..."
                  value={equityFilter}
                  onChange={(e) => setEquityFilter(e.target.value.toUpperCase())}
                  style={{ width: "160px", fontSize: "11px", padding: "2px 4px" }}
                />
              </div>

              <div
                className="win98-inset"
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  padding: 0,
                  backgroundColor: "#ffffff",
                }}
              >
                {filteredLeaves.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", fontSize: "11px", color: "#888" }}>
                    {Object.keys(leaveWeights).length === 0
                      ? "No custom weights saved yet. Inject presets above or import a JSON file."
                      : "No leaves match your filter."}
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                    <thead>
                      <tr style={{ background: "#e0e0e0", borderBottom: "1px solid #808080", textAlign: "left" }}>
                        <th style={{ padding: "4px 8px" }}>Leave Pattern</th>
                        <th style={{ padding: "4px 8px" }}>Equity Weight</th>
                        <th style={{ padding: "4px 8px" }}>Impact Assessment</th>
                        <th style={{ padding: "4px 8px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeaves.map(([leave, weight]) => {
                        const num = Number(weight);
                        const isPositive = num > 0;
                        return (
                          <tr key={leave} style={{ borderBottom: "1px dotted #ccc" }}>
                            <td style={{ padding: "4px 8px", fontFamily: "monospace", fontWeight: "bold" }}>
                              {leave}
                            </td>
                            <td
                              style={{
                                padding: "4px 8px",
                                fontWeight: "bold",
                                color: isPositive ? "#008000" : num < 0 ? "#cc0000" : "#333",
                              }}
                            >
                              {isPositive ? `+${num.toFixed(2)}` : num.toFixed(2)} pts
                            </td>
                            <td style={{ padding: "4px 8px", fontSize: "10px", color: "#666" }}>
                              {num >= 20
                                ? "🌟 Ultra-Premium Bingo Core"
                                : num >= 10
                                ? "⭐ High Equity Core"
                                : num > 0
                                ? "✔ Positive Retention"
                                : num > -5
                                ? "⚠ Moderate Penalty"
                                : "🚨 Severe Tile Dump Penalty"}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                              <button
                                className="win98-button"
                                style={{ padding: "1px 6px", fontSize: "10px", color: "#cc0000" }}
                                onClick={() => handleSaveWeight(leave, 0)}
                                title="Zero out or remove"
                              >
                                ✕ Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM LEXICON & GADDAG COMPILER */}
          {activeTab === "lexicon" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                className="win98-inset"
                style={{
                  padding: "6px 10px",
                  backgroundColor: "#f5f5f5",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "bold", color: "#000080" }}>
                  Native Rust GADDAG Lexicon Compiler (.txt ➔ .bin)
                </div>
                <div style={{ fontSize: "10px", color: "#555" }}>
                  Compiles plain-text dictionaries directly into flat Little-Endian GADDAG graphs with bidirectional
                  prefix/suffix lookups in sub-microsecond latency.
                </div>
              </div>

              {/* Status / Error */}
              {compileError && (
                <div
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    backgroundColor: "#ffe8e8",
                    color: "#cc0000",
                    border: "1px solid #cc0000",
                  }}
                >
                  ⚠ {compileError}
                </div>
              )}

              {/* Compilation Stats Card */}
              {compileStats && (
                <div
                  className="win98-inset"
                  style={{
                    padding: "8px",
                    backgroundColor: "#e8ffe8",
                    border: "1px solid #006600",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#006600", fontSize: "12px", marginBottom: "4px" }}>
                    ✓ Custom Lexicon Compiled &amp; Loaded Successfully!
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "8px",
                      fontSize: "11px",
                    }}
                  >
                    <div>
                      Words Parsed: <strong>{compileStats.word_count.toLocaleString()}</strong>
                    </div>
                    <div>
                      GADDAG Nodes: <strong>{compileStats.node_count.toLocaleString()}</strong>
                    </div>
                    <div>
                      Binary Size:{" "}
                      <strong>{(compileStats.byte_size / (1024 * 1024)).toFixed(2)} MB</strong>
                    </div>
                    <div>
                      Compile Time: <strong>{compileStats.elapsed_ms}ms</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "10px", color: "#004d00" }}>
                    Active Lexicon is now <strong>CUSTOM (.bin)</strong>. The board solver will immediately use this lexicon for all rack evaluations.
                  </div>
                </div>
              )}

              {/* Input Action Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="win98-button"
                    onClick={() => {
                      setWordListInput(SAMPLE_TWO_LETTER_WORDS);
                      playTileClack();
                    }}
                  >
                    Load Sample 2-Letter Words (107 words)
                  </button>
                  <button
                    className="win98-button"
                    onClick={() => {
                      setWordListInput(SAMPLE_HIGH_STEMS);
                      playTileClack();
                    }}
                  >
                    Load Sample Bingo Stems (26 words)
                  </button>
                  <label className="win98-button" style={{ cursor: "pointer", margin: 0 }}>
                    📂 Upload .txt Lexicon...
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                <div style={{ fontSize: "10px", color: "#555" }}>
                  Line count: {wordListInput ? wordListInput.split(/\r?\n/).filter(Boolean).length : 0}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                className="win98-input"
                style={{
                  height: "220px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: "1.3",
                  padding: "6px",
                  whiteSpace: "pre",
                }}
                placeholder="Paste plain-text word list (one word per line, A-Z only)..."
                value={wordListInput}
                onChange={(e) => setWordListInput(e.target.value.toUpperCase())}
              />

              {/* Compile Button */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                <button
                  className="win98-button"
                  style={{
                    fontWeight: "bold",
                    padding: "6px 18px",
                    fontSize: "12px",
                    color: "#000080",
                  }}
                  disabled={isCompiling || !wordListInput.trim()}
                  onClick={handleCompileGaddag}
                >
                  {isCompiling ? "Compiling into GADDAG Nodes..." : "⚡ Compile & Load Custom GADDAG (.bin)"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: M1 HARDWARE & WORKER SCALER */}
          {activeTab === "scaler" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                className="win98-inset"
                style={{
                  padding: "6px 10px",
                  backgroundColor: "#f5f5f5",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "bold", color: "#000080" }}>
                  Apple Silicon M1 Multi-Threaded Rayon Architecture
                </div>
                <div style={{ fontSize: "10px", color: "#555" }}>
                  Fine-tune parallel work-stealing pools across Apple M1 Firestorm (P) and Icestorm (E) cores.
                </div>
              </div>

              {/* Feedback toast */}
              {scalerMessage && (
                <div
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    backgroundColor: "#e8ffe8",
                    color: "#006600",
                    border: "1px solid #006600",
                  }}
                >
                  {scalerMessage}
                </div>
              )}

              {/* Diagnostics Grid */}
              <fieldset className="win98-fieldset" style={{ margin: 0 }}>
                <legend>System Telemetry &amp; Vector Diagnostics</legend>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px",
                    fontSize: "11px",
                  }}
                >
                  <div>
                    Host Platform: <strong>{systemSpecs.os}</strong>
                  </div>
                  <div>
                    CPU Architecture: <strong>{systemSpecs.cpu_arch}</strong>
                  </div>
                  <div>
                    Hardware Logical Cores: <strong>{systemSpecs.logical_cores} Cores</strong>
                  </div>
                  <div>
                    Active Rayon Worker Threads:{" "}
                    <strong style={{ color: "#000080" }}>{systemSpecs.active_workers} Workers</strong>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    Vector Acceleration: <strong>{systemSpecs.simd_feature}</strong>
                  </div>
                </div>
              </fieldset>

              {/* Worker Threads Slider */}
              <fieldset className="win98-fieldset" style={{ margin: 0 }}>
                <legend>Rayon Worker Thread Scaler</legend>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                      Allocated Solver Threads:{" "}
                      <span style={{ color: "#000080", fontSize: "14px" }}>{sliderThreads}</span>
                      {sliderThreads === 8
                        ? " (All 4 P-Cores + 4 E-Cores - Maximum Speed)"
                        : sliderThreads === 4
                        ? " (4 Firestorm Performance Cores)"
                        : sliderThreads === 1
                        ? " (Serial Single-Threaded)"
                        : " (Custom Parallel Pool)"}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max={Math.max(8, systemSpecs.logical_cores)}
                    value={sliderThreads}
                    onChange={(e) => handleSliderChange(e.target.value)}
                    style={{ width: "100%", cursor: "pointer" }}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#666" }}>
                    <span>1 Thread (Minimal)</span>
                    <span>4 Cores (Firestorm)</span>
                    <span>8 Cores (Full M1 SoC)</span>
                  </div>

                  {/* Preset Quick Buttons */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <button
                      className="win98-button"
                      onClick={() => handleSliderChange(8)}
                      style={{ fontWeight: sliderThreads === 8 ? "bold" : "normal" }}
                    >
                      🚀 8 Cores (Full Throttle)
                    </button>
                    <button
                      className="win98-button"
                      onClick={() => handleSliderChange(4)}
                      style={{ fontWeight: sliderThreads === 4 ? "bold" : "normal" }}
                    >
                      🔋 4 Cores (P-Cores / Low Heat)
                    </button>
                    <button
                      className="win98-button"
                      onClick={() => handleSliderChange(1)}
                      style={{ fontWeight: sliderThreads === 1 ? "bold" : "normal" }}
                    >
                      🐌 1 Core (Single-Threaded)
                    </button>
                  </div>
                </div>
              </fieldset>

              {/* Architectural Explanation */}
              <div
                className="win98-inset"
                style={{
                  padding: "8px",
                  fontSize: "11px",
                  lineHeight: "1.4",
                  backgroundColor: "#ffffe1",
                  color: "#333",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#000" }}>
                  💡 Apple Silicon M1 Hardware Optimization Notes:
                </div>
                <div>
                  • <strong>Unified Memory Architecture (UMA):</strong> The GADDAG graph resides in shared L1/L2 cache without PCIe bus transfers, allowing sub-microsecond cross-word traversals.
                </div>
                <div>
                  • <strong>Firestorm &amp; Icestorm Split:</strong> Rayon distributes the 225 Scrabble anchor points across both core clusters. Performance cores finish heavy anchors, while efficiency cores consume shallow corridors without draining battery.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 10px",
            background: "var(--w98-surface, #c0c0c0)",
            borderTop: "2px solid #ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "10px", color: "#555" }}>
            Press <strong>Esc</strong> to close
          </div>
          <button
            className="win98-button"
            style={{ minWidth: "80px", padding: "4px 16px", fontWeight: "bold" }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
