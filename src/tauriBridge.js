// src/tauriBridge.js - Bridge between React UI and Tauri v2 Rust Core

export async function solveBoardWithRust({
  boardTiles,
  rack,
  sortMode = "strategic",
  scoreDifferential = 0,
  bagCount = null,
  lastOppPlay = null,
  manualAvailableTiles = null,
  lexicon = "twl06",
  equityMode = "trained",
  simQuality = "standard",
}) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("solve_board", {
        boardTiles,
        rack,
        sortMode,
        scoreDifferential,
        bagCount,
        lastOppPlay,
        manualAvailableTiles: manualAvailableTiles || null,
        lexicon: lexicon || "twl06",
        equityMode: equityMode || "trained",
        simQuality: simQuality || "standard",
      });
    } catch (err) {
      console.error("Tauri invoke error:", err);
      throw err;
    }
  }

  // Web fallback simulation for local browser preview outside Tauri runtime
  console.warn("Tauri environment not detected; using simulated engine response for UI preview.");
  await new Promise((r) => setTimeout(r, 60));

  const isBingo = rack.length >= 7;
  return [
    {
      word: isBingo ? "SATINES" : "SEAT",
      row: 7,
      col: 7,
      is_vertical: false,
      score: isBingo ? 66 : 14,
      tiles_used: isBingo ? 7 : 4,
      is_bingo: isBingo,
      leave: isBingo ? "" : rack.slice(4),
      leave_equity: 0.0,
      total_val: isBingo ? 68.5 : 17.2,
      bingo_prob_next_turn: isBingo ? 15.0 : 74.5,
      bingo_runway_score: 12.0,
      opp_best_reply: "QI (11 pts)",
      opp_best_score: 11,
      expected_opp_score: 9.4,
      exposes_3w: false,
      opens_triple_triple: false,
      opens_double_double: false,
      blocks_triple_triple: false,
      blocks_double_double: false,
      retains_blank: false,
      blank_surcharge_applied: false,
      is_deterministic_opponent: false,
    },
    {
      word: "ANESTRI",
      row: 7,
      col: 7,
      is_vertical: true,
      score: 64,
      tiles_used: 7,
      is_bingo: true,
      leave: "",
      leave_equity: 0.0,
      total_val: 66.8,
      bingo_prob_next_turn: 15.0,
      bingo_runway_score: 12.0,
      opp_best_reply: "ZA (11 pts)",
      opp_best_score: 11,
      expected_opp_score: 9.1,
      exposes_3w: false,
      opens_triple_triple: false,
      opens_double_double: false,
      blocks_triple_triple: false,
      blocks_double_double: false,
      retains_blank: false,
      blank_surcharge_applied: false,
      is_deterministic_opponent: false,
    }
  ];
}

export async function cancelCurrentSolve() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("cancel_current_solve");
    } catch (err) {
      console.warn("Tauri cancel_current_solve error:", err);
    }
  }
}

export async function checkWordWithRust(word, lexicon = "twl06") {
  if (!word || word.length < 2) return false;
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("check_word", {
        word: word.toUpperCase(),
        lexicon: lexicon || "twl06",
      });
    } catch (err) {
      console.error("Tauri check_word invoke error:", err);
      return false;
    }
  }

  // Web fallback: words of length >= 2 are accepted in mock environment
  return true;
}

export async function getWordHooks(word, lexicon = "twl06") {
  if (!word || word.length < 2) return { front: [], back: [] };
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("get_word_hooks", {
        word: word.toUpperCase(),
        lexicon: lexicon || "twl06",
      });
    } catch (err) {
      console.error("Tauri get_word_hooks invoke error:", err);
      return { front: [], back: [] };
    }
  }

  // Web fallback simulation for browser preview outside Tauri
  const clean = word.toUpperCase();
  const fallbackHooks = {
    LANE: { front: ["P"], back: ["D", "R", "S"] },
    SATINES: { front: [], back: [] },
    SEAT: { front: [], back: ["S"] },
    RETINA: { front: [], back: ["E", "L", "S"] },
    CARE: { front: ["S"], back: ["D", "E", "R", "S", "T"] },
  };

  if (fallbackHooks[clean]) {
    return fallbackHooks[clean];
  }

  // Generic heuristic fallback for preview
  const front = ["S", "P", "R", "C"].filter((_, i) => (clean.charCodeAt(0) + i) % 3 === 0);
  const back = ["S", "D", "R", "Y"].filter((_, i) => (clean.charCodeAt(clean.length - 1) + i) % 2 === 0);
  return { front, back };
}

