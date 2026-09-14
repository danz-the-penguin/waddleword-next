// src/lib/dictionaryService.js - High-Performance Hybrid Dictionary Service
// Multi-tier architecture:
// Tier 1: Instant Curated Scrabble Tournament Definitions (0ms)
// Tier 2: In-Memory LRU / Map Cache (0ms)
// Tier 3: Offline Unabridged Web Worker (102,217 words, non-blocking)
// Tier 4: Direct Offline JSON fallback if Web Worker is unavailable
// Tier 5: External Free Dictionary API fallback with strict 1.2s AbortController timeout

import { SCRABBLE_DEFINITIONS } from "./scrabbleDefinitions.js";

const definitionCache = new Map();

// Populate initial cache with curated Scrabble tournament definitions
for (const [w, def] of Object.entries(SCRABBLE_DEFINITIONS)) {
  definitionCache.set(w.toLowerCase(), def);
}

let worker = null;
let workerReady = false;
const pendingCallbacks = new Map();
let fallbackDictPromise = null;

function initWorker() {
  if (typeof window === "undefined") return;
  if (worker) return;

  try {
    worker = new Worker("/dictionaryWorker.js");

    worker.onmessage = (e) => {
      const { type, word, definition, error } = e.data || {};
      if (type === "INIT_SUCCESS") {
        workerReady = true;
      } else if (type === "INIT_ERROR") {
        console.warn("Dictionary worker init warning:", error);
      } else if (type === "LOOKUP_RESULT") {
        const w = (word || "").toLowerCase();
        if (definition) {
          definitionCache.set(w, definition);
        }
        const cbs = pendingCallbacks.get(w);
        if (cbs && cbs.length > 0) {
          cbs.forEach((cb) => cb(definition));
          pendingCallbacks.delete(w);
        }
      }
    };

    worker.onerror = (err) => {
      console.warn("Dictionary worker error:", err);
    };

    worker.postMessage({ type: "INIT" });
  } catch (err) {
    console.warn("Web Worker initialization failed, using main-thread fallback:", err);
    worker = null;
  }
}

// Lazy load compact dictionary directly into memory as fallback if worker is unavailable
async function getFallbackDictionary() {
  if (!fallbackDictPromise) {
    fallbackDictPromise = (async () => {
      try {
        const res = await fetch("/dictionary_compact.json");
        if (!res.ok) return null;
        return await res.json();
      } catch (err) {
        console.warn("Failed to load /dictionary_compact.json fallback:", err);
        return null;
      }
    })();
  }
  return fallbackDictPromise;
}

// External API with strict timeout (never hangs UI)
async function fetchOnlineDefinition(word) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const firstMeaning = data?.[0]?.meanings?.[0];
    const partOfSpeech = firstMeaning?.partOfSpeech ? `(${firstMeaning.partOfSpeech}) ` : "";
    const def = firstMeaning?.definitions?.[0]?.definition;
    return def ? `${partOfSpeech}${def}` : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// Master lookup function
export async function lookupWord(rawWord) {
  if (!rawWord) return null;
  const w = rawWord.toLowerCase().trim();
  if (!w) return null;

  // 1. Check in-memory cache (includes curated Scrabble words)
  if (definitionCache.has(w)) {
    return definitionCache.get(w);
  }

  // 2. Initialize worker if needed
  if (!worker && typeof window !== "undefined") {
    initWorker();
  }

  // 3. Query Web Worker if available
  if (worker) {
    const workerResult = await new Promise((resolve) => {
      const existing = pendingCallbacks.get(w) || [];
      existing.push(resolve);
      pendingCallbacks.set(w, existing);

      // Timeout worker query after 400ms to avoid blocking
      setTimeout(() => {
        const callbacks = pendingCallbacks.get(w);
        if (callbacks) {
          const idx = callbacks.indexOf(resolve);
          if (idx !== -1) {
            callbacks.splice(idx, 1);
            if (callbacks.length === 0) pendingCallbacks.delete(w);
            resolve(undefined); // timed out
          }
        }
      }, 400);

      worker.postMessage({ type: "LOOKUP", word: w });
    });

    if (workerResult !== undefined) {
      if (workerResult) {
        definitionCache.set(w, workerResult);
        return workerResult;
      }
    }
  }

  // 4. Fallback: local dictionary fetch if worker failed
  const fallbackDict = await getFallbackDictionary();
  if (fallbackDict) {
    if (fallbackDict[w]) {
      const def = fallbackDict[w];
      definitionCache.set(w, def);
      return def;
    }
    // Check common inflections
    if (w.endsWith("s") && fallbackDict[w.slice(0, -1)]) {
      const def = "(pl.) " + fallbackDict[w.slice(0, -1)];
      definitionCache.set(w, def);
      return def;
    }
    if (w.endsWith("es") && fallbackDict[w.slice(0, -2)]) {
      const def = "(pl.) " + fallbackDict[w.slice(0, -2)];
      definitionCache.set(w, def);
      return def;
    }
    if (w.endsWith("ed") && (fallbackDict[w.slice(0, -2)] || fallbackDict[w.slice(0, -1)])) {
      const base = fallbackDict[w.slice(0, -2)] || fallbackDict[w.slice(0, -1)];
      const def = "(past) " + base;
      definitionCache.set(w, def);
      return def;
    }
    if (w.endsWith("ing") && (fallbackDict[w.slice(0, -3)] || fallbackDict[w.slice(0, -3) + "e"])) {
      const base = fallbackDict[w.slice(0, -3)] || fallbackDict[w.slice(0, -3) + "e"];
      const def = "(pr.p.) " + base;
      definitionCache.set(w, def);
      return def;
    }
  }

  // 5. External online fallback with fast 1.2s timeout
  const onlineDef = await fetchOnlineDefinition(w);
  if (onlineDef) {
    definitionCache.set(w, onlineDef);
    return onlineDef;
  }

  return null;
}

// Synchronously check if a definition is already cached in memory
export function getCachedDefinition(rawWord) {
  if (!rawWord) return null;
  return definitionCache.get(rawWord.toLowerCase().trim()) || null;
}

export const fetchDefinition = lookupWord;

