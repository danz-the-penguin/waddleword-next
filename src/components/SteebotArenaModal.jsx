// src/components/SteebotArenaModal.jsx - Interactive Spar vs AI Arena & Live Coaching Modal
import React, { useState, useMemo } from "react";
import { generateMatchCoachingReport } from "../lib/coachingEngine";

export const BOT_PROFILES = {
  hastybot: {
    id: "hastybot",
    name: "HastyBot",
    fullName: "HastyBot • World Championship Grandmaster",
    avatar: "⚡",
    avgScore: "460 Point Average",
    rating: "460 Pt Avg (Woogles.io)",
    simQuality: "hastybot",
    desc: "Championship M1 2-Ply Playout Rollouts (300 trials) • Highest scoring bot on Woogles.io",
    optionLabel: "⚡ HastyBot (460 Pt Avg • Championship M1 300 Playouts)",
  },
  steebot: {
    id: "steebot",
    name: "STEEBot",
    fullName: "STEEBot • Expert Tournament AI",
    avatar: "🤖",
    avgScore: "410 Point Average",
    rating: "410 Pt Avg (Woogles.io)",
    simQuality: "steebot",
    desc: "Deep M1 Monte Carlo simulation (120 trials) • High tactical precision & corridor defense",
    optionLabel: "🤖 STEEBot (410 Pt Avg • Deep M1 120 Playouts)",
  },
  betterbot: {
    id: "betterbot",
    name: "BetterBot",
    fullName: "BetterBot • Advanced Club Competitor",
    avatar: "🧠",
    avgScore: "370 Point Average",
    rating: "370 Pt Avg (Woogles.io)",
    simQuality: "betterbot",
    desc: "Standard leave equity matrix & non-linear V/C equilibrium (40 trials)",
    optionLabel: "🧠 BetterBot (370 Pt Avg • Standard Leave Equity)",
  },
  basicbot: {
    id: "basicbot",
    name: "BasicBot",
    fullName: "BasicBot • Intermediate Club Contender",
    avatar: "⚖️",
    avgScore: "330 Point Average",
    rating: "330 Pt Avg (Woogles.io)",
    simQuality: "basicbot",
    desc: "Standard 1-Ply strategic evaluation • Balanced fundamentals & consistent scoring",
    optionLabel: "⚖️ BasicBot (330 Pt Avg • Balanced 1-Ply)",
  },
  beginnerbot: {
    id: "beginnerbot",
    name: "BeginnerBot",
    fullName: "BeginnerBot • Casual Learner (Greedy AI)",
    avatar: "🐣",
    avgScore: "240 Point Average",
    rating: "240 Pt Avg (Woogles.io)",
    simQuality: "beginnerbot",
    desc: "Fast greedy board score maximizer • Great for beginners learning board layouts",
    optionLabel: "🐣 BeginnerBot (240 Pt Avg • Greedy Blitz)",
  },
};

export function getBotProfile(key) {
  if (!key) return BOT_PROFILES.hastybot;
  const k = key.toLowerCase();
  if (BOT_PROFILES[k]) return BOT_PROFILES[k];
  if (k === "championship" || k === "championship_m1") return BOT_PROFILES.hastybot;
  if (k === "deep") return BOT_PROFILES.steebot;
  if (k === "standard") return BOT_PROFILES.betterbot;
  if (k === "blitz") return BOT_PROFILES.beginnerbot;
  return BOT_PROFILES.hastybot;
}