export async function findRackAnagrams(rack, lexicon = "twl06") {
  if (!rack || rack.length < 2) return [];
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("find_rack_anagrams", {
        rack: rack.toUpperCase(),
        lexicon: lexicon || "twl06",
      });
    } catch (err) {
      console.error("Tauri find_rack_anagrams invoke error:", err);
      return [];
    }
  }

  // Web fallback simulation for browser testing
  console.warn("Tauri environment not detected; using mock anagrams for browser preview.");
  const cleanRack = rack.toUpperCase();
  const mockWords = [
    "RETAIN", "RETINA", "STARE", "TEARS", "RATES", "TARES",
    "ASTERN", "TRAIN", "STAIN", "TIRE", "RATE", "TARE", "TEAR",
    "STAR", "REST", "NEST", "TIE", "TEA", "EAT", "ATE", "ARE", "ERA", "AT", "TO", "IT", "IS", "IN"
  ];
  return mockWords.filter((w) => {
    const rackChars = cleanRack.split("");
    for (const c of w) {
      const idx = rackChars.indexOf(c);
      if (idx !== -1) {
        rackChars.splice(idx, 1);
      } else {
        const wildIdx = rackChars.findIndex(x => x === "?" || x === "." || x === "*");
        if (wildIdx !== -1) rackChars.splice(wildIdx, 1);
        else return false;
      }
    }
    return true;
  });
}

export async function evaluateTileExchange({
  tilesToExchange,
  fullRack,
  bagCount = null,
  equityMode = "trained",
}) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("evaluate_tile_exchange", {
        tilesToExchange: tilesToExchange.toUpperCase(),
        fullRack: fullRack.toUpperCase(),
        bagCount: bagCount !== null && bagCount !== undefined ? Number(bagCount) : null,
        equityMode: equityMode || "trained",
      });
    } catch (err) {
      console.error("Tauri evaluate_tile_exchange invoke error:", err);
      throw err;
    }
  }

  // Web fallback simulation
  const exchLen = tilesToExchange.length;
  let remaining = fullRack.toUpperCase();
  for (const c of tilesToExchange.toUpperCase()) {
    remaining = remaining.replace(c, "");
  }
  return {
    word: `EXCH ${tilesToExchange.toUpperCase()}`,
    row: 0,
    col: 0,
    is_vertical: false,
    score: 0,
    tiles_used: exchLen,
    is_bingo: false,
    leave: remaining || "None",
    leave_equity: 2.5 - (exchLen * 0.8),
    total_val: 3.0 - (exchLen * 0.6),
    bingo_prob_next_turn: remaining.length >= 3 ? 35.0 : 10.0,
    bingo_runway_score: 11.5,
    opp_best_reply: null,
    opp_best_score: 0,
    expected_opp_score: 0.0,
    exposes_3w: false,
    opens_triple_triple: false,
    opens_double_double: false,
    blocks_triple_triple: false,
    blocks_double_double: false,
    retains_blank: remaining.includes("?"),
    blank_surcharge_applied: false,
    is_deterministic_opponent: false,
    is_exchange: true,
  };
}

export async function findBestExchange({
  boardState = null,
  rack,
  bagCount = null,
  scoreDifferential = 0,
  lexicon = "twl06",
  equityMode = "trained",
}) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("find_best_exchange", {
        boardState,
        rack: rack.toUpperCase(),
        bagCount: bagCount !== null && bagCount !== undefined ? Number(bagCount) : null,
        scoreDifferential: Number(scoreDifferential) || 0,
        lexicon: lexicon || "twl06",
        equityMode: equityMode || "trained",
      });
    } catch (err) {
      console.error("Tauri find_best_exchange invoke error:", err);
      return null;
    }
  }
  return null;
}

export async function steebotChooseMove({
  boardTiles,
  botRack,
  scoreDifferential = 0,
  bagCount = null,
  lexicon = "twl06",
  simQuality = "championship",
}) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("steebot_choose_move", {
        boardTiles,
        botRack: botRack.toUpperCase(),
        scoreDifferential: Number(scoreDifferential) || 0,
        bagCount: bagCount !== null && bagCount !== undefined ? Number(bagCount) : null,
        lexicon: lexicon || "twl06",
        simQuality: simQuality || "championship",
      });
    } catch (err) {
      console.error("Tauri steebot_choose_move error:", err);
      throw err;
    }
  }

  // Fallback web solver simulation
  const plays = await solveBoardWithRust({
    boardTiles,
    rack: botRack,
    sortMode: "strategic",
    scoreDifferential,
    bagCount,
    lexicon,
    simQuality,
  });
  return plays?.[0] || null;
}

export async function toggleWindowMaximize() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      return;
    } catch (err) {
      console.warn("Tauri toggleMaximize warning:", err);
    }
  }

  // Fallback to HTML5 fullscreen for web browser mode
  if (typeof document !== "undefined") {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }
}

