// src/components/RefereeChecker.jsx - Tournament Word Adjudication & Challenge Referee
import React, { useState, useEffect, useRef } from "react";
import { checkWordWithRust, getWordHooks } from "../tauriBridge";
import { getCachedDefinition } from "../lib/dictionaryService";

export default function RefereeChecker({
  activeLexicon = "twl06",
  activePreset,
  lookupWord,
  onInvalidWord,
  checkWord,
}) {
  const [challengeInput, setChallengeInput] = useState("");
  const [challengeResult, setChallengeResult] = useState(null);
  const activeLexiconRef = useRef(activeLexicon);

  useEffect(() => {
    activeLexiconRef.current = activeLexicon;
  }, [activeLexicon]);

  useEffect(() => {
    const raw = challengeInput.trim().toLowerCase();
    const w = raw.replace(/[^a-z]/g, "");
    if (!w) {
      setChallengeResult(null);
      return;
    }

    const cachedDef = getCachedDefinition(w);
    const baseScore = w
      .split("")
      .reduce((sum, c) => sum + (activePreset?.scores?.[c.toLowerCase()] || 1), 0);

    // Fast 60ms debounce for native GADDAG adjudication
    const timer = setTimeout(async () => {
      try {
        const lex = activeLexiconRef.current;
        const isValid = checkWord ? await checkWord(w, lex) : await checkWordWithRust(w, lex);
        let hooks = { front: [], back: [] };
        if (isValid) {
          hooks = await getWordHooks(w, lex);
        }

        setChallengeResult({
          word: w,
          isLoaded: true,
          isValid,
          hooks,
          inJson: Boolean(cachedDef),
          def: cachedDef || null,
          baseScore,
          lexicon: lex,
          isLoadingDef: !cachedDef,
        });

        if (!isValid && onInvalidWord) {
          onInvalidWord();
        }

        // Asynchronously fetch definition in background if not already cached
        if (!cachedDef && lookupWord) {
          lookupWord(w).then((def) => {
            setChallengeResult((prev) => {
              if (!prev || prev.word !== w) return prev;
              return {
                ...prev,
                inJson: Boolean(def),
                def: def || null,
                isLoadingDef: false,
              };
            });
          });
        }
      } catch (err) {
        console.error("Referee verification error:", err);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [challengeInput, activePreset, lookupWord, onInvalidWord, checkWord, activeLexicon]);

  return (
    <div className="win98-window" style={{ marginTop: "10px" }}>
      <div className="win98-titlebar">
        <span>⚖️ Referee &bull; Tournament Word Adjudication</span>
      </div>
      <div className="win98-content" style={{ padding: "8px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            className="win98-input"
            style={{ flex: "1 1 auto", fontSize: "12px", textTransform: "uppercase" }}
            placeholder="Type word to challenge or check..."
            value={challengeInput}
            onChange={(e) => setChallengeInput(e.target.value.toUpperCase())}
          />
          {challengeInput.trim() && (
            <button className="win98-button" onClick={() => setChallengeInput("")}>
              Clear
            </button>
          )}
        </div>

        {challengeResult && (
          <div
            className="win98-inset"
            style={{
              marginTop: "8px",
              padding: "6px 8px",
              backgroundColor: !challengeResult.isLoaded
                ? "#fffde7"
                : challengeResult.isValid
                  ? "#e8f5e9"
                  : "#ffebee",
              borderColor: !challengeResult.isLoaded
                ? "#fbc02d"
                : challengeResult.isValid
                  ? "#2e7d32"
                  : "#c62828",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "4px",
                marginBottom: "4px",
              }}
            >
              <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
                {!challengeResult.isLoaded ? (
                  <span className="badge-dict-only">
                    ⏳ CHECKING {activeLexicon.toUpperCase()}...
                  </span>
                ) : (
                  <>
                    <span className={challengeResult.isValid ? "badge-legal" : "badge-illegal"}>
                      {challengeResult.isValid
                        ? `✔ VALID (${activeLexicon.toUpperCase()})`
                        : `✖ INVALID (${activeLexicon.toUpperCase()})`}
                    </span>

                    {challengeResult.inJson && (
                      <span className="badge-dict-only" style={{ fontSize: "8px", padding: "1px 3px" }}>
                        DEF
                      </span>
                    )}
                  </>
                )}
              </div>

              {challengeResult.isLoaded && challengeResult.isValid && (
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#1b5e20" }}>
                  Base Value: {challengeResult.baseScore} PTS
                </span>
              )}
            </div>

            <div style={{ fontSize: "11px", lineHeight: "1.4", color: "#222" }}>
              {!challengeResult.isLoaded ? (
                <span style={{ color: "#777" }}>Verifying word in native GADDAG...</span>
              ) : challengeResult.def ? (
                challengeResult.def
              ) : challengeResult.isLoadingDef ? (
                <span style={{ color: "#777", fontStyle: "italic" }}>Looking up definition...</span>
              ) : challengeResult.isValid ? (
                <span style={{ color: "#555", fontStyle: "italic" }}>
                  Official tournament word in {activeLexicon.toUpperCase()}. (Standard definition unavailable).
                </span>
              ) : (
                <span style={{ color: "#b71c1c", fontWeight: "bold" }}>
                  &quot;{challengeResult.word.toUpperCase()}&quot; is NOT legal under {activeLexicon.toUpperCase()} rules. Challenge succeeds!
                </span>
              )}
            </div>

            {challengeResult.isValid && challengeResult.hooks && (challengeResult.hooks.front?.length > 0 || challengeResult.hooks.back?.length > 0) && (
              <div className="hooks-container" style={{ marginTop: "6px" }}>
                <div style={{ fontWeight: "bold", fontSize: "10px", color: "#333", marginBottom: "3px" }}>
                  VALID HOOKS ({activeLexicon.toUpperCase()}):
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                  <div className="hook-group">
                    <span style={{ fontSize: "10px", color: "#555", marginRight: "2px" }}>Front:</span>
                    {challengeResult.hooks.front?.length > 0 ? (
                      challengeResult.hooks.front.map((c) => (
                        <span key={`ref-f-${c}`} className="hook-chip front-hook" title={`Valid word: ${c}${challengeResult.word.toUpperCase()}`}>
                          {c}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: "10px", color: "#888", fontStyle: "italic" }}>None</span>
                    )}
                  </div>
                  <span style={{ fontWeight: "bold", fontSize: "11px", color: "#000080" }}>
                    — {challengeResult.word.toUpperCase()} —
                  </span>
                  <div className="hook-group">
                    <span style={{ fontSize: "10px", color: "#555", marginRight: "2px" }}>Back:</span>
                    {challengeResult.hooks.back?.length > 0 ? (
                      challengeResult.hooks.back.map((c) => (
                        <span key={`ref-b-${c}`} className="hook-chip back-hook" title={`Valid word: ${challengeResult.word.toUpperCase()}${c}`}>
                          {c}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: "10px", color: "#888", fontStyle: "italic" }}>None</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
