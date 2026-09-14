// public/dictionaryWorker.js - Background Web Worker for Unabridged Offline Dictionary
let dictionary = null;
let pendingLookups = [];

function resolveDefinition(rawWord) {
  if (!dictionary) return null;
  const w = (rawWord || "").toLowerCase().trim();
  if (!w) return null;

  // 1. Exact match
  if (dictionary[w]) return dictionary[w];

  // 2. Inflection fallback: -s (plurals)
  if (w.endsWith("s") && dictionary[w.slice(0, -1)]) {
    return "(pl.) " + dictionary[w.slice(0, -1)];
  }
  // 3. Inflection fallback: -es (plurals/verbs)
  if (w.endsWith("es") && dictionary[w.slice(0, -2)]) {
    return "(pl./3rd pers.) " + dictionary[w.slice(0, -2)];
  }
  // 4. Inflection fallback: -ed (past tense)
  if (w.endsWith("ed")) {
    if (dictionary[w.slice(0, -2)]) return "(past) " + dictionary[w.slice(0, -2)];
    if (dictionary[w.slice(0, -1)]) return "(past) " + dictionary[w.slice(0, -1)];
  }
  // 5. Inflection fallback: -ing (present participle)
  if (w.endsWith("ing")) {
    if (dictionary[w.slice(0, -3)]) return "(pr.p.) " + dictionary[w.slice(0, -3)];
    if (dictionary[w.slice(0, -3) + "e"]) return "(pr.p.) " + dictionary[w.slice(0, -3) + "e"];
  }
  // 6. Inflection fallback: -er (agent/comparative)
  if (w.endsWith("er") && dictionary[w.slice(0, -2)]) {
    return "(comp./agent) " + dictionary[w.slice(0, -2)];
  }
  // 7. Inflection fallback: -est (superlative)
  if (w.endsWith("est") && dictionary[w.slice(0, -3)]) {
    return "(superlative) " + dictionary[w.slice(0, -3)];
  }
  // 8. Prefix fallback: re- (repeat)
  if (w.startsWith("re") && w.length > 3 && dictionary[w.slice(2)]) {
    return "(re-) To " + w.slice(2) + " again: " + dictionary[w.slice(2)];
  }
  // 9. Prefix fallback: un- (negation)
  if (w.startsWith("un") && w.length > 3 && dictionary[w.slice(2)]) {
    return "(un-) Not " + w.slice(2) + ": " + dictionary[w.slice(2)];
  }

  return null;
}

self.onmessage = async (e) => {
  const { type, word } = e.data || {};

  if (type === "INIT") {
    if (!dictionary) {
      try {
        const res = await fetch("/dictionary_compact.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        dictionary = await res.json();
        self.postMessage({ type: "INIT_SUCCESS" });
        for (let i = 0; i < pendingLookups.length; i++) {
          const w = pendingLookups[i];
          self.postMessage({
            type: "LOOKUP_RESULT",
            word: w,
            definition: resolveDefinition(w),
          });
        }
        pendingLookups = [];
      } catch (err) {
        self.postMessage({ type: "INIT_ERROR", error: err.message });
        for (let i = 0; i < pendingLookups.length; i++) {
          self.postMessage({
            type: "LOOKUP_RESULT",
            word: pendingLookups[i],
            definition: null,
          });
        }
        pendingLookups = [];
      }
    } else {
      self.postMessage({ type: "INIT_SUCCESS" });
    }
  } else if (type === "LOOKUP") {
    if (!word) return;
    if (!dictionary) {
      pendingLookups.push(word);
      return;
    }
    const definition = resolveDefinition(word);
    self.postMessage({ type: "LOOKUP_RESULT", word, definition });
  }
};