export async function minimizeWindow() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
      return;
    } catch (err) {
      console.warn("Tauri minimize warning:", err);
    }
  }
}

export async function closeWindow() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      await appWindow.close();
      return;
    } catch (err) {
      console.warn("Tauri close warning:", err);
    }
  }
  if (typeof window !== "undefined") {
    window.close?.();
  }
}

export async function compileAndLoadCustomGaddag(wordListText) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("compile_and_load_custom_gaddag", { wordListText });
    } catch (err) {
      console.error("compile_and_load_custom_gaddag error:", err);
      throw err;
    }
  }

  // Web fallback simulation for browser preview
  const words = wordListText.split(/\r?\n/).filter((w) => w.trim().length >= 2);
  return {
    success: true,
    word_count: words.length,
    node_count: words.length * 5,
    byte_size: words.length * 20,
    message: `(Preview Mode) Compiled ${words.length} words into simulated GADDAG.`,
  };
}

export async function getLeaveWeightsMap() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("get_leave_weights_map");
    } catch (err) {
      console.error("get_leave_weights_map error:", err);
      return {};
    }
  }
  return {};
}

export async function setCustomLeaveWeight(leave, weight) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("set_custom_leave_weight", {
        leave: leave.toUpperCase(),
        weight: Number(weight),
      });
    } catch (err) {
      console.error("set_custom_leave_weight error:", err);
      return false;
    }
  }
  return true;
}

export async function importLeaveWeights(jsonStr) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("import_leave_weights", { jsonStr });
    } catch (err) {
      console.error("import_leave_weights error:", err);
      throw err;
    }
  }
  const parsed = JSON.parse(jsonStr);
  return Object.keys(parsed).length;
}

export async function exportLeaveWeights() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("export_leave_weights");
    } catch (err) {
      console.error("export_leave_weights error:", err);
      return "{}";
    }
  }
  return "{}";
}

export async function resetLeaveWeights() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("reset_leave_weights");
    } catch (err) {
      console.error("reset_leave_weights error:", err);
      return false;
    }
  }
  return true;
}

export async function getSystemSpecs() {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("get_system_specs");
    } catch (err) {
      console.error("get_system_specs error:", err);
    }
  }
  return {
    cpu_arch: "Apple Silicon (aarch64 / ARM64)",
    logical_cores: 8,
    active_workers: 8,
    simd_feature: "NEON 128-bit SIMD Vector Acceleration",
    os: "macOS",
  };
}

export async function setWorkerThreads(threads) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("set_worker_threads", { threads: Number(threads) });
    } catch (err) {
      console.error("set_worker_threads error:", err);
    }
  }
  return Number(threads);
}

export async function getBayesianRackInference({
  lastWord = null,
  lastScore = null,
  hadOpen3w = false,
  hadOpenBingo = false,
  unseenTiles = null,
}) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("get_bayesian_rack_inference", {
        lastWord,
        lastScore: lastScore != null ? Number(lastScore) : null,
        hadOpen3w: Boolean(hadOpen3w),
        hadOpenBingo: Boolean(hadOpenBingo),
        unseenTiles,
      });
    } catch (err) {
      console.error("get_bayesian_rack_inference error:", err);
    }
  }

  // Web fallback simulation for browser preview
  const pool = (unseenTiles || "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ??").toUpperCase();
  const counts = {};
  for (const c of pool) counts[c] = (counts[c] || 0) + 1;

  return Object.entries(counts).map(([ch, count]) => {
    let mult = 1.0;
    if (hadOpen3w && lastScore != null && lastScore < 28 && ["Z", "X", "Q", "J", "?"].includes(ch)) mult = 0.15;
    else if (hadOpenBingo && lastScore != null && lastScore < 40 && ["S", "E", "R", "T", "?"].includes(ch)) mult = 0.65;
    else if (lastScore != null && lastScore < 25 && ["V", "W", "U", "C"].includes(ch)) mult = 1.35;

    let category = "neutral";
    let explanation = "Standard unconditioned prior probability";
    if (mult <= 0.35) {
      category = "discounted";
      explanation = `Unlikely in opp rack: missed high-value scoring opportunity (${Math.round(mult * 100)}% prior)`;
    } else if (mult <= 0.85) {
      category = "discounted";
      explanation = `Slightly discounted: unplayed during open runway (${Math.round(mult * 100)}% prior)`;
    } else if (mult >= 1.25) {
      category = "elevated";
      explanation = `Elevated probability: opponent holding awkward consonants / duplicate vowels (+${Math.round((mult - 1) * 100)}%)`;
    }

    return {
      letter: ch,
      count,
      likelihood_multiplier: mult,
      category,
      explanation,
    };
  });
}
