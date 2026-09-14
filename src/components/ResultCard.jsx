import React, { useRef, useEffect } from "react";
import { playBingoChime } from "../lib/soundEffects";

const TILE_SCORES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
  M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8,
  Y: 4, Z: 10,
};

const COLUMNS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"];

function formatPos(row, col, dir) {
  if (dir === "H") return `${row + 1}${COLUMNS[col] || ""}`;
  return `${COLUMNS[col] || ""}${row + 1}`;
}

/**
 * ResultCard - Rich tactical move analysis card with 13 tactical badges.
 * Ported from the original waddleword web app's ResultCard.jsx.
 */
const ResultCard = React.memo(
  ({
    play,
    rank,
    onHover,
    onLeave,
    onClick,
    rack,
    activeLexicon = "twl06",
    activePreset,
    isSelected = false,
  }) => {
    const cardRef = useRef(null);

    useEffect(() => {
      if (isSelected && cardRef.current) {
        cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, [isSelected]);

    const isExch = Boolean(play.dir === "EXCH" || play.is_exchange || (play.word && play.word.startsWith("EXCH ")));
    const cleanRack = rack ? rack.replace(/[^a-zA-Z?]/g, "") : "";
    const leaveLen = !play.leave || play.leave === "None" ? 0 : play.leave.length;
    const tilesUsed = isExch
      ? 0
      : (play.tiles_used ?? play.tilesUsed ?? (play.is_bingo ? 7 : (cleanRack.length ? cleanRack.length - leaveLen : 0)));
    const isBingo = Boolean(play.is_bingo ?? play.isBingo ?? (tilesUsed === 7));

    const leaveStr = play.leave && play.leave !== "None" ? play.leave.toUpperCase() : "";
    const vCount = (leaveStr.match(/[AEIOU]/g) || []).length;
    const hasVW = leaveStr.includes("V") && leaveStr.includes("W");
    const hasVV = (leaveStr.match(/V/g) || []).length >= 2;
    const hasTripleVowel = (leaveStr.match(/I/g) || []).length >= 3 || (leaveStr.match(/U/g) || []).length >= 3 || (leaveStr.match(/O/g) || []).length >= 3;
    const hasQnoU = leaveStr.includes("Q") && !leaveStr.includes("U");
    const isPoisonLeave = !isExch && (hasVW || hasVV || hasQnoU || (play.leave_equity != null && play.leave_equity <= -12.0));
    const isVowelFlood = !isExch && ((leaveLen >= 4 && vCount >= 4) || hasTripleVowel);

    // Position notation
    const isVert = play.is_vertical || play.dir === "V";
    const notation = isExch ? play.word : formatPos(play.row, play.col, isVert ? "V" : "H");
    const colLetter = COLUMNS[play.col] || "";
    const rowNum = play.row + 1;

    // Equity values — handle both snake_case (Rust) and camelCase (JS) field names
    const leaveEquity = play.leave_equity ?? play.leaveEquity ?? 0;
    const totalVal = play.total_val ?? play.totalVal ?? play.score;
    const rawOppReply = play.opp_best_reply_obj ?? play.oppBestReply ?? play.opp_best_reply ?? null;
    const oppReplyWord = typeof rawOppReply === "string" ? rawOppReply : (rawOppReply?.word ?? null);
    const oppBestScore = play.opp_best_score ?? play.oppBestScore ?? (typeof rawOppReply === "object" ? rawOppReply?.score : null);
    const avgOppScore = play.expected_opp_score ?? play.avgOppScore ?? null;
    const isDeterministic = play.is_deterministic_opponent ?? play.isDeterministicOpponent ?? false;

    // Tactical flags (support both snake_case and camelCase)
    const exposes3W = play.exposes_3w ?? play.exposes3W ?? false;
    const opens9X = play.opens_triple_triple ?? play.opensTripleTriple ?? false;
    const opens4X = play.opens_double_double ?? play.opensDoubleDouble ?? false;
    const blocks9X = play.blocks_triple_triple ?? play.blocksTripleTriple ?? false;
    const blocks4X = play.blocks_double_double ?? play.blocksDoubleDouble ?? false;
    const retainsBlank = play.retains_blank ?? play.retainsBlank ?? false;
    const blankSurcharge = play.blank_surcharge_applied ?? play.blankSurchargeApplied ?? false;
    const isEndgameSetup = play.is_endgame_setup ?? play.isEndgameSetup ?? false;
    const isEndgameBait = play.is_endgame_bait ?? play.isEndgameBait ?? false;
    const vcRatio = play.vc_ratio ?? play.vcRatio ?? null;
    const rackBalanceTag = play.rack_balance_tag ?? play.rackBalanceTag ?? null;
    const rackBalanceDesc = play.rack_balance_desc ?? play.rackBalanceDesc ?? null;
    const winProb = play.win_prob ?? play.winProb ?? play.winRate ?? null;
    const netMargin = play.net_margin ?? play.netMargin ?? null;

    return (
      <div
        ref={cardRef}
        className={`result-card ${isSelected ? "result-card-selected" : ""}`}
        style={{
          cursor: "pointer",
          backgroundColor: isSelected ? undefined : isExch ? "#f4f0ff" : undefined,
        }}
        onMouseEnter={() => {
          if (isBingo) playBingoChime();
          onHover(play);
        }}
        onMouseLeave={onLeave}
        onClick={() => onClick(play)}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
              marginBottom: "4px",
            }}
          >
            {/* Rank */}
            <span style={{ fontSize: "10px", fontWeight: "bold", color: rank === 0 ? "#008000" : "#666", marginRight: "2px" }}>
              #{rank + 1}
            </span>

            {/* Tile mini-chips */}
            <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
              {(isExch ? play.word.replace(/^EXCH\s*/i, "") : play.word)
                .toUpperCase()
                .split("")
                .map((ch, idx) => (
                  <div
                    key={idx}
                    className="scrabble-tile-mini"
                    style={{ backgroundColor: isExch ? "#f4f0ff" : undefined, borderColor: isExch ? "#7b1fa2" : undefined }}
                  >
                    <span>{ch}</span>
                    <sub className="tile-score-sub">
                      {activePreset?.scores?.[ch.toLowerCase()] ?? TILE_SCORES[ch] ?? 0}
                    </sub>
                  </div>
                ))}

              {!isExch && (
                <button
                  className="def-btn-mobile"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHover(play);
                  }}
                  title="View Definition"
                >
                  DEF
                </button>
              )}
            </div>

            {/* Tactical Badges */}
            {isExch && (
              <span className="badge-dict-only" style={{ fontSize: "8px", padding: "1px 5px", backgroundColor: "#f3e5f5", color: "#6a1b9a", borderColor: "#ce93d8", fontWeight: "bold" }}>
                🔄 STRATEGIC EXCHANGE
              </span>
            )}
            {!isExch && play.score >= 50 && tilesUsed < 7 && (
              <span className="badge-legal" style={{ backgroundColor: "#8e24aa" }}>POWER PLAY</span>
            )}
            {!isExch && (
              <>
                <span
                  className="badge-legal"
                  style={{ fontSize: "8px", padding: "1px 3px" }}
                >
                  {activeLexicon ? activeLexicon.toUpperCase() : "TWL06"}
                </span>

                {tilesUsed === 7 && (
                  <span className="badge-dict-only" style={{ fontSize: "8px", padding: "1px 3px", backgroundColor: "#e3f2fd", color: "#1565c0", borderColor: "#90caf9" }}>
                    BINGO
                  </span>
                )}

                {exposes3W && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 3px", backgroundColor: "#ffebee", color: "#c62828", borderColor: "#ef9a9a" }}>
                    RISK: 3W
                  </span>
                )}

                {isPoisonLeave && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 3px", backgroundColor: "#b71c1c", color: "#ffffff", borderColor: "#ef5350" }}
                    title="Warning: Keeps toxic consonant combinations (V/W, duplicate V, Q without U) or severe negative equity.">
                    ⚠️ POISON LEAVE
                  </span>
                )}

                {isVowelFlood && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 3px", backgroundColor: "#e65100", color: "#ffffff", borderColor: "#ffb74d" }}
                    title="Warning: Severe vowel flood or triple duplicate vowels on rack.">
                    ⚠️ VOWEL FLOOD
                  </span>
                )}

                {opens9X && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#b71c1c", color: "#ffffff", borderColor: "#ef5350", fontWeight: "bold" }}
                    title="Critical: Opens an unblocked 9x Triple-Triple corridor!">
                    ⚠️ OPENS 9X
                  </span>
                )}

                {opens4X && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#e65100", color: "#ffffff", borderColor: "#ff9800", fontWeight: "bold" }}
                    title="Alert: Opens a 4x Double-Double corridor.">
                    ⚠️ OPENS 4X
                  </span>
                )}

                {blocks9X && (
                  <span className="badge-legal" style={{ fontSize: "8px", padding: "1px 3px", backgroundColor: "#1b5e20", color: "#ffffff", borderColor: "#2e7d32" }}
                    title="Defensive Masterplay: Blocks 9x Triple-Triple corridor!">
                    🛡️ BLOCKS 9X
                  </span>
                )}

                {blocks4X && (
                  <span className="badge-legal" style={{ fontSize: "8px", padding: "1px 3px", backgroundColor: "#2e7d32", color: "#ffffff", borderColor: "#388e3c" }}
                    title="Defensive: Blocks 4x Double-Double corridor.">
                    🛡️ BLOCKS 4X
                  </span>
                )}

                {retainsBlank && (
                  <span className="badge-legal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#00838f", color: "#ffffff", borderColor: "#00acc1", fontWeight: "bold" }}
                    title="Preserves wildcard blank (?) for future bingos.">
                    💎 RETAIN BLANK
                  </span>
                )}

                {blankSurcharge && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 3px", backgroundColor: "#d84315", color: "#ffffff", borderColor: "#ff5722" }}
                    title="Blank Surcharge: Expends blank without adequate return.">
                    BLANK SURCHARGE
                  </span>
                )}

                {isEndgameSetup && (
                  <span className="badge-legal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#00695c", color: "#ffffff", borderColor: "#004d40", fontWeight: "bold" }}
                    title="Seizes terminal endgame control: empties all remaining tiles in bag!">
                    🏁 ENDGAME SETUP
                  </span>
                )}

                {isEndgameBait && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#d84315", color: "#ffffff", borderColor: "#bf360c", fontWeight: "bold" }}
                    title="Endgame Bait: leaves 1-3 tiles in bag, allowing opponent first pick with complete unseen knowledge!">
                    ⚠️ ENDGAME BAIT
                  </span>
                )}

                {isDeterministic && oppReplyWord && (
                  <span className="badge-legal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#1565c0", color: "#ffffff", borderColor: "#1976d2", fontWeight: "bold" }}
                    title="Exact Endgame Intel: Opponent's rack is 100% known.">
                    🎯 EXACT ENDGAME
                  </span>
                )}

                {!isDeterministic && oppReplyWord && (
                  <span style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#455a64", color: "#ffffff", border: "1px solid #78909c", borderRadius: "2px", fontWeight: "bold" }}
                    title="Threat Estimate: Monte Carlo simulated counterplay.">
                    🎲 THREAT EST
                  </span>
                )}

                {rackBalanceTag === "bingo_stem" && (
                  <span className="badge-legal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#2e7d32", color: "#ffffff", borderColor: "#388e3c", fontWeight: "bold" }}
                    title={rackBalanceDesc || "Grandmaster Bingo Stem: leaves a high-probability tournament stem for next turn bingos."}>
                    ⭐ STEM HARVEST
                  </span>
                )}

                {rackBalanceTag === "duplicate_penalty" && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#c62828", color: "#ffffff", borderColor: "#ef5350", fontWeight: "bold" }}
                    title={rackBalanceDesc || "Duplicate Letter Clog: penalizes double/triple vowels or duplicate clunkers."}>
                    💥 DUPLICATE CLOG
                  </span>
                )}

                {rackBalanceTag === "consonant_heavy" && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#bf360c", color: "#ffffff", borderColor: "#e65100", fontWeight: "bold" }}
                    title={rackBalanceDesc || "Severe consonant starvation or lack of vowels."}>
                    ⚠️ CONSONANT HEAVY
                  </span>
                )}

                {rackBalanceTag === "vowel_heavy" && (
                  <span className="badge-illegal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#e65100", color: "#ffffff", borderColor: "#f57c00", fontWeight: "bold" }}
                    title={rackBalanceDesc || "Severe vowel skew."}>
                    ⚠️ VOWEL HEAVY
                  </span>
                )}

                {rackBalanceTag === "balanced" && (
                  <span className="badge-legal" style={{ fontSize: "8px", padding: "1px 4px", backgroundColor: "#0277bd", color: "#ffffff", borderColor: "#0288d1", fontWeight: "bold" }}
                    title={rackBalanceDesc || "Equilibrium: Ideal V/C balance retained on rack."}>
                    ⚖️ BALANCED
                  </span>
                )}
              </>
            )}
          </div>

          {/* Position and direction */}
          <div style={{ fontSize: "11px", opacity: 0.9 }}>
            <strong>{notation}</strong>{" "}
            {!isExch && `• Row ${rowNum}, Col ${colLetter} (${isVert ? "Down" : "Across"})`}
          </div>

          {/* Leave analysis */}
          <div style={{ fontSize: "10px", marginTop: "3px", color: "#444" }}>
            Leave:{" "}
            <strong style={{ letterSpacing: "1px" }}>{play.leave || "—"}</strong>
            {(() => {
              if (!play.leave || play.leave === "None") return null;
              if (vcRatio) return ` (${vcRatio})`;
              const v = (play.leave.match(/[AEIOU]/gi) || []).length;
              const blanks = (play.leave.match(/[?]/g) || []).length;
              const c = play.leave.length - v - blanks;
              const bStr = blanks > 0 ? `/${blanks}?` : "";
              return ` (${v}V/${c}C${bStr})`;
            })()}
            {" "}(
            <span style={{ color: leaveEquity >= 0 ? "#1b5e20" : "#b71c1c", fontWeight: "bold" }}>
              {leaveEquity >= 0 ? `+${leaveEquity}` : leaveEquity} eq
            </span>
            )
          </div>

          {/* Rack Coordination Analysis Note */}
          {rackBalanceDesc && rackBalanceDesc !== "Empty Rack (Out)" && (
            <div
              style={{
                marginTop: "2px",
                fontSize: "9px",
                color:
                  rackBalanceTag === "bingo_stem"
                    ? "#1b5e20"
                    : rackBalanceTag === "balanced"
                    ? "#0277bd"
                    : rackBalanceTag === "duplicate_penalty" || rackBalanceTag === "consonant_heavy" || rackBalanceTag === "vowel_heavy"
                    ? "#b71c1c"
                    : "#555",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
              title={rackBalanceDesc}
            >
              <span>{rackBalanceTag === "bingo_stem" ? "⭐" : rackBalanceTag === "balanced" ? "⚖️" : "🧩"}</span>
              <span>{rackBalanceDesc}</span>
            </div>
          )}

          {/* Net Exchange HUD */}
          {!isExch && (
            <div
              className="net-exchange-hud"
              style={{
                marginTop: "4px",
                padding: "3px 6px",
                backgroundColor: "#f4f6f9",
                border: "1px solid #b0bec5",
                borderRadius: "2px",
                fontSize: "10px",
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "4px",
              }}
              title={
                oppReplyWord
                  ? `Counter: "${oppReplyWord}" (${oppBestScore ?? Math.round(avgOppScore ?? 0)} pts)`
                  : avgOppScore != null
                  ? `Simulated avg opponent response: ~${avgOppScore} pts`
                  : "Net Exchange Balance"
              }
            >
              <span>
                Score: <strong style={{ color: "#1b5e20" }}>+{play.score}</strong>
              </span>
              <span style={{ color: "#90a4ae" }}>|</span>
              <span>
                Opp:{" "}
                <strong style={{ color: "#b71c1c" }}>
                  {oppBestScore != null
                    ? `~${oppBestScore}`
                    : avgOppScore != null
                    ? `~${Math.round(avgOppScore)}`
                    : "~0"}
                </strong>
                {oppReplyWord && (
                  <span style={{ fontSize: "9px", color: "#546e7a", marginLeft: "2px" }}>
                    ({oppReplyWord})
                  </span>
                )}
                {oppReplyWord && (
                  <span style={{ fontSize: "8px", marginLeft: "4px", color: isDeterministic ? "#1565c0" : "#546e7a", fontWeight: "bold" }}>
                    {isDeterministic ? "[🎯]" : "[🎲]"}
                  </span>
                )}
              </span>
              <span style={{ color: "#90a4ae" }}>|</span>
              <span>
                Net:{" "}
                {(() => {
                  const oppVal = oppBestScore ?? avgOppScore ?? 0;
                  const net = netMargin != null ? netMargin : (play.netSpread != null ? play.netSpread : play.score - oppVal);
                  const netRounded = Math.round(net * 10) / 10;
                  return (
                    <strong
                      style={{ color: netRounded >= 0 ? "#1b5e20" : "#b71c1c" }}
                      title={netMargin != null ? `2-Ply Rollout Spread Margin: ${netRounded >= 0 ? `+${netRounded}` : netRounded} pts` : undefined}
                    >
                      {netRounded >= 0 ? `+${netRounded}` : netRounded}
                    </strong>
                  );
                })()}
              </span>
            </div>
          )}
        </div>

        {/* Right side: Score, Total Val, Leave Safety */}
        <div style={{ textAlign: "right", minWidth: "90px" }}>
          <div style={{ fontSize: "14px", fontWeight: "bold", color: isExch ? "#606060" : "#008000" }}>
            {play.score} PTS
          </div>
          <div style={{ fontSize: "10px", color: "#333", fontWeight: "bold", marginBottom: "2px" }}>
            Val: {totalVal}
          </div>
          {winProb != null && (
            <div
              style={{
                fontSize: "9px",
                fontWeight: "bold",
                marginBottom: "3px",
                padding: "1px 4px",
                borderRadius: "2px",
                backgroundColor: winProb >= 55 ? "#e8f5e9" : winProb >= 45 ? "#e3f2fd" : "#ffebee",
                color: winProb >= 55 ? "#1b5e20" : winProb >= 45 ? "#1565c0" : "#c62828",
                border: `1px solid ${winProb >= 55 ? "#a5d6a7" : winProb >= 45 ? "#90caf9" : "#ef9a9a"}`,
                display: "inline-block",
              }}
              title={`2-Ply M1 Playout: ${winProb}% Win Prob | Spread Margin: ${netMargin != null ? (netMargin >= 0 ? `+${netMargin}` : netMargin) : "0"} pts`}
            >
              🏆 {winProb}% Win
            </div>
          )}
          {!isExch &&
            (play.exposes3W ? (
              <span className="badge-risk-high">EXPOSES 3W</span>
            ) : isPoisonLeave ? (
              <span className="badge-risk-high" style={{ backgroundColor: "#ffebee", color: "#c62828", borderColor: "#ef9a9a" }}>
                POISON LEAVE
              </span>
            ) : isVowelFlood ? (
              <span className="badge-risk-high" style={{ backgroundColor: "#fff3e0", color: "#e65100", borderColor: "#ffcc80" }}>
                VOWEL FLOOD
              </span>
            ) : (
              <span className="badge-risk-safe">SAFE LEAVE</span>
            ))}
        </div>
      </div>
    );
  },
);
ResultCard.displayName = "ResultCard";

export default ResultCard;
