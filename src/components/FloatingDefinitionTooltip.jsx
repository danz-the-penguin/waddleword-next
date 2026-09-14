import React, { useState, useEffect, useRef } from "react";
import { getCachedDefinition } from "../lib/dictionaryService";
import { getWordHooks } from "../tauriBridge";

/**
 * FloatingDefinitionTooltip - Follows mouse or centers on mobile to show word definitions,
 * turnover metrics, bingo odds, tactical details, and GADDAG hooks for the currently hovered play.
 */

// Track last known cursor coordinates to avoid initial-frame positioning jumps
const lastMousePos = { x: null, y: null };
if (typeof window !== "undefined") {
  window.addEventListener(
    "mousemove",
    (e) => {
      lastMousePos.x = e.clientX;
      lastMousePos.y = e.clientY;
    },
    { passive: true }
  );
}

export default function FloatingDefinitionTooltip({
  hoveredPlay,
  lookupWord,
  activeLexicon = "TWL06",
  onLeave,
}) {
  const tooltipRef = useRef(null);
  const [definition, setDefinition] = useState(null);
  const [hooks, setHooks] = useState({ front: [], back: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!hoveredPlay) {
      setDefinition(null);
      setHooks({ front: [], back: [] });
      setIsLoading(false);
      return;
    }

    const play = Array.isArray(hoveredPlay) ? hoveredPlay[0] : hoveredPlay;
    if (!play || play.dir === "EXCH") return;

    const w = (play.word || "").toLowerCase();
    const cached = getCachedDefinition(w);
    let isMounted = true;

    // Fetch GADDAG Front & Back Hooks
    getWordHooks(w, activeLexicon)
      .then((res) => {
        if (isMounted && res) {
          setHooks({
            front: Array.isArray(res.front) ? res.front : [],
            back: Array.isArray(res.back) ? res.back : [],
          });
        }
      })
      .catch(() => {
        if (isMounted) setHooks({ front: [], back: [] });
      });

    if (cached) {
      setDefinition(cached);
      setIsLoading(false);
    } else {
      setDefinition(null);
      setIsLoading(true);

      if (lookupWord) {
        lookupWord(w)
          .then((def) => {
            if (isMounted) {
              setDefinition(def || null);
              setIsLoading(false);
            }
          })
          .catch(() => {
            if (isMounted) {
              setDefinition(null);
              setIsLoading(false);
            }
          });
      } else {
        setIsLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [hoveredPlay, lookupWord, activeLexicon]);

  useEffect(() => {
    if (!hoveredPlay || !tooltipRef.current) return;

    const applyPos = (clientX, clientY) => {
      if (!tooltipRef.current) return;
      if (window.innerWidth <= 768) {
        tooltipRef.current.style.transform = "translate(-50%, -50%)";
        tooltipRef.current.style.left = "50%";
        tooltipRef.current.style.top = "50%";
        return;
      }
      const x = Math.max(10, Math.min(clientX + 16, window.innerWidth - 300));
      const y = Math.max(10, Math.min(clientY + 16, window.innerHeight - 220));
      tooltipRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      tooltipRef.current.style.left = "0";
      tooltipRef.current.style.top = "0";
    };

    // Position immediately using last known mouse coordinates if on desktop
    if (!isMobile && lastMousePos.x !== null && lastMousePos.y !== null) {
      applyPos(lastMousePos.x, lastMousePos.y);
    } else if (isMobile) {
      tooltipRef.current.style.transform = "translate(-50%, -50%)";
      tooltipRef.current.style.left = "50%";
      tooltipRef.current.style.top = "50%";
    }

    const handleMouseMove = (e) => {
      applyPos(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [hoveredPlay, isMobile]);

  if (!hoveredPlay) return null;
  const play = Array.isArray(hoveredPlay) ? hoveredPlay[0] : hoveredPlay;
  if (!play || play.dir === "EXCH") return null;

  const leave = play.leave || "";
  const leaveLen = !leave || leave === "None" ? 0 : leave.length;
  const turnover = `Draws ${7 - leaveLen} | Keeps ${leaveLen}`;

  const bingoProb =
    play.bingo_prob_next_turn != null
      ? `${Math.round(play.bingo_prob_next_turn)}%`
      : (() => {
          if (!leave || leave === "None") return "0%";
          const synergy = ["A", "E", "I", "O", "U", "R", "S", "T", "L", "N"];
          let good = 0,
            blanks = 0;
          for (const c of leave) {
            if (c === "?") blanks++;
            else if (synergy.includes(c.toUpperCase())) good++;
          }
          const bad = leave.length - good - blanks;
          const baseOdds = [0, 1, 4, 10, 22, 38, 26, 0];
          let prob = (baseOdds[leave.length] || 0) - bad * 4 + blanks * 15;
          if (prob < 0) prob = 0;
          if (prob > 99) prob = 99;
          return `${Math.round(prob)}%`;
        })();

  const leaveEquity = play.leave_equity ?? play.leaveEquity ?? 0;
  const totalVal = play.total_val ?? play.totalVal ?? play.score;
  const exposes3W = play.exposes_3w ?? play.exposes3W ?? false;
  const opens9X = play.opens_triple_triple ?? play.opensTripleTriple ?? false;
  const blocksDWS = play.blocks_double_double ?? play.blocksDWS ?? false;

  return (
    <div
      ref={tooltipRef}
      className="win98-window win98-tooltip"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "280px",
        zIndex: 99999,
        // On desktop, pointerEvents: "none" prevents intercepting mouseleave on the card underneath
        pointerEvents: isMobile ? "auto" : "none",
        boxShadow: "2px 2px 0px #000000",
        margin: 0,
      }}
    >
      <div
        className="win98-titlebar"
        style={{
          padding: "2px 4px",
          fontSize: "11px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{(play.word || "").toUpperCase()}</span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span>{play.score} PTS</span>
          {isMobile && (
            <button
              className="def-btn-mobile"
              style={{ margin: 0, pointerEvents: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                if (onLeave) onLeave();
              }}
            >
              X
            </button>
          )}
        </div>
      </div>
      <div
        className="win98-inset"
        style={{
          padding: "6px 8px",
          fontSize: "12px",
          lineHeight: "1.4",
          maxHeight: "220px",
          overflowY: "auto",
          whiteSpace: "normal",
          wordBreak: "break-word",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "8px",
            flexWrap: "wrap",
          }}
        >
          <span className="badge-legal">
            ✔ VALID ({activeLexicon ? activeLexicon.toUpperCase() : ""})
          </span>
          {blocksDWS && (
            <span
              className="badge-legal"
              style={{ backgroundColor: "#1565c0" }}
            >
              🛡️ BLOCKS 4X
            </span>
          )}
          {exposes3W && (
            <span
              className="badge-illegal"
              style={{ backgroundColor: "#d84315" }}
            >
              🚨 RISK: 3W
            </span>
          )}
          {opens9X && (
            <span
              className="badge-illegal"
              style={{ backgroundColor: "#b71c1c" }}
            >
              ⚠️ OPENS 9X
            </span>
          )}
        </div>

        <div
          style={{
            marginBottom: "8px",
            fontSize: "11px",
            background: "#eee",
            padding: "4px",
            border: "1px inset #fff",
          }}
        >
          <div>
            <strong>Math:</strong> {play.score} (Base) + {leaveEquity} (Eq) ={" "}
            {totalVal}
          </div>
          <div style={{ marginTop: "2px" }}>
            <strong>Turnover:</strong> {turnover}
          </div>
          <div style={{ marginTop: "2px" }}>
            <strong>Est. Next Turn Bingo:</strong> {bingoProb}
          </div>
        </div>

        {(hooks.front.length > 0 || hooks.back.length > 0) && (
          <div className="hooks-container">
            <div style={{ fontWeight: "bold", fontSize: "10px", color: "#333", marginBottom: "3px" }}>
              HOOKS ({activeLexicon ? activeLexicon.toUpperCase() : "TWL06"}):
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
              <div className="hook-group">
                <span style={{ fontSize: "10px", color: "#555", marginRight: "2px" }}>Front:</span>
                {hooks.front.length > 0 ? (
                  hooks.front.map((c) => (
                    <span key={`f-${c}`} className="hook-chip front-hook" title={`Valid word: ${c}${play.word.toUpperCase()}`}>
                      {c}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: "10px", color: "#888", fontStyle: "italic" }}>—</span>
                )}
              </div>
              <span style={{ fontWeight: "bold", fontSize: "11px", color: "#000080" }}>
                {(play.word || "").toUpperCase()}
              </span>
              <div className="hook-group">
                <span style={{ fontSize: "10px", color: "#555", marginRight: "2px" }}>Back:</span>
                {hooks.back.length > 0 ? (
                  hooks.back.map((c) => (
                    <span key={`b-${c}`} className="hook-chip back-hook" title={`Valid word: ${play.word.toUpperCase()}${c}`}>
                      {c}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: "10px", color: "#888", fontStyle: "italic" }}>—</span>
                )}
              </div>
            </div>
          </div>
        )}

        {definition ? (
          <div style={{ fontSize: "11px" }}>{definition}</div>
        ) : isLoading ? (
          <span style={{ color: "#777", fontStyle: "italic" }}>
            ⏳ Looking up definition...
          </span>
        ) : (
          <span style={{ color: "#777", fontStyle: "italic" }}>
            Official tournament word in {activeLexicon ? activeLexicon.toUpperCase() : "TWL06"}. (Standard definition unavailable).
          </span>
        )}
      </div>
    </div>
  );
}