export default function SteebotArenaModal({
  isOpen,
  onClose,
  isSparringActive,
  onStartSparring,
  onStopSparring,
  onTriggerBotMove,
  isBotThinking,
  myScore,
  oppScore,
  bagCount,
  matchHistory = [],
  activeLexicon = "twl06",
  simQuality = "championship",
  onSetSimQuality,
  onReplayHistoricalTurn,
}) {
  const [activeTab, setActiveTab] = useState("arena"); // "arena" | "timeline" | "report"
  const [difficulty, setDifficulty] = useState(simQuality || "championship");
  const [whoFirst, setWhoFirst] = useState("me");

  const activeBot = getBotProfile(difficulty);

  const report = useMemo(() => {
    return generateMatchCoachingReport(matchHistory);
  }, [matchHistory]);

  if (!isOpen) return null;

  const handleStartGame = () => {
    onStartSparring?.({
      difficulty,
      botProfile: activeBot,
      whoFirst,
      lexicon: activeLexicon,
    });
    setActiveTab("arena");
  };

  const isMyTurn = !isBotThinking && (matchHistory.length % 2 === (whoFirst === "me" ? 0 : 1));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="win98-window"
        style={{
          width: "720px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "4px 4px 10px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div className="win98-titlebar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{activeBot.avatar}</span>
            <span style={{ fontWeight: "bold" }}>
              Spar vs {activeBot.name} — AI Arena &amp; Coaching
            </span>
          </div>
          <button className="win98-btn-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: "2px", padding: "6px 8px 0 8px", backgroundColor: "#c0c0c0", borderBottom: "2px solid #808080" }}>
          <button
            className={`win98-button ${activeTab === "arena" ? "active-tab" : ""}`}
            style={{
              padding: "4px 12px",
              fontWeight: activeTab === "arena" ? "bold" : "normal",
              borderBottom: activeTab === "arena" ? "none" : undefined,
              backgroundColor: activeTab === "arena" ? "#ece9d8" : undefined,
            }}
            onClick={() => setActiveTab("arena")}
          >
            🎮 Sparring Arena
          </button>
          <button
            className={`win98-button ${activeTab === "timeline" ? "active-tab" : ""}`}
            style={{
              padding: "4px 12px",
              fontWeight: activeTab === "timeline" ? "bold" : "normal",
              borderBottom: activeTab === "timeline" ? "none" : undefined,
              backgroundColor: activeTab === "timeline" ? "#ece9d8" : undefined,
            }}
            onClick={() => setActiveTab("timeline")}
          >
            📈 Turn Equity Timeline ({report.totalTurns})
          </button>
          <button
            className={`win98-button ${activeTab === "report" ? "active-tab" : ""}`}
            style={{
              padding: "4px 12px",
              fontWeight: activeTab === "report" ? "bold" : "normal",
              borderBottom: activeTab === "report" ? "none" : undefined,
              backgroundColor: activeTab === "report" ? "#ece9d8" : undefined,
            }}
            onClick={() => setActiveTab("report")}
          >
            🎓 Coaching Report ({report.letterGrade})
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "12px", overflowY: "auto", flex: 1, backgroundColor: "#ece9d8" }}>
          {/* TAB 1: SPARRING ARENA */}
          {activeTab === "arena" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Bot Profile Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  backgroundColor: "#ffffff",
                  border: "2px inset #dfdfdf",
                  borderRadius: "2px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ fontSize: "32px" }}>{activeBot.avatar}</div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#000080" }}>
                      {activeBot.fullName}
                    </div>
                    <div style={{ fontSize: "11px", color: "#555" }}>
                      Rating: <strong>{activeBot.rating}</strong> &bull; {activeBot.desc}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      backgroundColor: isSparringActive ? "#e8f5e9" : "#eee",
                      color: isSparringActive ? "#1b5e20" : "#666",
                      border: `1px solid ${isSparringActive ? "#81c784" : "#ccc"}`,
                      borderRadius: "2px",
                      fontWeight: "bold",
                    }}
                  >
                    {isSparringActive ? "● MATCH IN PROGRESS" : "○ READY TO PLAY"}
                  </span>
                </div>
              </div>

              {/* Match Scoreboard */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "8px",
                  backgroundColor: "#ffffff",
                  padding: "10px",
                  border: "2px inset #dfdfdf",
                }}
              >
                {/* You */}
                <div style={{ textAlign: "center", borderRight: "1px solid #ddd", paddingRight: "6px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1565c0" }}>👤 You</div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1b5e20", fontFamily: "monospace" }}>
                    {myScore}
                  </div>
                  <div style={{ fontSize: "10px", color: "#666" }}>
                    Bingos: <strong>{report.playerBingos}</strong>
                  </div>
                </div>

                {/* Match Status */}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: "10px", color: "#888", textTransform: "uppercase", fontWeight: "bold" }}>
                    Point Spread
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: report.spread >= 0 ? "#1b5e20" : "#b71c1c",
                    }}
                  >
                    {report.spread > 0 ? `+${report.spread}` : report.spread}
                  </div>
                  <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
                    Bag: <strong>{bagCount}</strong> &bull; Turn <strong>{matchHistory.length + 1}</strong>
                  </div>
                </div>

                {/* Opponent Bot */}
                <div style={{ textAlign: "center", borderLeft: "1px solid #ddd", paddingLeft: "6px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#c62828" }}>
                    {activeBot.avatar} {activeBot.name}
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: "#b71c1c", fontFamily: "monospace" }}>
                    {oppScore}
                  </div>
                  <div style={{ fontSize: "10px", color: "#666" }}>
                    Bingos: <strong>{report.oppBingos}</strong>
                  </div>
                </div>
              </div>

              {/* Match Control Panel */}
              <fieldset className="win98-fieldset" style={{ margin: 0, padding: "8px" }}>
                <legend>Match Setup &amp; AI Sparring Partner</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                      AI Opponent &amp; Engine Level:
                    </label>
                    <select
                      className="win98-input"
                      style={{ width: "100%", padding: "3px" }}
                      value={difficulty}
                      onChange={(e) => {
                        setDifficulty(e.target.value);
                        onSetSimQuality?.(e.target.value);
                      }}
                      disabled={isSparringActive}
                    >
                      {Object.values(BOT_PROFILES).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.optionLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                      First Turn (Opening Move):
                    </label>
                    <select
                      className="win98-input"
                      style={{ width: "100%", padding: "3px" }}
                      value={whoFirst}
                      onChange={(e) => setWhoFirst(e.target.value)}
                      disabled={isSparringActive}
                    >
                      <option value="me">👤 You First</option>
                      <option value="opp">{activeBot.avatar} {activeBot.name} First</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* AI Status & Actions */}
              <div
                style={{
                  padding: "8px",
                  backgroundColor: isBotThinking ? "#fff3e0" : "#ffffff",
                  border: "1px solid #ccc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  {isBotThinking ? (
                    <>
                      <span className="blink">⏳</span>
                      <strong style={{ color: "#e65100" }}>
                        {activeBot.name} is calculating optimal play...
                      </strong>
                    </>
                  ) : (
                    <>
                      <span>{isMyTurn ? "👉" : activeBot.avatar}</span>
                      <span>
                        {isMyTurn
                          ? "It is your turn! Place words on the board and click Commit."
                          : `It is ${activeBot.name}'s turn.`}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  {!isMyTurn && !isBotThinking && (
                    <button
                      className="win98-button"
                      style={{ fontWeight: "bold", color: "#b71c1c" }}
                      onClick={onTriggerBotMove}
                    >
                      ⚡ Trigger Bot Move
                    </button>
                  )}
                  {isSparringActive ? (
                    <button className="win98-button" onClick={onStopSparring}>
                      🛑 End Match
                    </button>
                  ) : (
                    <button
                      className="win98-button"
                      style={{ fontWeight: "bold", color: "#1b5e20", padding: "4px 14px" }}
                      onClick={handleStartGame}
                    >
                      🚀 Start New Match
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Coaching Summary Tile */}
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "#f4f6f9",
                  border: "1px solid #b0bec5",
                  fontSize: "11px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  Accuracy: <strong style={{ color: "#1b5e20" }}>{report.accuracyPct}%</strong> &bull; Total Conceded:{" "}
                  <strong style={{ color: "#b71c1c" }}>-{report.totalEquityLoss} pts</strong> &bull; Blunders:{" "}
                  <strong style={{ color: report.blunderCount > 0 ? "#b71c1c" : "#1b5e20" }}>
                    {report.blunderCount}
                  </strong>
                </div>
                <button
                  className="win98-button"
                  style={{ fontSize: "10px", padding: "2px 8px" }}
                  onClick={() => setActiveTab("report")}
                >
                  View Full Report &rarr;
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE TURN-BY-TURN TIMELINE */}
          {activeTab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "12px", color: "#333", fontWeight: "bold", marginBottom: "4px" }}>
                Turn-by-Turn Equity &amp; Coaching Feed:
              </div>

              {report.evaluatedTurns.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#666", backgroundColor: "#fff", border: "1px inset #ccc" }}>
                  No player turns recorded in this session yet. Make moves on the board or start a match!
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "2px inset #dfdfdf",
                    maxHeight: "350px",
                    overflowY: "auto",
                  }}
                >
                  {report.evaluatedTurns.map((turn, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid #eee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: turn.loss >= 17 ? "#ffebee" : turn.loss >= 7.5 ? "#fff3e0" : undefined,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#888", width: "45px" }}>
                          Turn #{turn.turnNum}
                        </span>
                        <div>
                          <strong>{turn.word}</strong>{" "}
                          <span style={{ color: "#1b5e20", fontWeight: "bold" }}>+{turn.score} pts</span>
                          {turn.optimalPlay && (
                            <span style={{ fontSize: "10px", color: "#666", marginLeft: "6px" }}>
                              (Steebot line: <strong>{turn.optimalPlay.word}</strong> for +{turn.optimalPlay.score})
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            padding: "1px 5px",
                            borderRadius: "2px",
                            fontWeight: "bold",
                            backgroundColor:
                              turn.loss <= 0.8
                                ? "#e8f5e9"
                                : turn.loss <= 2.8
                                ? "#e3f2fd"
                                : turn.loss <= 7.5
                                ? "#fff3e0"
                                : "#ffebee",
                            color:
                              turn.loss <= 0.8
                                ? "#1b5e20"
                                : turn.loss <= 2.8
                                ? "#0d47a1"
                                : turn.loss <= 7.5
                                ? "#e65100"
                                : "#b71c1c",
                            border: `1px solid ${
                              turn.loss <= 0.8
                                ? "#a5d6a7"
                                : turn.loss <= 2.8
                                ? "#90caf9"
                                : turn.loss <= 7.5
                                ? "#ffcc80"
                                : "#ef9a9a"
                            }`,
                          }}
                        >
                          {turn.loss <= 0.8
                            ? "🌟 GM"
                            : turn.loss <= 2.8
                            ? "👍 STRONG"
                            : turn.loss <= 7.5
                            ? `⚠️ -${turn.loss}`
                            : `🛑 -${turn.loss}`}
                        </span>
                        {onReplayHistoricalTurn && (
                          <button
                            className="win98-button"
                            style={{ fontSize: "9px", padding: "1px 4px" }}
                            onClick={() => onReplayHistoricalTurn(idx)}
                            title="Replay this position on board"
                          >
                            Replay
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: POST-GAME COACHING REPORT */}
          {activeTab === "report" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Grandmaster Grade Certificate Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  backgroundColor: "#ffffff",
                  border: `2px solid ${report.gradeColor}`,
                  borderRadius: "2px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>
                    Performance Evaluation
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: report.gradeColor }}>
                    {report.gradeTitle}
                  </div>
                  <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>
                    Average equity concession: <strong>{report.avgLoss} pts/turn</strong> &bull; Overall match accuracy:{" "}
                    <strong>{report.accuracyPct}%</strong>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: "bold",
                    color: report.gradeColor,
                    border: `3px solid ${report.gradeColor}`,
                    borderRadius: "50%",
                    width: "56px",
                    height: "56px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  {report.letterGrade}
                </div>
              </div>

              {/* Metric Breakdown Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: "6px",
                }}
              >
                <div style={{ backgroundColor: "#ffffff", padding: "8px", border: "1px inset #ccc", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "#666", fontWeight: "bold" }}>GM Moves</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1b5e20" }}>
                    {report.gmCount + report.strongCount}
                  </div>
                  <div style={{ fontSize: "9px", color: "#888" }}>of {report.totalTurns} turns</div>
                </div>

                <div style={{ backgroundColor: "#ffffff", padding: "8px", border: "1px inset #ccc", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "#666", fontWeight: "bold" }}>Inaccuracies</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#e65100" }}>
                    {report.inaccuracyCount}
                  </div>
                  <div style={{ fontSize: "9px", color: "#888" }}>2.5 - 7.5 pts loss</div>
                </div>

                <div style={{ backgroundColor: "#ffffff", padding: "8px", border: "1px inset #ccc", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "#666", fontWeight: "bold" }}>Mistakes</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#b71c1c" }}>
                    {report.mistakeCount}
                  </div>
                  <div style={{ fontSize: "9px", color: "#888" }}>7.5 - 17.0 pts loss</div>
                </div>

                <div style={{ backgroundColor: "#ffffff", padding: "8px", border: "1px inset #ccc", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "#666", fontWeight: "bold" }}>Blunders</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#c62828" }}>
                    {report.blunderCount}
                  </div>
                  <div style={{ fontSize: "9px", color: "#888" }}>&gt; 17.0 pts loss</div>
                </div>
              </div>

              {/* Top Missed Opportunities / Blunders */}
              <fieldset className="win98-fieldset" style={{ margin: 0, padding: "8px" }}>
                <legend>Top Missed Opportunities &amp; Key Lessons</legend>
                {report.topBlunders.length === 0 ? (
                  <div style={{ padding: "8px", fontSize: "11px", color: "#1b5e20", fontWeight: "bold" }}>
                    🌟 Excellent play! No significant blunders (&ge; 3.0 pts) detected in this match.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {report.topBlunders.map((b, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #ffcc80",
                          borderRadius: "2px",
                          fontSize: "11px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                          <span style={{ fontWeight: "bold", color: "#b71c1c" }}>
                            Turn #{b.turnNum}: Played {b.word} (+{b.score} pts)
                          </span>
                          <span style={{ fontWeight: "bold", color: "#b71c1c" }}>
                            Conceded -{b.loss} pts
                          </span>
                        </div>
                        <div style={{ color: "#333" }}>
                          Steebot&apos;s Grandmaster choice was{" "}
                          <strong style={{ color: "#1b5e20" }}>{b.optimalPlay?.word}</strong> (
                          {b.optimalPlay?.score} pts, +{b.optimalPlay?.val} equity)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#c0c0c0",
            borderTop: "2px solid #808080",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "11px", color: "#555" }}>
            Sparring bot personas &amp; scoring averages modeled after and credited to <strong>Woogles.io</strong> &bull; M1 Rayon Rollouts
          </div>
          <button className="win98-button" style={{ width: "90px" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
