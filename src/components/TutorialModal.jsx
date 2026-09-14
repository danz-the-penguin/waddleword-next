// src/components/TutorialModal.jsx - Comprehensive Engine Tutorial & Tactical Math Guide
import React, { useState } from "react";
import { useDraggable } from "../hooks/useDraggable";

/**
 * TutorialModal - Comprehensive Windows 98 guide covering:
 * 1. How to Use WaddleWord Next (Board interaction, keyboard shortcuts, tournament tools)
 * 2. How the Engine Thinks (GADDAG, Rayon M1 work-pooling, leave equity, V/C balance, multi-ply playouts)
 * 3. Spar vs Steebot Arena & Live Coaching (Head-to-head match play, bag tracking, live equity gap)
 * 4. Tactical Badges & Indicators (Complete visual catalog and decision thresholds)
 */
export default function TutorialModal({ isOpen, onClose }) {
  const { position, handlePointerDown } = useDraggable();
  const [activeTab, setActiveTab] = useState("guide"); // "guide" | "engine" | "sparring" | "badges"
  const [badgeSearch, setBadgeSearch] = useState("");

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
        padding: "8px",
        width: "740px",
        maxWidth: "96vw",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "4px 4px 14px rgba(0,0,0,0.6)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Win98 Titlebar */}
      <div
        className="win98-titlebar"
        onPointerDown={handlePointerDown}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>📚</span>
          <strong style={{ letterSpacing: "0.5px" }}>
            WaddleWord Next — Grandmaster Engine Guide &amp; Tactical Reference
          </strong>
        </div>
        <button
          className="win98-button win98-btn-sys"
          onClick={onClose}
          title="Close Tutorial"
        >
          ✕
        </button>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "4px 6px 0 6px",
          backgroundColor: "#c0c0c0",
          borderBottom: "2px solid #808080",
          userSelect: "none",
          flexWrap: "wrap",
        }}
      >
        <button
          className={`win98-button ${activeTab === "guide" ? "active-tab" : ""}`}
          style={{
            padding: "4px 10px",
            fontWeight: activeTab === "guide" ? "bold" : "normal",
            borderBottom: activeTab === "guide" ? "none" : undefined,
            backgroundColor: activeTab === "guide" ? "#ece9d8" : undefined,
            fontSize: "11px",
          }}
          onClick={() => setActiveTab("guide")}
        >
          🎮 Controls &amp; Workflow
        </button>
        <button
          className={`win98-button ${activeTab === "engine" ? "active-tab" : ""}`}
          style={{
            padding: "4px 10px",
            fontWeight: activeTab === "engine" ? "bold" : "normal",
            borderBottom: activeTab === "engine" ? "none" : undefined,
            backgroundColor: activeTab === "engine" ? "#ece9d8" : undefined,
            fontSize: "11px",
          }}
          onClick={() => setActiveTab("engine")}
        >
          🧠 How the Engine Thinks
        </button>
        <button
          className={`win98-button ${activeTab === "sparring" ? "active-tab" : ""}`}
          style={{
            padding: "4px 10px",
            fontWeight: activeTab === "sparring" ? "bold" : "normal",
            borderBottom: activeTab === "sparring" ? "none" : undefined,
            backgroundColor: activeTab === "sparring" ? "#ece9d8" : undefined,
            fontSize: "11px",
          }}
          onClick={() => setActiveTab("sparring")}
        >
          🤖 Spar vs Steebot &amp; Coaching
        </button>
        <button
          className={`win98-button ${activeTab === "badges" ? "active-tab" : ""}`}
          style={{
            padding: "4px 10px",
            fontWeight: activeTab === "badges" ? "bold" : "normal",
            borderBottom: activeTab === "badges" ? "none" : undefined,
            backgroundColor: activeTab === "badges" ? "#ece9d8" : undefined,
            fontSize: "11px",
          }}
          onClick={() => setActiveTab("badges")}
        >
          🏷️ Badges &amp; Indicators
        </button>
      </div>

      {/* Main Content Area */}
      <div
        className="win98-inset"
        style={{
          padding: "14px 16px",
          fontSize: "12px",
          lineHeight: "1.6",
          backgroundColor: "#ffffff",
          overflowY: "auto",
          flex: "1 1 auto",
          minHeight: "360px",
        }}
      >
        {/* ============================================================ */}
        {/* TAB 1: CONTROLS & WORKFLOW                                  */}
        {/* ============================================================ */}
        {activeTab === "guide" && (
          <div>
            <h3
              style={{
                margin: "0 0 8px 0",
                color: "var(--w98-title-start)",
                fontSize: "14px",
                borderBottom: "1px solid #c0c0c0",
                paddingBottom: "4px",
              }}
            >
              🎮 How to Use WaddleWord Next: Complete User Operations Guide
            </h3>

            {/* Section 1: Placing Moves */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                1. Placing Tiles on the Board
              </legend>
              <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Direct Keyboard Typing:</strong> Click any board square (or use the Arrow keys). Type uppercase letters <code>A–Z</code>. Tiles immediately appear on the board with audio clacks.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Typing Direction:</strong> Press <code>Spacebar</code> or <code>Shift+Arrow</code> (or click the active cell again) to toggle between Across (►) and Down (▼).
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Wildcard Blanks:</strong> Press <code>?</code> or <code>/</code> to open the Blank Selector, or simply hold <code>Shift</code> and type a lowercase letter (e.g. <code>e</code> appears as a blank tile worth 0 pts).
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Click-to-Place / Drag-and-Drop:</strong> Click any letter on your rack tray to highlight it, then click an empty board square to place it. You can also drag and drop tiles between the board and rack.
                </li>
                <li>
                  <strong>Committing &amp; Reverting:</strong> When tiles are placed, the green Commit HUD displays the word and score. Press <code>Enter</code> (or click <strong>✔ Commit</strong>) to commit the move, or press <code>Esc</code> to cancel and recall uncommitted tiles to your rack.
                </li>
              </ul>
            </fieldset>

            {/* Section 2: Candidate Plays & Solver */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                2. Exploring Engine Move Recommendations
              </legend>
              <p style={{ margin: "0 0 6px 0" }}>
                As soon as your rack or board changes, the native Rust GADDAG solver computes all legal moves in real time:
              </p>
              <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Keyboard Browsing:</strong> Press <code>↑</code> and <code>↓</code> arrows to navigate the candidate plays list without clicking.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Ghost Preview:</strong> Hover over any move (or press <code>Tab</code>) to preview ghost tiles directly on the board, showing exactly where and how the word intersects existing tiles.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>One-Click Apply:</strong> Click any candidate card (or press <code>Enter</code> while highlighted) to immediately commit that play onto the board and update the match score.
                </li>
                <li>
                  <strong>Dictionary Word Hooks:</strong> Hover over any played word in the list to reveal valid front and back letter hooks (e.g. <code>[P] + LANE + [D, R, S]</code>) and full definitions via Collins / TWL06.
                </li>
              </ul>
            </fieldset>

            {/* Section 3: Rack Organization & Strategic Exchanges */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                3. Rack Management &amp; Strategic Tile Exchanges
              </legend>
              <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Instant Organization:</strong> Use the rack tray buttons: <strong>V/C</strong> (groups vowels on the left, consonants on the right), <strong>A-Z</strong> (alphabetical sort), or <strong>Shuffle</strong> (randomizes letter order).
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Strategic Tile Exchange:</strong> When stuck with unplayable consonants or vowel floods (e.g. <code>IIIVW</code>), the engine evaluates all 127 tile combinations. If an exchange is mathematically superior to playing on the board, an eye-catching purple recommendation card appears at the top of the move list.
                </li>
                <li>
                  <strong>Auto-Optimize Swap:</strong> Click <strong>Exchange Tiles</strong> on the rack tray, then click <strong>⚡ Auto-Optimize Swap</strong> to automatically select the optimal clunker tiles to return to the bag.
                </li>
              </ul>
            </fieldset>

            {/* Section 4: Tournament Tools & Safety */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "8px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                4. Tournament Tools &amp; Match Safety
              </legend>
              <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Dual LED Tournament Clock:</strong> Access via <code>Tools ➔ Tournament Chess Clock</code>. Tracks match time per player with overtime penalty calculations (-10 pts per minute over 25:00).
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Tactical Blunder Shield:</strong> Prevents game-losing mistakes by intercepting plays that accidentally open an opponent 9x Triple-Triple corridor (&lt; 50 pts) or waste a wildcard blank (&lt; 20 pts).
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>GCG Match Export/Import:</strong> Save or load tournament match files adhering to the standard POSI / GCG format via <code>File ➔ Export Match to GCG...</code>.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Board Snapshot:</strong> Instantly copy a high-resolution PNG snapshot of the current board to your clipboard via <code>File ➔ Copy Board to Clipboard (Shift+Ctrl+C)</code>.
                </li>
                <li>
                  <strong>Anagram Explorer &amp; Training Studio:</strong> Press <code>Ctrl+F</code> to find sub-anagrams for any rack, or <code>Ctrl+T</code> to fine-tune leave equity tables and compile custom GADDAG dictionaries.
                </li>
              </ul>
            </fieldset>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: HOW THE ENGINE THINKS                                */}
        {/* ============================================================ */}
        {activeTab === "engine" && (
          <div>
            <h3
              style={{
                margin: "0 0 8px 0",
                color: "var(--w98-title-start)",
                fontSize: "14px",
                borderBottom: "1px solid #c0c0c0",
                paddingBottom: "4px",
              }}
            >
              🧠 Under the Hood: Mathematical Architecture &amp; Decision Theory
            </h3>

            {/* GADDAG Graph Search */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                1. The Native Rust GADDAG Engine &amp; Rayon Work-Pooling
              </legend>
              <p style={{ margin: "0 0 6px 0" }}>
                Linear dictionary lookups and DAWG tries are too slow to evaluate bidirectional anchor placements in championship Scrabble. WaddleWord Next compiles lexicons into a native <strong>GADDAG</strong> (invented by Steven Gordon):
              </p>
              <div
                style={{
                  backgroundColor: "#f0f4f8",
                  padding: "6px 10px",
                  borderLeft: "3px solid #000080",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  margin: "6px 0",
                }}
              >
                For word "CARE": stored as E R A C + REV + R E + REV + E + REV ...
                <br />
                Allows the engine to anchor at 'R', build 'A'-'C' to the left, then traverse 'E' to the right in one pass!
              </div>
              <p style={{ margin: "4px 0 0 0" }}>
                On Apple Silicon (M1/M2/M3) and modern multi-core PCs, work is partitioned across all CPU hardware cores using <strong>Rayon work-stealing</strong>, generating and scoring up to 2,500 candidate moves in under 4 milliseconds.
              </p>
            </fieldset>

            {/* The Grandmaster Valuation Formula */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                2. The Grandmaster Valuation Formula
              </legend>
              <p style={{ margin: "0 0 6px 0" }}>
                Greedy engines only maximize immediate points (Score). Grandmaster engines maximize <strong>Terminal Expected Equity (TotalVal)</strong>:
              </p>
              <div
                style={{
                  backgroundColor: "#e8f5e9",
                  border: "1px solid #a5d6a7",
                  padding: "8px 12px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#1b5e20",
                  marginBottom: "8px",
                  textAlign: "center",
                }}
              >
                TotalVal = Score + LeaveEquity + StemBonus - RiskPenalties + RolloutCalibration
              </div>
              <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Immediate Score:</strong> Base points scored on the board, including 2L, 3L, 2W, 3W, and the +50 7-tile Bingo bonus.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Leave Equity:</strong> The statistical value of the tiles left on your rack. Top tournament tiles like <code>S</code> (+7.5 pts) and Wildcard Blanks (<code>?</code>, +25.0 pts) dramatically elevate equity, while awkward tiles like <code>Q</code> (-7.0 pts) or <code>V</code> (-5.5 pts) penalize it.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Rack V/C Equilibrium:</strong> Non-linear penalties are applied if your leave is starved of vowels (0V/6C: -14 pts) or flooded with vowels (5V/1C: -16 pts). Ideal tournament balance is strictly <strong>3V/4C</strong> or <strong>4V/3C</strong>.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Duplicate Clunker Penalties:</strong> Holding duplicate vowels (<code>II</code>: -7.5 pts, <code>UU</code>: -9.0 pts) or harsh consonants (<code>VV</code>: -12.0 pts, <code>WW</code>: -10.0 pts, <code>KK</code>: -9.0 pts) reduces future bingo combinations by over 60%.
                </li>
                <li>
                  <strong>Bingo Stem Affinities:</strong> Premier 6-letter tournament stems (<code>RETINA</code>, <code>TISANE</code>, <code>SATIRE</code>, <code>SATINE</code>) receive up to +6.0 bonus equity because they guarantee an 80%+ bingo probability on the next draw.
                </li>
              </ul>
            </fieldset>

            {/* M1 Multi-Ply Monte Carlo Rollouts */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "8px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                3. M1 Multi-Ply Monte Carlo Playout Rollout Engine ("Championship M1")
              </legend>
              <p style={{ margin: "0 0 6px 0" }}>
                Standard Scrabble solvers only look 1 ply ahead. To defeat championship opponents like Steebot and Quackle, WaddleWord Next executes full <strong>2-Ply Monte Carlo Playout Rollouts</strong>:
              </p>
              <div
                style={{
                  backgroundColor: "#fff3e0",
                  border: "1px solid #ffe0b2",
                  padding: "8px 10px",
                  fontSize: "11px",
                  marginBottom: "8px",
                }}
              >
                <strong>The 2-Ply Playout Pipeline:</strong>
                <ol style={{ margin: "4px 0", paddingLeft: "18px" }}>
                  <li>Sample opponent rack from unseen bag tiles weighted by Bayesian likelihood.</li>
                  <li>Simulate opponent&apos;s optimal counterplay response (M_opp scoring S_opp).</li>
                  <li>Draw replacement tiles from the simulated bag to replenish player&apos;s rack to 7 tiles.</li>
                  <li>Simulate player&apos;s optimal follow-up move (M_p2 scoring S_p2).</li>
                  <li>Compute empirical Net Spread Margin: &Delta;Spread = (S_p1 + S_p2) - S_opp.</li>
                  <li>Evaluate Victory Likelihood: ScoreDiff + &Delta;Spread &gt; 0 &rArr; Win.</li>
                </ol>
              </div>
              <p style={{ margin: "0" }}>
                The result is a calibrated <strong>Win Probability (P(Win))</strong> and <strong>Net Spread Margin</strong> displayed directly on every candidate move card!
              </p>
            </fieldset>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SPARRING & COACHING                                  */}
        {/* ============================================================ */}
        {activeTab === "sparring" && (
          <div>
            <h3
              style={{
                margin: "0 0 8px 0",
                color: "var(--w98-title-start)",
                fontSize: "14px",
                borderBottom: "1px solid #c0c0c0",
                paddingBottom: "4px",
              }}
            >
              🤖 Spar vs Steebot AI &amp; Real-Time Coaching Arena
            </h3>

            {/* Meet Your AI Sparring Partners */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                1. Meet Your AI Sparring Partners (Modeled After &amp; Credited to Woogles.io)
              </legend>
              <div
                style={{
                  backgroundColor: "#e8f4fd",
                  border: "1px solid #90caf9",
                  padding: "6px 10px",
                  borderRadius: "2px",
                  marginBottom: "8px",
                  fontSize: "11px",
                  color: "#0d47a1",
                }}
              >
                🌐 <strong>Woogles.io Benchmark Roster:</strong> The sparring bot lineup and point averages are modeled directly after the official bot roster on <a href="https://woogles.io" target="_blank" rel="noopener noreferrer" style={{ color: "#000080", fontWeight: "bold" }}>Woogles.io</a>, the premier open-source competitive Scrabble platform developed by the word game community.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* HastyBot */}
                <div style={{ padding: "8px 10px", backgroundColor: "#ffffff", border: "1px solid #c2185b", borderRadius: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "18px" }}>⚡</span>
                      <strong style={{ fontSize: "12px", color: "#880e4f" }}>HastyBot &bull; World Championship Grandmaster</strong>
                    </div>
                    <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#fce4ec", color: "#880e4f", border: "1px solid #f48fb1", fontWeight: "bold" }}>
                      460 Point Average &bull; Top-Tier Engine
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333", lineHeight: "1.5" }}>
                    <strong>Engine Architecture:</strong> Championship M1 2-Ply Monte Carlo Playout Rollouts (300 Bayesian iterations on 8-core Rayon work-pool).
                    <br />
                    <strong>Playing Style:</strong> The highest-scoring bot on Woogles.io (averaging 460 points per game). Leverages deep multi-ply playouts to calculate exact victory likelihood ($P(Win)$), net spread margins, premier bingo stem coordination (e.g. <code>RETINA</code>, <code>TISANE</code>), and ruthless endgame minimax outplay.
                  </div>
                </div>

                {/* STEEBot */}
                <div style={{ padding: "8px 10px", backgroundColor: "#ffffff", border: "1px solid #000080", borderRadius: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "18px" }}>🤖</span>
                      <strong style={{ fontSize: "12px", color: "#000080" }}>STEEBot &bull; Expert Tournament AI</strong>
                    </div>
                    <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#e8eaf6", color: "#1a237e", border: "1px solid #9fa8da", fontWeight: "bold" }}>
                      410 Point Average &bull; Deep Rollouts
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333", lineHeight: "1.5" }}>
                    <strong>Engine Architecture:</strong> Deep M1 Monte Carlo simulation (120 playout samples, ~150ms).
                    <br />
                    <strong>Playing Style:</strong> Classical tournament powerhouse (averaging 410 points). Modeled after the legendary STEEBot engine; balances high immediate tactical scoring, aggressive corridor shutdown, and disciplined leave equity preservation.
                  </div>
                </div>

                {/* BetterBot */}
                <div style={{ padding: "8px 10px", backgroundColor: "#ffffff", border: "1px solid #00695c", borderRadius: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "18px" }}>🧠</span>
                      <strong style={{ fontSize: "12px", color: "#004d40" }}>BetterBot &bull; Advanced Club Competitor</strong>
                    </div>
                    <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#e0f2f1", color: "#004d40", border: "1px solid #80cbc4", fontWeight: "bold" }}>
                      370 Point Average &bull; Strategic Leave
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333", lineHeight: "1.5" }}>
                    <strong>Engine Architecture:</strong> Standard leave equity matrix with non-linear V/C equilibrium + 40 playout samples.
                    <br />
                    <strong>Playing Style:</strong> Formidable club-level sparring partner (averaging 370 points). Consistently maintains 3V/4C or 4V/3C rack balance, hoards wildcard blanks, and penalizes duplicate consonant clunkers.
                  </div>
                </div>

                {/* BasicBot */}
                <div style={{ padding: "8px 10px", backgroundColor: "#ffffff", border: "1px solid #e65100", borderRadius: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "18px" }}>⚖️</span>
                      <strong style={{ fontSize: "12px", color: "#e65100" }}>BasicBot &bull; Intermediate Club Contender</strong>
                    </div>
                    <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#fff3e0", color: "#e65100", border: "1px solid #ffb74d", fontWeight: "bold" }}>
                      330 Point Average &bull; Balanced 1-Ply
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333", lineHeight: "1.5" }}>
                    <strong>Engine Architecture:</strong> Standard 1-ply evaluation with basic leave considerations.
                    <br />
                    <strong>Playing Style:</strong> Solid intermediate player (averaging 330 points). Forms common 7-letter words, avoids keeping <code>Q</code> without <code>U</code>, and scores well on open boards, but can be outmaneuvered with defensive corridor management.
                  </div>
                </div>

                {/* BeginnerBot */}
                <div style={{ padding: "8px 10px", backgroundColor: "#ffffff", border: "1px solid #689f38", borderRadius: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "18px" }}>🐣</span>
                      <strong style={{ fontSize: "12px", color: "#33691e" }}>BeginnerBot &bull; Casual Learner (Greedy AI)</strong>
                    </div>
                    <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "#f1f8e9", color: "#33691e", border: "1px solid #c5e1a5", fontWeight: "bold" }}>
                      240 Point Average &bull; Casual Play
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333", lineHeight: "1.5" }}>
                    <strong>Engine Architecture:</strong> Fast greedy point-maximizer (Blitz 12-sample fastpath, ~10ms).
                    <br />
                    <strong>Playing Style:</strong> Hunts strictly for immediate board score (averaging 240 points). Does not calculate rack leave equity or defensive exposure, and frequently opens high-multiplier bonus squares or spends blanks for small points. Ideal for beginners learning board layout and anagramming!
                  </div>
                </div>
              </div>
            </fieldset>

            {/* How Sparring Works */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                2. How to Start a Match Against Any Bot
              </legend>
              <ol style={{ margin: "4px 0", paddingLeft: "18px" }}>
                <li style={{ marginBottom: "4px" }}>
                  Open the Sparring Arena via <code>File ➔ 🤖 Spar vs AI Bot Match...</code> or click the <strong>🤖 Spar Arena</strong> button in the menu bar.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  Choose your opponent: <code>⚡ HastyBot (460 Avg)</code>, <code>🤖 STEEBot (410 Avg)</code>, <code>🧠 BetterBot (370 Avg)</code>, <code>⚖️ BasicBot (330 Avg)</code>, or <code>🐣 BeginnerBot (240 Avg)</code>.
                </li>
                <li style={{ marginBottom: "4px" }}>
                  Choose who plays first (<strong>You</strong> or the <strong>Bot</strong>).
                </li>
                <li style={{ marginBottom: "4px" }}>
                  Click <strong>🎮 Start Sparring Match</strong>. A freshly shuffled 100-tile tournament bag is generated, dealing 7 tiles to you and 7 tiles to the bot.
                </li>
                <li>
                  Play your move on the board (or execute an exchange). Your rack will automatically draw replacement tiles from the bag, and the bot will immediately calculate and play its countermove!
                </li>
              </ol>
            </fieldset>

            {/* Live Turn Equity Feedback */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "12px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                3. Live Turn-by-Turn Equity Gap Bar
              </legend>
              <p style={{ margin: "0 0 6px 0" }}>
                Every time you commit a play, the coaching engine compares your chosen move against Steebot&apos;s #1 optimal line. The equity gap (&Delta;Equity = OptimalEquity - PlayedEquity) is instantly categorized:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", margin: "6px 0" }}>
                <div style={{ padding: "6px", backgroundColor: "#e8f5e9", border: "1px solid #2e7d32" }}>
                  <strong style={{ color: "#1b5e20" }}>🌟 GRANDMASTER MOVE (0.0–0.8 pts)</strong>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Flawless precision! Matches or nearly matches Steebot's top choice.
                  </div>
                </div>
                <div style={{ padding: "6px", backgroundColor: "#e3f2fd", border: "1px solid #1565c0" }}>
                  <strong style={{ color: "#0d47a1" }}>👍 STRONG MOVE (0.9–2.8 pts)</strong>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Solid tournament choice with negligible positional sacrifice.
                  </div>
                </div>
                <div style={{ padding: "6px", backgroundColor: "#fff3e0", border: "1px solid #ef6c00" }}>
                  <strong style={{ color: "#e65100" }}>⚠️ INACCURACY (2.9–7.5 pts)</strong>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Minor mistake in leave preservation or board corridor defense.
                  </div>
                </div>
                <div style={{ padding: "6px", backgroundColor: "#ffebee", border: "1px solid #c62828" }}>
                  <strong style={{ color: "#b71c1c" }}>⚠️ MISTAKE (7.6–17.0 pts)</strong>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Significant equity loss! Sacrificed key bingo stems or premium reach.
                  </div>
                </div>
              </div>
              <div style={{ padding: "6px", backgroundColor: "#b71c1c", color: "#fff", border: "1px solid #7f0000", marginTop: "6px" }}>
                <strong>🛑 CRITICAL BLUNDER (&gt; 17.0 pts)</strong>
                <div style={{ fontSize: "11px", color: "#ffebee" }}>
                  Catastrophic error: opened an unblocked 9x corridor, squandered a wildcard blank, or held unplayable clunkers.
                </div>
              </div>
            </fieldset>

            {/* Post-Match Report Card */}
            <fieldset
              className="win98-fieldset"
              style={{ marginBottom: "8px", backgroundColor: "#fafafa" }}
            >
              <legend style={{ fontWeight: "bold", color: "#000080" }}>
                4. Post-Match Report Card &amp; Turn Scrubbing
              </legend>
              <p style={{ margin: "0 0 6px 0" }}>
                When the match concludes (or anytime via <code>Tools ➔ Spar vs Steebot Arena ➔ Coaching Report</code>), view your full post-match analysis:
              </p>
              <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Official Letter Grade:</strong> Evaluates your overall match accuracy from <code>A+</code> (World Champion Grandmaster, &le; 1.5 avg equity loss) down to <code>D</code> (Developing, &gt; 13.0 avg loss).
                </li>
                <li style={{ marginBottom: "4px" }}>
                  <strong>Turn Equity Timeline:</strong> Interactive chart plotting turn-by-turn equity concessions. Click any turn in the timeline to immediately scrub the board back to that moment and study the optimal play!
                </li>
              </ul>
            </fieldset>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: BADGES & INDICATORS                                  */}
        {/* ============================================================ */}
        {activeTab === "badges" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
                borderBottom: "1px solid #c0c0c0",
                paddingBottom: "4px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--w98-title-start)",
                  fontSize: "14px",
                }}
              >
                🏷️ Tactical Badges &amp; Move Card Indicators Catalog
              </h3>
              <input
                type="text"
                className="win98-input"
                placeholder="🔍 Filter badges..."
                value={badgeSearch}
                onChange={(e) => setBadgeSearch(e.target.value)}
                style={{ width: "160px", padding: "2px 4px", fontSize: "11px" }}
              />
            </div>

            <p style={{ margin: "0 0 10px 0", color: "#555", fontSize: "11px" }}>
              Every candidate play in the Move List is tagged with specialized heuristic badges indicating scoring reach, defensive safety, leave quality, and rollout likelihood:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Monte Carlo Win Prob */}
              {(!badgeSearch || "win prob victory championship rollout".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #c0c0c0", backgroundColor: "#fafafa" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#1b5e20",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      🏆 68.4% Win
                    </span>
                    <strong>Monte Carlo Playout Win Likelihood</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Computed via 2-ply M1 Monte Carlo playouts. Green indicates &ge; 55% win probability; Blue indicates 45–55%; Red indicates &lt; 45%.
                  </div>
                </div>
              )}

              {/* Strategic Exchange */}
              {(!badgeSearch || "strategic exchange swap dump clunker".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #6a1b9a", backgroundColor: "#f3e5f5" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#6a1b9a",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      🔄 STRATEGIC EXCHANGE
                    </span>
                    <strong>Optimal Tile Exchange Recommendation</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Evaluated across all 127 tile combinations. Recommends returning clunkers to the bag when an exchange yields higher 2-turn equity than any board placement.
                  </div>
                </div>
              )}

              {/* Bingo */}
              {(!badgeSearch || "bingo bonus 50 7 tiles".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #90caf9", backgroundColor: "#e3f2fd" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#1565c0",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      BINGO
                    </span>
                    <strong>7-Tile Tournament Bingo Bonus (+50 pts)</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Plays all 7 tiles from the rack in a single turn, earning the official 50-point bonus.
                  </div>
                </div>
              )}

              {/* Power Play */}
              {(!badgeSearch || "power play 50 score".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #ce93d8", backgroundColor: "#f3e5f5" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#8e24aa",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      POWER PLAY
                    </span>
                    <strong>High-Yield Strategic Placement (&ge; 50 pts)</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Scores 50 or more points using fewer than 7 tiles by capitalizing on premium multi-letter / multi-word multipliers.
                  </div>
                </div>
              )}

              {/* Opens 9x Triple-Triple */}
              {(!badgeSearch || "opens 9x triple triple red danger blunder".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #ef5350", backgroundColor: "#ffebee" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#b71c1c",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      ⚠️ OPENS 9X TRIPLE-TRIPLE
                    </span>
                    <strong>Critical Red Corridor Exposure</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Creates an unblocked anchor corridor bridging two Triple Word Score squares. Opponent can counter-bingo for 140–200+ points!
                  </div>
                </div>
              )}

              {/* Blocks 9x */}
              {(!badgeSearch || "blocks 9x defense corridor shutdown".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #2e7d32", backgroundColor: "#e8f5e9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#1b5e20",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      🛡️ BLOCKS 9X
                    </span>
                    <strong>Defensive Corridor Shutdown</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Tactically intercepts and neutralizes a 9x Triple-Triple lane, denying the opponent massive scoring reach.
                  </div>
                </div>
              )}

              {/* Opens 4x Double-Double */}
              {(!badgeSearch || "opens 4x double double orange risk".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #ffb74d", backgroundColor: "#fff3e0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#e65100",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      ⚠️ OPENS 4X DBL-DBL
                    </span>
                    <strong>Orange Corridor Exposure</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Exposes an open Double-Double corridor bridging two Double Word Squares, allowing 70–100 point replies.
                  </div>
                </div>
              )}

              {/* Retain Blank */}
              {(!badgeSearch || "retain blank wildcard diamond cyan".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #00acc1", backgroundColor: "#e0f7fa" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#00838f",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      💎 RETAIN BLANK
                    </span>
                    <strong>Wildcard Blank Preservation</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Preserves the wildcard blank on your rack when a non-blank move achieves nearly identical scoring equity.
                  </div>
                </div>
              )}

              {/* Blank Surcharge */}
              {(!badgeSearch || "blank surcharge penalty burn".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #ff5722", backgroundColor: "#fbe9e7" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#d84315",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      BLANK SURCHARGE (-14)
                    </span>
                    <strong>Premature Blank Expenditure Penalty</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Penalty applied when squandering a wildcard blank on a low-scoring play (&lt; 50 pts) with non-blank alternatives available.
                  </div>
                </div>
              )}

              {/* Poison Leave */}
              {(!badgeSearch || "poison leave clunker toxic negative equity".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #ef5350", backgroundColor: "#ffebee" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#b71c1c",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      ⚠️ POISON LEAVE
                    </span>
                    <strong>Severe Negative Leave Equity (&le; -12 pts)</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Warning: This play leaves harsh, uncooperative letter combinations (such as V+W, duplicate V, or Q without U) that cripple future turns.
                  </div>
                </div>
              )}

              {/* Vowel Flood */}
              {(!badgeSearch || "vowel flood imbalance iii ooo".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #ff9800", backgroundColor: "#fff8e1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#e65100",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      ⚠️ VOWEL FLOOD
                    </span>
                    <strong>Severe Vowel Imbalance</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    Leaves 4+ vowels or triple duplicate vowels on your rack, destroying bingo stem coordination for subsequent turns.
                  </div>
                </div>
              )}

              {/* Exact Endgame vs Threat Estimate */}
              {(!badgeSearch || "endgame intel threat estimate minimax".includes(badgeSearch.toLowerCase())) && (
                <div style={{ padding: "6px 8px", border: "1px solid #78909c", backgroundColor: "#eceff1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#1565c0",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "2px",
                      }}
                    >
                      🎯 EXACT ENDGAME INTEL
                    </span>
                    <strong>Deterministic Minimax (Bag = 0) vs Probabilistic Threat</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#333" }}>
                    When the bag reaches 0 tiles, the opponent rack is 100% known and solved via Alpha-Beta minimax. When bag &gt; 0, Bayesian simulation is indicated by <code>🎲 THREAT ESTIMATE</code>.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "8px",
          paddingTop: "6px",
          borderTop: "1px solid #808080",
        }}
      >
        <div style={{ fontSize: "11px", color: "#555" }}>
          Tip: Press <code>Alt+H</code> to toggle danger corridors | <code>Ctrl+F</code> for Anagram Explorer | <code>Ctrl+T</code> for Training Studio
        </div>
        <button
          className="win98-button"
          onClick={onClose}
          style={{ minWidth: "80px", fontWeight: "bold" }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
