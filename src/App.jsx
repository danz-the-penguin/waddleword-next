// src/App.jsx - WaddleWord Next Pro Scrabble Engine Desktop / Web UI
// Phase 1: Win98 chrome | Phase 2: Board interaction | Phase 3: Game state & scoring

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Board, { PREMIUMS } from "./components/Board";
import BingoRadarHUD from "./components/BingoRadarHUD";
import EndgameExplorer from "./components/EndgameExplorer";
import MoveList from "./components/MoveList";
import GameReviewModal from "./components/GameReviewModal";
import MenuBar from "./components/MenuBar";
import StatusBar from "./components/StatusBar";
import BlankTileModal from "./components/BlankTileModal";
import IntelPanel from "./components/IntelPanel";
import UnseenTileTracker from "./components/UnseenTileTracker";
import RackTray from "./components/RackTray";
import ReplayControls from "./components/ReplayControls";
import FloatingDefinitionTooltip from "./components/FloatingDefinitionTooltip";
import TutorialModal from "./components/TutorialModal";
import HelpModal from "./components/HelpModal";
import RefereeChecker from "./components/RefereeChecker";
import AnagramExplorerModal from "./components/AnagramExplorerModal";
import TrainingStudioModal from "./components/TrainingStudioModal";
import TournamentClock from "./components/TournamentClock";
import VolumeControlPopover from "./components/VolumeControlPopover";
import BlunderShieldModal from "./components/BlunderShieldModal";
import SteebotArenaModal, { getBotProfile, BOT_PROFILES } from "./components/SteebotArenaModal";
import { copyBoardToClipboard, downloadBoardAsPng } from "./lib/boardSnapshot";
import { parseGcgFile, downloadMatchAsGcg, copyMatchGcgToClipboard } from "./lib/gcgParser";
import { useScrabbleHistory } from "./hooks/useScrabbleHistory";
import { useDebounce } from "./hooks/useDebounce";
import { calculateBoardMoveScore } from "./lib/scrabbleScorer";
import {
  solveBoardWithRust,
  steebotChooseMove,
  toggleWindowMaximize,
  minimizeWindow,
  closeWindow,
} from "./tauriBridge";
import {
  createShuffledBag,
  drawTiles,
  replenishRack,
  evaluateTurnQuality,
} from "./lib/coachingEngine";
import { lookupWord } from "./lib/dictionaryService";
import { BOARD_PRESETS, MULTI_CORRIDORS } from "./lib/presets";
import {
  playTileClack,
  playWin98Chord,
  playButtonClick,
  isSoundMuted,
  toggleSound,
} from "./lib/soundEffects";
import {
  setSelectedRackTile,
  getSelectedRackTile,
  clearSelectedRackTile,
} from "./lib/dragDropManager";
import "./styles/win98.css";
import "./App.css";

const EMPTY_BOARD = Array.from({ length: 15 }, () => Array(15).fill(null));
const EMPTY_OWNERS = Array.from({ length: 15 }, () => Array(15).fill(""));

function findNextTargetCell(b, startR, startC, dir) {
  let currR = startR;
  let currC = startC;
  const isAcross = ["Right", "Left"].includes(dir);
  const stepR = isAcross ? 0 : dir === "Down" ? 1 : -1;
  const stepC = isAcross ? (dir === "Right" ? 1 : -1) : 0;

  for (let i = 0; i < 15; i++) {
    currR += stepR;
    currC += stepC;
    if (currR < 0 || currR > 14 || currC < 0 || currC > 14) {
      return [startR, startC];
    }
    if (!b[currR]?.[currC]) {
      return [currR, currC];
    }
  }
  return [startR, startC];
}

export default function App() {
  // Visual theme state
  const [theme, setTheme] = useState("classic");

  // Preset & Lexicon state (Phase 6)
  const [activePresetKey, setActivePresetKey] = useState("scrabble");
  const [activeLexicon, setActiveLexicon] = useState(() => {
    if (typeof window === "undefined") return "twl06";
    return localStorage.getItem("waddleword_lexicon") || "twl06";
  });
  const activePreset = BOARD_PRESETS[activePresetKey] || BOARD_PRESETS.scrabble;

  const handlePresetChange = (presetKey) => {
    setActivePresetKey(presetKey);
    const preset = BOARD_PRESETS[presetKey];
    if (preset?.defaultLexicon) {
      setActiveLexicon(preset.defaultLexicon);
    }
  };

  // Board & Rack state
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [committedBoard, setCommittedBoard] = useState(EMPTY_BOARD);
  const [tileOwners, setTileOwners] = useState(EMPTY_OWNERS);
  const [rack, setRack] = useState("SATINES");
  const [selectedRackTile, setSelectedRackTileState] = useState(null);
  const [sortMode, setSortMode] = useState("strategic");

  // Board interaction state (Phase 2)
  const [selectedCell, setSelectedCell] = useState([7, 7]);
  const [typingDir, setTypingDir] = useState("Right");
  const [isBoardLocked, setIsBoardLocked] = useState(false);
  const [blankPrompt, setBlankPrompt] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Game state
  const [myScore, setMyScore] = useState("");
  const [oppScore, setOppScore] = useState("");
  const [inputMode, setInputMode] = useState("me");
  const scoreDifferential = (Number(myScore) || 0) - (Number(oppScore) || 0);

  // Bag count
  const [bagCount, setBagCount] = useState(86);

  // Intel state (Phase 4)
  const [enableIntel, setEnableIntel] = useState(true);
  const [showIntelSettings, setShowIntelSettings] = useState(false);
  const [intelMode, setIntelMode] = useState("auto");
  const [manualAvailableTiles, setManualAvailableTiles] = useState("");

  // Desktop scaling & Tournament layout state (Stage 1)
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem("waddleword_zoom");
    return saved ? parseFloat(saved) : 1;
  });
  const [isTournamentLayout, setIsTournamentLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("waddleword_tournament_layout") === "true";
  });
  const importInputRef = useRef(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--app-zoom", zoomLevel.toString());
      localStorage.setItem("waddleword_zoom", zoomLevel.toString());
    }
  }, [zoomLevel]);

  // Solver results
  const [plays, setPlays] = useState([]);
  const [hoveredPlay, setHoveredPlay] = useState(null);
  const [highlightedPlayIndex, setHighlightedPlayIndex] = useState(-1);
  const [isSolving, setIsSolving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isSoundMuted());
  const [equityMode, setEquityMode] = useState(() => {
    if (typeof window === "undefined") return "trained";
    return localStorage.getItem("waddleword_equity_mode") || "trained";
  });
  const [simQuality, setSimQuality] = useState(() => {
    if (typeof window === "undefined") return "standard";
    return localStorage.getItem("waddleword_sim_quality") || "standard";
  });
  const [isAnagramModalOpen, setIsAnagramModalOpen] = useState(false);
  const [isTrainingStudioOpen, setIsTrainingStudioOpen] = useState(false);
  const [isVolumePopoverOpen, setIsVolumePopoverOpen] = useState(false);
  const [isClockVisible, setIsClockVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("waddleword_clock_visible");
    return saved !== null ? saved === "true" : true;
  });
  const [enableBlunderShield, setEnableBlunderShield] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("waddleword_blunder_shield");
    return saved !== null ? saved === "true" : true;
  });
  const [blunderHazard, setBlunderHazard] = useState(null);
  const [lastOppContext, setLastOppContext] = useState(null);
  const [snapshotToast, setSnapshotToast] = useState(null);
  const soundBtnRef = useRef(null);

  // Phase 9: Interactive "Spar vs Steebot" Arena & Live Coaching
  const [isSteebotModalOpen, setIsSteebotModalOpen] = useState(false);
  const [isSparringActive, setIsSparringActive] = useState(false);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [steebotRack, setSteebotRack] = useState("");
  const [turnEquityFeedback, setTurnEquityFeedback] = useState(null);
  const [sparringBotId, setSparringBotId] = useState("hastybot");
  const tileBagRef = useRef([]);

  const activeSparringBot = useMemo(() => {
    return getBotProfile(sparringBotId || simQuality);
  }, [sparringBotId, simQuality]);

  // Synchronize user settings to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("waddleword_lexicon", activeLexicon);
      localStorage.setItem("waddleword_tournament_layout", String(isTournamentLayout));
      localStorage.setItem("waddleword_equity_mode", equityMode);
      localStorage.setItem("waddleword_sim_quality", simQuality);
      localStorage.setItem("waddleword_clock_visible", String(isClockVisible));
      localStorage.setItem("waddleword_blunder_shield", String(enableBlunderShield));
    }
  }, [activeLexicon, isTournamentLayout, equityMode, simQuality, isClockVisible, enableBlunderShield]);

  // Match Replay & GCG state (Phase 7)
  const [matchHistory, setMatchHistory] = useState([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);

  // Refs for keyboard handler (avoids stale closures)
  const boardRef = useRef(board);
  const committedBoardRef = useRef(committedBoard);
  const selectedCellRef = useRef(selectedCell);
  const inputModeRef = useRef(inputMode);
  const tileOwnersRef = useRef(tileOwners);
  const candidatePlaysRef = useRef(plays);
  const blankPromptRef = useRef(blankPrompt);
  const typingDirRef = useRef(typingDir);
  const isBoardLockedRef = useRef(isBoardLocked);
  const hoveredPlayRef = useRef(hoveredPlay);
  const highlightedPlayIndexRef = useRef(highlightedPlayIndex);

  useEffect(() => {
    boardRef.current = board;
    committedBoardRef.current = committedBoard;
    selectedCellRef.current = selectedCell;
    inputModeRef.current = inputMode;
    tileOwnersRef.current = tileOwners;
    candidatePlaysRef.current = plays;
    blankPromptRef.current = blankPrompt;
    typingDirRef.current = typingDir;
    isBoardLockedRef.current = isBoardLocked;
    hoveredPlayRef.current = hoveredPlay;
    highlightedPlayIndexRef.current = highlightedPlayIndex;
  }, [board, committedBoard, selectedCell, inputMode, tileOwners, plays, blankPrompt, typingDir, isBoardLocked, hoveredPlay, highlightedPlayIndex]);

  // Undo/Redo history (Phase 3)
  const { pushHistory, handleUndo, handleRedo, past, future } = useScrabbleHistory(
    board, setBoard,
    rack, setRack,
    tileOwners, setTileOwners,
    myScore, setMyScore,
    oppScore, setOppScore,
    setHoveredPlay,
    committedBoard, setCommittedBoard,
    inputMode, setInputMode
  );

  // Danger heatmap calculation (declared early to prevent TDZ ReferenceErrors)
  const dangerSquares = useMemo(() => {
    if (!showHeatmap) return new Map();
    const dangers = new Map();
    const priority = {
      "9x-corridor": 6, "4x-corridor": 5,
      "3W-center": 4, "3W-adj": 3,
      "2W-center": 2, "2W-adj": 1,
    };

    const setDanger = (nr, nc, level) => {
      const current = dangers.get(`${nr},${nc}`);
      if (!current || priority[level] > priority[current]) {
        dangers.set(`${nr},${nc}`, level);
      }
    };

    // Standard 3W and 2W threat radii
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (board[r][c]) continue;
        const premium = PREMIUMS[`${r},${c}`];
        if (premium === "3W" || premium === "2W") {
          setDanger(r, c, `${premium}-center`);
          if (r > 0 && !board[r - 1][c]) setDanger(r - 1, c, `${premium}-adj`);
          if (r < 14 && !board[r + 1][c]) setDanger(r + 1, c, `${premium}-adj`);
          if (c > 0 && !board[r][c - 1]) setDanger(r, c - 1, `${premium}-adj`);
          if (c < 14 && !board[r][c + 1]) setDanger(r, c + 1, `${premium}-adj`);
        }
      }
    }

    // Multi-Multiplier Corridors
    for (const corridor of MULTI_CORRIDORS) {
      const m1r = Math.floor(corridor.m1 / 15);
      const m1c = corridor.m1 % 15;
      const m2r = Math.floor(corridor.m2 / 15);
      const m2c = corridor.m2 % 15;
      if (board[m1r]?.[m1c] && board[m2r]?.[m2c]) continue;

      let emptyCount = 0;
      let hasAnchor = false;
      for (let p = corridor.start; p <= corridor.end; p++) {
        const r = corridor.isVert ? p : corridor.line;
        const col = corridor.isVert ? corridor.line : p;
        if (board[r]?.[col]) {
          hasAnchor = true;
        } else {
          emptyCount++;
          const up = r > 0 && board[r - 1]?.[col];
          const dn = r < 14 && board[r + 1]?.[col];
          const lt = col > 0 && board[r]?.[col - 1];
          const rt = col < 14 && board[r]?.[col + 1];
          if (up || dn || lt || rt) hasAnchor = true;
        }
      }

      if (emptyCount <= 8 && hasAnchor) {
        const level = corridor.type === 9 ? "9x-corridor" : "4x-corridor";
        for (let p = corridor.start; p <= corridor.end; p++) {
          const r = corridor.isVert ? p : corridor.line;
          const col = corridor.isVert ? corridor.line : p;
          if (!board[r]?.[col]) {
            setDanger(r, col, level);
          }
        }
      }
    }

    return dangers;
  }, [board, showHeatmap]);

  // Staged move detection (Phase 3 & 6) - evaluates tiles placed, leave equity, and V/C balance
  const stagedMoveEvaluation = useMemo(() => {
    const evalResult = calculateBoardMoveScore(board, committedBoard, null);
    if (!evalResult || !evalResult.isValid) return evalResult;

    // Calculate remaining rack leave and V/C balance
    const cleanRack = (rack || "").toUpperCase();
    let rackArr = cleanRack.split("");
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const bVal = board[r]?.[c];
        const cVal = committedBoard[r]?.[c];
        if (bVal && !cVal) {
          const isBlank = bVal >= "a" && bVal <= "z";
          const matchChar = isBlank ? "?" : bVal.toUpperCase();
          const idx = rackArr.indexOf(matchChar);
          if (idx !== -1) {
            rackArr.splice(idx, 1);
          } else if (isBlank) {
            const qIdx = rackArr.indexOf("?");
            if (qIdx !== -1) rackArr.splice(qIdx, 1);
          }
        }
      }
    }
    const leaveStr = rackArr.join("");
    const vCount = (leaveStr.match(/[AEIOU]/g) || []).length;
    const blanks = (leaveStr.match(/[?]/g) || []).length;
    const cCount = leaveStr.length - vCount - blanks;
    const vcRatio = blanks > 0 ? `${vCount}V/${cCount}C/${blanks}?` : `${vCount}V/${cCount}C`;

    return {
      ...evalResult,
      leave: leaveStr || "None",
      vcRatio,
      vCount,
      cCount,
    };
  }, [board, committedBoard, rack]);

  // Tactical Blunder Hazard Detection (Phase 5)
  const detectBlunderHazard = (b, cB, stagedEval, candidatePlays) => {
    if (!stagedEval || !stagedEval.isValid) return null;

    const newlyPlaced = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const bVal = b[r]?.[c];
        const cVal = cB[r]?.[c];
        if (bVal && !cVal) {
          newlyPlaced.push({ r, c, char: bVal });
        }
      }
    }

    // 1. Wildcard Blank Squandering
    const usesBlank = newlyPlaced.some((t) => t.char >= "a" && t.char <= "z");
    const bestAvailableScore =
      candidatePlays && candidatePlays.length > 0
        ? Math.max(...candidatePlays.map((p) => p.score || 0))
        : 0;

    if (usesBlank && stagedEval.score < 20 && bestAvailableScore >= 32) {
      return {
        type: "blank",
        title: "Wildcard Blank Squandered (< 20 pts)",
        message: `You are expending a valuable wildcard blank ('?') for only ${stagedEval.score} points, but a play scoring ${bestAvailableScore} points was available!`,
        detail: `Wildcard blanks carry +25 to +30 equity value. In competitive play, blanks should typically be conserved for 50-point Bingos or high-scoring outplays.`,
      };
    }

    // 2. Immediate 9x Triple-Triple Exposure
    let exposes9x = false;
    let corridorName = "";

    for (const t of newlyPlaced) {
      if ((t.r === 0 || t.r === 1) && ((t.c >= 1 && t.c <= 6) || (t.c >= 8 && t.c <= 13))) {
        exposes9x = true;
        corridorName = `Row 1 (Top 9x Corridor)`;
        break;
      }
      if ((t.r === 14 || t.r === 13) && ((t.c >= 1 && t.c <= 6) || (t.c >= 8 && t.c <= 13))) {
        exposes9x = true;
        corridorName = `Row 15 (Bottom 9x Corridor)`;
        break;
      }
      if ((t.c === 0 || t.c === 1) && ((t.r >= 1 && t.r <= 6) || (t.r >= 8 && t.r <= 13))) {
        exposes9x = true;
        corridorName = `Col A (Left 9x Corridor)`;
        break;
      }
      if ((t.c === 14 || t.c === 13) && ((t.r >= 1 && t.r <= 6) || (t.r >= 8 && t.r <= 13))) {
        exposes9x = true;
        corridorName = `Col O (Right 9x Corridor)`;
        break;
      }
    }

    if (exposes9x && stagedEval.score < 50) {
      return {
        type: "9x",
        title: "Immediate 9x Triple-Triple Exposure",
        message: `This move creates an anchor along ${corridorName}! Opponent can immediately drop an 8-letter play across both 3W squares for 100+ points.`,
        detail: `Corridor: ${corridorName}. Tournament strategy strongly advises keeping 9x corridors sealed unless you hold the bingo block.`,
      };
    }

    return null;
  };

  // Execution of the actual commit once validated / confirmed
  const executeCommit = useCallback(() => {
    if (!stagedMoveEvaluation || !stagedMoveEvaluation.isValid) return;

    const addedScore = stagedMoveEvaluation.score || 0;
    const isOpp = inputMode === "opp";

    pushHistory();
    if (stagedMoveEvaluation.isBingo) {
      playWin98Chord();
    } else {
      playTileClack();
    }
    const nextMy = !isOpp ? (parseInt(myScore, 10) || 0) + addedScore : parseInt(myScore, 10) || 0;
    const nextOpp = isOpp ? (parseInt(oppScore, 10) || 0) + addedScore : parseInt(oppScore, 10) || 0;

    let turnQuality = null;
    if (!isOpp) {
      const optimalPlay = candidatePlaysRef.current && candidatePlaysRef.current.length > 0 ? candidatePlaysRef.current[0] : null;
      turnQuality = evaluateTurnQuality({
        playedWord: stagedMoveEvaluation.cleanWord,
        playedScore: addedScore,
        optimalPlay,
        plays: candidatePlaysRef.current || [],
      });
      setTurnEquityFeedback(turnQuality);
    }

    if (!isOpp) {
      setMyScore(nextMy.toString());
      setInputMode("opp");
    } else {
      setOppScore(nextOpp.toString());
      setInputMode("me");
      setLastOppContext({
        word: stagedMoveEvaluation.cleanWord,
        score: addedScore,
        had_open_3w: dangerSquares.size > 0,
        had_open_bingo_lane: false,
      });
    }

    // Record turn in match history for GCG export
    const newTurn = {
      turnNum: matchHistory.length + 1,
      player: inputMode,
      playerName: isOpp ? "Opponent" : "Me",
      word: stagedMoveEvaluation.cleanWord,
      pos: stagedMoveEvaluation.posString,
      score: addedScore,
      myScore: nextMy,
      oppScore: nextOpp,
      total: isOpp ? nextOpp : nextMy,
      board: board.map((row) => [...row]),
      tileOwners: tileOwners.map((row) => [...row]),
      rack: isSparringActive && !isOpp ? (stagedMoveEvaluation.leave === "None" ? "" : stagedMoveEvaluation.leave) : rack,
      equityLoss: turnQuality?.equityLoss ?? 0,
      rating: turnQuality?.rating ?? "gm",
      optimalWord: turnQuality ? (candidatePlaysRef.current?.[0]?.word || null) : null,
    };
    setMatchHistory((prev) => [...prev, newTurn]);

    // Replenish human rack in sparring mode
    if (isSparringActive && !isOpp) {
      const remainingLeave = stagedMoveEvaluation.leave === "None" ? "" : stagedMoveEvaluation.leave;
      const { newRack, remainingBag } = replenishRack(remainingLeave, tileBagRef.current, 7);
      setRack(newRack);
      tileBagRef.current = remainingBag;
      setBagCount(remainingBag.length);
    }

    // Snapshot current board as the new committed state
    setCommittedBoard(board.map((row) => [...row]));
  }, [stagedMoveEvaluation, inputMode, board, tileOwners, pushHistory, myScore, oppScore, matchHistory.length, rack, dangerSquares.size, isSparringActive]);

  // Commit current play: check blunder shield first if enabled
  const commitCurrentPlay = useCallback(() => {
    if (!stagedMoveEvaluation || !stagedMoveEvaluation.isValid) return;

    if (enableBlunderShield) {
      const hazard = detectBlunderHazard(board, committedBoard, stagedMoveEvaluation, plays);
      if (hazard) {
        setBlunderHazard({
          ...hazard,
          onConfirm: () => {
            executeCommit();
          },
        });
        return;
      }
    }

    executeCommit();
  }, [stagedMoveEvaluation, enableBlunderShield, board, committedBoard, plays, executeCommit]);

  // Revert uncommitted tiles back to the committed board state
  const revertUncommittedTiles = useCallback(() => {
    playTileClack();
    setBoard(committedBoard.map((row) => [...row]));
    // Restore tile owners for uncommitted cells
    setTileOwners((prev) => {
      const next = prev.map((row) => [...row]);
      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          if (!committedBoard[r][c] && board[r][c]) {
            next[r][c] = "";
          }
        }
      }
      return next;
    });
  }, [committedBoard, board]);

  // Stage 4: Board Snapshot Actions
  const handleCopySnapshot = async () => {
    try {
      await copyBoardToClipboard(board, {
        myScore: Number(myScore) || 0,
        oppScore: Number(oppScore) || 0,
        activeLexicon,
        turn: currentTurnIdx + 1,
        bagCount,
      });
      setSnapshotToast("✓ Board snapshot copied to clipboard!");
      playWin98Chord();
      setTimeout(() => setSnapshotToast(null), 3500);
    } catch (err) {
      console.warn("Clipboard copy fallback to file download:", err);
      handleDownloadSnapshot();
    }
  };

  const handleDownloadSnapshot = async () => {
    try {
      await downloadBoardAsPng(board, {
        myScore: Number(myScore) || 0,
        oppScore: Number(oppScore) || 0,
        activeLexicon,
        turn: currentTurnIdx + 1,
        bagCount,
      });
      setSnapshotToast("✓ Board PNG saved to Downloads!");
      playWin98Chord();
      setTimeout(() => setSnapshotToast(null), 3500);
    } catch (err) {
      console.error("Failed to download board PNG:", err);
    }
  };

  const handleExportGcg = () => {
    try {
      downloadMatchAsGcg(matchHistory, {
        player1: "Me",
        player2: "Opponent",
        lexicon: activeLexicon,
        title: "WaddleWord Next Tournament Match",
      });
      setSnapshotToast("✓ Match exported to .gcg file!");
      playWin98Chord();
      setTimeout(() => setSnapshotToast(null), 3500);
    } catch (err) {
      console.error("Failed to export GCG:", err);
    }
  };

  // Stage 3: Tile Exchange Execution
  const handleConfirmExchange = (tilesToExchange) => {
    if (!tilesToExchange) return;
    let remainingRack = rack;
    for (const c of tilesToExchange) {
      remainingRack = remainingRack.replace(new RegExp(c, "i"), "");
    }
    pushHistory();

    let turnQuality = null;
    if (inputMode === "me") {
      const optimalPlay = plays && plays.length > 0 ? plays[0] : null;
      turnQuality = evaluateTurnQuality({
        playedWord: `EXCH ${tilesToExchange.toUpperCase()}`,
        playedScore: 0,
        optimalPlay,
        plays: plays || [],
      });
      setTurnEquityFeedback(turnQuality);
    }

    if (isSparringActive && inputMode === "me") {
      const swapped = tilesToExchange.toUpperCase().split("");
      const combinedBag = [...tileBagRef.current, ...swapped];
      for (let i = combinedBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinedBag[i], combinedBag[j]] = [combinedBag[j], combinedBag[i]];
      }
      const { newRack, remainingBag } = replenishRack(remainingRack, combinedBag, 7);
      setRack(newRack);
      tileBagRef.current = remainingBag;
      setBagCount(remainingBag.length);
    } else {
      setRack(remainingRack);
    }

    const newTurn = {
      turnNum: currentTurnIdx + 2,
      player: inputMode === "opp" ? "opp" : "me",
      playerName: inputMode === "opp" ? "Opponent" : "Me",
      word: `EXCH ${tilesToExchange.toUpperCase()}`,
      pos: "Exch",
      score: 0,
      myScore: Number(myScore) || 0,
      oppScore: Number(oppScore) || 0,
      total: Number(myScore) || 0,
      board: board.map((r) => [...r]),
      tileOwners: tileOwners.map((r) => [...r]),
      rack: remainingRack,
      equityLoss: turnQuality?.equityLoss ?? 0,
      rating: turnQuality?.rating ?? "gm",
      optimalWord: plays?.[0]?.word || null,
    };
    setMatchHistory((prev) => [...prev, newTurn]);
    setCurrentTurnIdx((prev) => prev + 1);
    setInputMode(inputMode === "me" ? "opp" : "me");
    playWin98Chord();
  };

  // Refs for commit/revert (used by keyboard handler)
  const commitCurrentPlayRef = useRef(commitCurrentPlay);
  const revertUncommittedTilesRef = useRef(revertUncommittedTiles);
  useEffect(() => {
    commitCurrentPlayRef.current = commitCurrentPlay;
    revertUncommittedTilesRef.current = revertUncommittedTiles;
  }, [commitCurrentPlay, revertUncommittedTiles]);

  // Debounced board/rack/intel for solver (Phase 3 & 4)
  const debouncedBoard = useDebounce(board, 300);
  const debouncedRack = useDebounce(rack, 300);
  const debouncedManualTiles = useDebounce(manualAvailableTiles, 300);

  // Global keyboard handler (Phase 2)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Tab: toggle top play preview
      if (e.key === "Tab") {
        e.preventDefault();
        const topPlays = candidatePlaysRef.current;
        if (topPlays && topPlays.length > 0) {
          setHoveredPlay((prev) => (prev ? null : topPlays[0]));
        }
        return;
      }

      // Ctrl+Z: undo (Phase 3)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (document.activeElement?.tagName === "INPUT" && document.activeElement.id !== "hidden-board-input") return;
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: redo (Phase 3)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        if (document.activeElement?.tagName === "INPUT" && document.activeElement.id !== "hidden-board-input") return;
        e.preventDefault();
        handleRedo();
        return;
      }

      // Alt+O: toggle input mode
      if (e.altKey && e.code === "KeyO") {
        e.preventDefault();
        setInputMode((m) => (m === "me" ? "opp" : "me"));
        return;
      }

      // Zoom shortcuts (Ctrl++, Ctrl+-, Ctrl+0)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          setZoomLevel((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))));
          return;
        } else if (e.key === "-") {
          e.preventDefault();
          setZoomLevel((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))));
          return;
        } else if (e.key === "0") {
          e.preventDefault();
          setZoomLevel(1);
          return;
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          setIsAnagramModalOpen(true);
          return;
        } else if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          setIsTrainingStudioOpen(true);
          return;
        } else if (e.key.toLowerCase() === "e") {
          e.preventDefault();
          handleExportGcg();
          return;
        } else if (e.shiftKey && e.key.toLowerCase() === "c") {
          e.preventDefault();
          handleCopySnapshot();
          return;
        }
      }

      // Fullscreen / Maximize shortcut (F11)
      if (e.key === "F11") {
        e.preventDefault();
        toggleWindowMaximize();
        return;
      }

      // Enter: apply highlighted candidate play OR commit current staged play (Phase 3)
      if (e.key === "Enter") {
        if (document.activeElement?.tagName === "INPUT" && document.activeElement.id !== "hidden-board-input") return;
        e.preventDefault();
        if (hoveredPlayRef.current) {
          handleApplyPlay(hoveredPlayRef.current);
          setHoveredPlay(null);
          setHighlightedPlayIndex(-1);
          return;
        }
        commitCurrentPlayRef.current?.();
        return;
      }

      // Escape: close blank prompt, clear hovered candidate play, or revert uncommitted tiles (Phase 3)
      if (e.key === "Escape") {
        if (document.activeElement?.tagName === "INPUT" && document.activeElement.id !== "hidden-board-input") return;
        e.preventDefault();
        setSelectedRackTileState(null);
        clearSelectedRackTile();
        if (blankPromptRef.current) {
          setBlankPrompt(null);
          return;
        }
        if (hoveredPlayRef.current || highlightedPlayIndexRef.current >= 0) {
          setHoveredPlay(null);
          setHighlightedPlayIndex(-1);
          return;
        }
        revertUncommittedTilesRef.current?.();
        return;
      }

      if (isBoardLockedRef.current) return;

      // Blank prompt mode: capture letter
      if (blankPromptRef.current) {
        e.preventDefault();
        if (/^[a-zA-Z]$/.test(e.key)) {
          setBlankPrompt(null);
          setTimeout(
            () =>
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: e.key.toUpperCase(),
                  shiftKey: true,
                }),
              ),
            10,
          );
        } else if (e.key === "Escape") setBlankPrompt(null);
        return;
      }

      // Skip if focused on a real input
      if (document.activeElement?.tagName === "INPUT" && document.activeElement.id !== "hidden-board-input") return;

      const currentCell = selectedCellRef.current;
      if (!currentCell) return;
      const [r, c] = currentCell;

      // Space: toggle typing direction
      if (e.key === " ") {
        e.preventDefault();
        setTypingDir((d) => (["Right", "Left"].includes(d) ? "Down" : "Right"));
        return;
      }

      // ?: open blank tile modal
      if (e.key === "?" || e.key === "/") {
        e.preventDefault();
        setBlankPrompt(true);
        return;
      }

      const currentBoard = boardRef.current;
      const currentOwner = tileOwnersRef.current;
      const currentTypingDir = typingDirRef.current;

      // Letter keys: place tile
      if (/^[a-zA-Z]$/.test(e.key)) {
        const typedChar = e.shiftKey ? e.key.toLowerCase() : e.key.toUpperCase();
        const existingTile = currentBoard[r][c];
        const existingOwner = currentOwner[r][c];
        const opponentMode = inputModeRef.current === "me" ? "opp" : "me";

        if (existingTile && existingOwner === opponentMode) {
          // Skip over opponent's tile if same letter
          if (existingTile.toUpperCase() === typedChar.toUpperCase()) {
            setSelectedCell(findNextTargetCell(currentBoard, r, c, currentTypingDir));
          }
        } else {
          pushHistory();
          playTileClack();
          setBoard((prev) => {
            const next = prev.map((row) => [...row]);
            next[r][c] = typedChar;
            return next;
          });
          setTileOwners((prev) => {
            const next = prev.map((row) => [...row]);
            next[r][c] = inputModeRef.current;
            return next;
          });
          setSelectedCell(findNextTargetCell(currentBoard, r, c, currentTypingDir));
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        const opponentMode = inputModeRef.current === "me" ? "opp" : "me";
        const stepR = currentTypingDir === "Down" ? -1 : currentTypingDir === "Up" ? 1 : 0;
        const stepC = currentTypingDir === "Right" ? -1 : currentTypingDir === "Left" ? 1 : 0;

        const clearCell = (tr, tc) => {
          playTileClack();
          setBoard((prev) => {
            const n = prev.map((row) => [...row]);
            n[tr][tc] = null;
            return n;
          });
          setTileOwners((prev) => {
            const n = prev.map((row) => [...row]);
            n[tr][tc] = "";
            return n;
          });
        };

        if (currentBoard[r][c] && currentOwner[r][c] !== opponentMode) {
          pushHistory();
          clearCell(r, c);
        } else {
          let nR = r + stepR, nC = c + stepC;
          while (nR >= 0 && nR < 15 && nC >= 0 && nC < 15 && currentOwner[nR][nC] === opponentMode) {
            nR += stepR;
            nC += stepC;
          }
          if (nR >= 0 && nR < 15 && nC >= 0 && nC < 15) {
            if (currentBoard[nR][nC] && currentOwner[nR][nC] !== opponentMode) {
              clearCell(nR, nC);
            }
            setSelectedCell([nR, nC]);
          }
        }
      } else if (e.key === "Delete") {
        const isOpponentTile = currentOwner[r][c] === (inputModeRef.current === "me" ? "opp" : "me");
        if (isOpponentTile) return;
        setBoard((prev) => {
          const next = prev.map((row) => [...row]);
          next[r][c] = null;
          return next;
        });
        setTileOwners((prev) => {
          const next = prev.map((row) => [...row]);
          next[r][c] = "";
          return next;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) setTypingDir("Right");
        else if (c < 14) setSelectedCell([r, c + 1]);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) setTypingDir("Left");
        else if (c > 0) setSelectedCell([r, c - 1]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (e.altKey || highlightedPlayIndexRef.current >= 0) {
          const pList = candidatePlaysRef.current;
          if (pList && pList.length > 0) {
            const cur = highlightedPlayIndexRef.current;
            const nextIdx = cur < 0 ? 0 : Math.min(pList.length - 1, cur + 1);
            setHighlightedPlayIndex(nextIdx);
            setHoveredPlay(pList[nextIdx]);
          }
        } else if (e.shiftKey) {
          setTypingDir("Down");
        } else if (r < 14) {
          setSelectedCell([r + 1, c]);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (e.altKey || highlightedPlayIndexRef.current >= 0) {
          const pList = candidatePlaysRef.current;
          if (pList && pList.length > 0) {
            const cur = highlightedPlayIndexRef.current;
            const prevIdx = cur <= 0 ? 0 : cur - 1;
            setHighlightedPlayIndex(prevIdx);
            setHoveredPlay(pList[prevIdx]);
          }
        } else if (e.shiftKey) {
          setTypingDir("Up");
        } else if (r > 0) {
          setSelectedCell([r - 1, c]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, pushHistory]);

  // Trigger solver (uses debounced values to avoid excess IPC calls while typing)
  const runSolver = useCallback(async () => {
    if (!debouncedRack.trim()) {
      setPlays([]);
      return;
    }
    setIsSolving(true);
    try {
      const effectiveManualTiles = (enableIntel && intelMode === "manual" && debouncedManualTiles.trim())
        ? debouncedManualTiles.toUpperCase().replace(/[^A-Z?]/g, "")
        : null;

      const results = await solveBoardWithRust({
        boardTiles: debouncedBoard,
        rack: debouncedRack.toUpperCase(),
        sortMode,
        scoreDifferential,
        bagCount: bagCount <= 7 ? bagCount : null,
        manualAvailableTiles: effectiveManualTiles,
        lexicon: activeLexicon,
        equityMode,
        simQuality,
      });
      setPlays(results);
    } catch (err) {
      console.error("Solver execution error:", err);
    } finally {
      setIsSolving(false);
    }
  }, [debouncedBoard, debouncedRack, sortMode, scoreDifferential, bagCount, enableIntel, intelMode, debouncedManualTiles, activeLexicon, equityMode, simQuality]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSolver();
    }, 250);
    return () => clearTimeout(timer);
  }, [runSolver]);

  const doApplyPlay = (play) => {
    if (!play) return;

    // Handle strategic tile exchanges (Phase 7)
    if (play.is_exchange || play.word?.startsWith("EXCH ")) {
      const swapped = play.word.replace(/^EXCH\s*/i, "");
      handleConfirmExchange(swapped);
      setHoveredPlay(null);
      return;
    }

    playTileClack();
    const word = play.word;
    const appliedBoard = board.map((row) => [...row]);
    for (let i = 0; i < word.length; i++) {
      const r = play.is_vertical ? play.row + i : play.row;
      const c = play.is_vertical ? play.col : play.col + i;
      appliedBoard[r][c] = word[i];
    }
    setBoard(appliedBoard);
    setCommittedBoard(appliedBoard.map((r) => [...r]));
    setTileOwners((prev) => {
      const copy = prev.map((row) => [...row]);
      for (let i = 0; i < word.length; i++) {
        const r = play.is_vertical ? play.row + i : play.row;
        const c = play.is_vertical ? play.col : play.col + i;
        if (!prev[r][c]) {
          copy[r][c] = inputMode === "opp" ? "opp" : "me";
        }
      }
      return copy;
    });

    // Update score
    const addedScore = parseInt(play.score, 10) || 0;
    const isOpp = inputMode === "opp";
    const nextMy = !isOpp ? (parseInt(myScore, 10) || 0) + addedScore : parseInt(myScore, 10) || 0;
    const nextOpp = isOpp ? (parseInt(oppScore, 10) || 0) + addedScore : parseInt(oppScore, 10) || 0;

    let turnQuality = null;
    if (!isOpp) {
      const optimalPlay = plays && plays.length > 0 ? plays[0] : null;
      turnQuality = evaluateTurnQuality({
        playedWord: play.word,
        playedScore: addedScore,
        playedVal: play.total_val,
        optimalPlay,
        plays: plays || [],
      });
      setTurnEquityFeedback(turnQuality);
    }

    if (!isOpp) {
      setMyScore(nextMy.toString());
      setInputMode("opp");
    } else {
      setOppScore(nextOpp.toString());
      setInputMode("me");
      setLastOppContext({
        word: play.word,
        score: addedScore,
        had_open_3w: Boolean(play.exposes_3w || play.blocks_triple_triple),
        had_open_bingo_lane: Boolean(play.bingo_runway_score && play.bingo_runway_score > 8.0),
      });
    }

    const colLetter = String.fromCharCode(65 + play.col);
    const posStr = play.is_vertical
      ? `${colLetter}${play.row + 1}`
      : `${play.row + 1}${colLetter}`;

    const newTurn = {
      turnNum: matchHistory.length + 1,
      player: inputMode,
      playerName: isOpp ? "Opponent" : "Me",
      word: play.word,
      pos: posStr,
      score: addedScore,
      myScore: nextMy,
      oppScore: nextOpp,
      total: isOpp ? nextOpp : nextMy,
      board: appliedBoard,
      tileOwners: tileOwners.map((row) => [...row]),
      rack: play.leave || "",
      equityLoss: turnQuality?.equityLoss ?? 0,
      rating: turnQuality?.rating ?? "gm",
      optimalWord: plays?.[0]?.word || null,
    };
    setMatchHistory((prev) => [...prev, newTurn]);

    if (isSparringActive && !isOpp) {
      const remainingLeave = play.leave || "";
      const { newRack, remainingBag } = replenishRack(remainingLeave, tileBagRef.current, 7);
      setRack(newRack);
      tileBagRef.current = remainingBag;
      setBagCount(remainingBag.length);
    } else {
      setRack(play.leave || "");
    }
    setHoveredPlay(null);
  };

  const handleApplyPlay = (play) => {
    if (!play) return;

    if (enableBlunderShield) {
      if (play.opens_triple_triple && play.score < 50) {
        setBlunderHazard({
          type: "9x",
          title: "Immediate 9x Triple-Triple Exposure",
          message: `This candidate play creates an anchor along a 9x Triple-Triple corridor! Opponent can immediately drop an 8-letter play across both 3W squares for 100+ points.`,
          detail: `Candidate: ${play.word} at ${play.row + 1}${String.fromCharCode(65 + play.col)} (+${play.score} pts).`,
          onConfirm: () => doApplyPlay(play),
        });
        return;
      }

      if (play.blank_surcharge_applied && play.score < 20) {
        const bestScore = plays && plays.length > 0 ? Math.max(...plays.map((p) => p.score || 0)) : 0;
        if (bestScore >= 32) {
          setBlunderHazard({
            type: "blank",
            title: "Wildcard Blank Squandered (< 20 pts)",
            message: `This candidate play spends a wildcard blank ('?') for only ${play.score} points when plays up to ${bestScore} points were available!`,
            detail: `Candidate: ${play.word} for +${play.score} pts.`,
            onConfirm: () => doApplyPlay(play),
          });
          return;
        }
      }
    }

    doApplyPlay(play);
  };

  const handleCellClick = useCallback(
    (r, c) => {
      if (isBoardLockedRef.current) setIsBoardLocked(false);

      // If a rack tile is currently selected, paste it directly into this empty cell!
      if (selectedRackTile && inputMode === "me" && !board[r]?.[c]) {
        const { letter, index: rackIdx, isBlank } = selectedRackTile;
        pushHistory();
        playTileClack();

        // Remove from rack
        setRack((prev) => {
          if (rackIdx != null && rackIdx >= 0 && rackIdx < prev.length) {
            return prev.slice(0, rackIdx) + prev.slice(rackIdx + 1);
          }
          const i = prev.indexOf(letter);
          if (i !== -1) return prev.slice(0, i) + prev.slice(i + 1);
          return prev;
        });

        if (isBlank) {
          setSelectedCell([r, c]);
          setBlankPrompt({ r, c });
        } else {
          setBoard((prev) => {
            const next = prev.map((row) => [...row]);
            next[r][c] = letter.toUpperCase();
            return next;
          });
          setTileOwners((prev) => {
            const next = prev.map((row) => [...row]);
            next[r][c] = "me";
            return next;
          });
          setSelectedCell(findNextTargetCell(board, r, c, typingDir));
        }

        setSelectedRackTileState(null);
        clearSelectedRackTile();
        return;
      }

      setSelectedCell((prev) => {
        if (!prev) return [r, c];
        if (prev[0] === r && prev[1] === c) {
          // Same cell: toggle direction
          setTypingDir((d) => (["Right", "Left"].includes(d) ? "Down" : "Right"));
          return [r, c];
        }
        return [r, c];
      });
    },
    [selectedRackTile, inputMode, board, typingDir, pushHistory],
  );

  const handleRackTileClick = useCallback(
    (letter, rackIdx) => {
      if (inputMode !== "me") return;
      setIsBoardLocked(false);

      // If a board cell is currently selected and empty: paste directly into it!
      if (selectedCell) {
        const [r, c] = selectedCell;
        if (!board[r]?.[c]) {
          pushHistory();
          playTileClack();
          const isBlank = ["?", ".", "0", "*", "_"].includes(letter);

          setRack((prev) => {
            if (rackIdx != null && rackIdx >= 0 && rackIdx < prev.length) {
              return prev.slice(0, rackIdx) + prev.slice(rackIdx + 1);
            }
            const i = prev.indexOf(letter);
            if (i !== -1) return prev.slice(0, i) + prev.slice(i + 1);
            return prev;
          });

          if (isBlank) {
            setBlankPrompt({ r, c });
          } else {
            setBoard((prev) => {
              const next = prev.map((row) => [...row]);
              next[r][c] = letter.toUpperCase();
              return next;
            });
            setTileOwners((prev) => {
              const next = prev.map((row) => [...row]);
              next[r][c] = "me";
              return next;
            });
            setSelectedCell(findNextTargetCell(board, r, c, typingDir));
          }

          setSelectedRackTileState(null);
          clearSelectedRackTile();
          return;
        }
      }

      // If no empty cell is selected: toggle selection on this rack tile
      if (selectedRackTile?.index === rackIdx) {
        setSelectedRackTileState(null);
        clearSelectedRackTile();
        playTileClack();
      } else {
        const tileInfo = {
          letter,
          index: rackIdx,
          isBlank: ["?", ".", "0", "*", "_"].includes(letter),
        };
        setSelectedRackTileState(tileInfo);
        setSelectedRackTile(tileInfo);
        playTileClack();
      }
    },
    [inputMode, selectedCell, board, typingDir, pushHistory, selectedRackTile],
  );

  const handleShuffleRack = () => {
    playTileClack();
    const arr = rack.split("");
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setRack(arr.join(""));
  };

  const handleRackChange = (val) => {
    const sanitized = val.toUpperCase().replace(/[^A-Z?.*_0]/g, "").slice(0, 7);
    setRack(sanitized);
  };

  const handleDropTileOnBoard = useCallback(
    (targetR, targetC, dragData) => {
      if (inputMode !== "me") return;
      if (targetR < 0 || targetR >= 15 || targetC < 0 || targetC >= 15) return;
      if (board[targetR]?.[targetC]) return;
      if (!dragData) return;

      setIsBoardLocked(false);
      setSelectedRackTileState(null);
      clearSelectedRackTile();

      const { source, letter, isBlank, index, fromR, fromC } = dragData;

      if (source === "rack") {
        pushHistory();
        playTileClack();
        setRack((prev) => {
          if (index != null && index >= 0 && index < prev.length) {
            return prev.slice(0, index) + prev.slice(index + 1);
          }
          const idx = prev.indexOf(letter);
          if (idx !== -1) return prev.slice(0, idx) + prev.slice(idx + 1);
          return prev;
        });

        if (isBlank) {
          setSelectedCell([targetR, targetC]);
          setBlankPrompt({ r: targetR, c: targetC });
        } else {
          setBoard((prev) => {
            const next = prev.map((row) => [...row]);
            next[targetR][targetC] = letter.toUpperCase();
            return next;
          });
          setTileOwners((prev) => {
            const next = prev.map((row) => [...row]);
            next[targetR][targetC] = "me";
            return next;
          });
          setSelectedCell(findNextTargetCell(board, targetR, targetC, typingDir));
        }
      } else if (source === "board") {
        if (fromR === targetR && fromC === targetC) return;
        pushHistory();
        playTileClack();
        const existingChar = board[fromR]?.[fromC];
        const existingOwner = tileOwners[fromR]?.[fromC];

        setBoard((prev) => {
          const next = prev.map((row) => [...row]);
          next[fromR][fromC] = null;
          next[targetR][targetC] = existingChar;
          return next;
        });
        setTileOwners((prev) => {
          const next = prev.map((row) => [...row]);
          next[fromR][fromC] = "";
          next[targetR][targetC] = existingOwner || "me";
          return next;
        });
        setSelectedCell([targetR, targetC]);
      }
    },
    [inputMode, board, tileOwners, typingDir, pushHistory],
  );

  const handleDropTileFromBoard = useCallback(
    (fromR, fromC, targetRackIdx) => {
      if (inputMode !== "me") return;
      if (committedBoard[fromR]?.[fromC]) return;

      const tileVal = board[fromR]?.[fromC];
      if (!tileVal) return;

      pushHistory();
      playTileClack();

      setBoard((prev) => {
        const next = prev.map((row) => [...row]);
        next[fromR][fromC] = null;
        return next;
      });
      setTileOwners((prev) => {
        const next = prev.map((row) => [...row]);
        next[fromR][fromC] = "";
        return next;
      });

      const isBlank = tileVal >= "a" && tileVal <= "z";
      const returnChar = isBlank ? "?" : tileVal.toUpperCase();

      setRack((prev) => {
        if (targetRackIdx != null && targetRackIdx >= 0 && targetRackIdx <= prev.length) {
          return prev.slice(0, targetRackIdx) + returnChar + prev.slice(targetRackIdx);
        }
        return prev + returnChar;
      });
    },
    [inputMode, committedBoard, board, pushHistory],
  );

  const handleSelectBlank = useCallback((letter) => {
    playTileClack();
    if (typeof blankPrompt === "object" && blankPrompt !== null && blankPrompt.r !== undefined) {
      const { r, c } = blankPrompt;
      pushHistory();
      setBoard((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = letter.toLowerCase();
        return next;
      });
      setTileOwners((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = inputMode;
        return next;
      });
      setBlankPrompt(null);
      return;
    }

    setBlankPrompt(null);
    setTimeout(
      () =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: letter,
            shiftKey: true,
          }),
        ),
      10,
    );
  }, [blankPrompt, pushHistory, inputMode]);

  const resetGame = () => {
    pushHistory();
    setBoard(EMPTY_BOARD);
    setCommittedBoard(EMPTY_BOARD);
    setTileOwners(EMPTY_OWNERS);
    setRack("");
    setHoveredPlay(null);
    setMyScore("");
    setOppScore("");
    setInputMode("me");
    setMatchHistory([]);
    setCurrentTurnIdx(0);
    setBagCount(86);
    setIsSparringActive(false);
    setIsBotThinking(false);
    setTurnEquityFeedback(null);
    setSteebotRack("");
    tileBagRef.current = [];
  };

  const clearBoard = () => {
    setBoard(EMPTY_BOARD);
    setCommittedBoard(EMPTY_BOARD);
    setTileOwners(EMPTY_OWNERS);
    setRack("");
    setHoveredPlay(null);
  };

  // Phase 9: Interactive "Spar vs Steebot" Arena & Live Coaching Handlers
  const handleStartSparring = useCallback(
    ({ difficulty, whoFirst, lexicon, botProfile }) => {
      pushHistory();
      setBoard(EMPTY_BOARD);
      setCommittedBoard(EMPTY_BOARD);
      setTileOwners(EMPTY_OWNERS);
      setMyScore("0");
      setOppScore("0");
      setMatchHistory([]);
      setCurrentTurnIdx(0);
      setTurnEquityFeedback(null);
      setBlunderHazard(null);
      setHoveredPlay(null);
      setSelectedCell([7, 7]);

      const bot = botProfile || getBotProfile(difficulty);
      if (bot?.id) setSparringBotId(bot.id);
      if (difficulty) setSimQuality(difficulty);
      if (lexicon) setActiveLexicon(lexicon);

      // Create a 100-tile tournament bag
      const fullBag = createShuffledBag();

      // Deal 7 tiles to human player
      const { drawn: myDrawn, remainingBag: bag1 } = drawTiles(fullBag, 7);
      setRack(myDrawn.join(""));

      // Deal 7 tiles to Steebot AI
      const { drawn: botDrawn, remainingBag: bag2 } = drawTiles(bag1, 7);
      setSteebotRack(botDrawn.join(""));

      tileBagRef.current = bag2;
      setBagCount(bag2.length);

      setIsSparringActive(true);
      setIsBotThinking(false);

      if (whoFirst === "opp") {
        setInputMode("opp");
      } else {
        setInputMode("me");
      }
    },
    [pushHistory],
  );

  const handleStopSparring = useCallback(() => {
    setIsSparringActive(false);
    setIsBotThinking(false);
    setTurnEquityFeedback(null);
  }, []);

  const triggerSteebotMove = useCallback(async () => {
    if (isBotThinking || !isSparringActive) return;
    setIsBotThinking(true);

    try {
      const mySc = parseInt(myScore, 10) || 0;
      const oppSc = parseInt(oppScore, 10) || 0;
      const botDiff = oppSc - mySc; // Bot perspective
      const currentBot = getBotProfile(sparringBotId || simQuality);
      const botDisplayName = currentBot.name;

      const currentBagLength = tileBagRef.current.length;
      const chosenPlay = await steebotChooseMove({
        boardTiles: committedBoard,
        botRack: steebotRack,
        scoreDifferential: botDiff,
        bagCount: currentBagLength,
        lexicon: activeLexicon,
        simQuality: currentBot.simQuality || simQuality,
      });

      if (!chosenPlay) {
        // Bot passes
        const newTurn = {
          turnNum: matchHistory.length + 1,
          player: "opp",
          playerName: botDisplayName,
          word: "PASS",
          pos: "--",
          score: 0,
          myScore: mySc,
          oppScore: oppSc,
          total: oppSc,
          board: committedBoard.map((r) => [...r]),
          tileOwners: tileOwners.map((r) => [...r]),
          rack: steebotRack,
          equityLoss: 0,
          rating: "gm",
        };
        setMatchHistory((prev) => [...prev, newTurn]);
        setInputMode("me");
        setIsBotThinking(false);
        return;
      }

      if (chosenPlay.is_exchange || chosenPlay.word?.startsWith("EXCH")) {
        const swapped = chosenPlay.word.replace(/^EXCH\s*/i, "").split("");
        const combinedBag = [...tileBagRef.current, ...swapped];
        for (let i = combinedBag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combinedBag[i], combinedBag[j]] = [combinedBag[j], combinedBag[i]];
        }
        let remBotRack = steebotRack;
        for (const letter of swapped) {
          const idx = remBotRack.indexOf(letter);
          if (idx !== -1) {
            remBotRack = remBotRack.slice(0, idx) + remBotRack.slice(idx + 1);
          }
        }
        const { newRack: newBotRack, remainingBag } = replenishRack(
          remBotRack,
          combinedBag,
          7,
        );
        setSteebotRack(newBotRack);
        tileBagRef.current = remainingBag;
        setBagCount(remainingBag.length);

        const newTurn = {
          turnNum: matchHistory.length + 1,
          player: "opp",
          playerName: botDisplayName,
          word: chosenPlay.word,
          pos: "Exch",
          score: 0,
          myScore: mySc,
          oppScore: oppSc,
          total: oppSc,
          board: committedBoard.map((r) => [...r]),
          tileOwners: tileOwners.map((r) => [...r]),
          rack: steebotRack,
          equityLoss: 0,
          rating: "gm",
        };
        setMatchHistory((prev) => [...prev, newTurn]);
        setInputMode("me");
        setIsBotThinking(false);
        return;
      }

      // Board move
      const word = chosenPlay.word;
      const appliedBoard = committedBoard.map((row) => [...row]);
      for (let i = 0; i < word.length; i++) {
        const r = chosenPlay.is_vertical ? chosenPlay.row + i : chosenPlay.row;
        const c = chosenPlay.is_vertical ? chosenPlay.col : chosenPlay.col + i;
        appliedBoard[r][c] = word[i];
      }

      const nextOwners = tileOwners.map((row) => [...row]);
      for (let i = 0; i < word.length; i++) {
        const r = chosenPlay.is_vertical ? chosenPlay.row + i : chosenPlay.row;
        const c = chosenPlay.is_vertical ? chosenPlay.col : chosenPlay.col + i;
        if (!nextOwners[r][c]) {
          nextOwners[r][c] = "opp";
        }
      }

      setBoard(appliedBoard);
      setCommittedBoard(appliedBoard.map((r) => [...r]));
      setTileOwners(nextOwners);

      const addedScore = parseInt(chosenPlay.score, 10) || 0;
      const nextOpp = oppSc + addedScore;
      setOppScore(nextOpp.toString());

      if (addedScore >= 50) {
        playWin98Chord();
      } else {
        playTileClack();
      }

      // Replenish bot rack
      const remainingBotRack = chosenPlay.leave || "";
      const { newRack: newBotRack, remainingBag } = replenishRack(
        remainingBotRack,
        tileBagRef.current,
        7,
      );
      setSteebotRack(newBotRack);
      tileBagRef.current = remainingBag;
      setBagCount(remainingBag.length);

      const colLetter = String.fromCharCode(65 + chosenPlay.col);
      const posStr = chosenPlay.is_vertical
        ? `${colLetter}${chosenPlay.row + 1}`
        : `${chosenPlay.row + 1}${colLetter}`;

      const newTurn = {
        turnNum: matchHistory.length + 1,
        player: "opp",
        playerName: botDisplayName,
        word: chosenPlay.word,
        pos: posStr,
        score: addedScore,
        myScore: mySc,
        oppScore: nextOpp,
        total: nextOpp,
        board: appliedBoard,
        tileOwners: nextOwners,
        rack: remainingBotRack,
        equityLoss: 0,
        rating: "gm",
      };
      setMatchHistory((prev) => [...prev, newTurn]);

      setLastOppContext({
        word: chosenPlay.word,
        score: addedScore,
        had_open_3w: Boolean(chosenPlay.exposes_3w || chosenPlay.blocks_triple_triple),
        had_open_bingo_lane: Boolean(
          chosenPlay.bingo_runway_score && chosenPlay.bingo_runway_score > 8.0,
        ),
      });

      setInputMode("me");
      setIsBotThinking(false);
    } catch (err) {
      console.error("Steebot sparring error:", err);
      setIsBotThinking(false);
    }
  }, [
    isBotThinking,
    isSparringActive,
    myScore,
    oppScore,
    committedBoard,
    steebotRack,
    tileOwners,
    activeLexicon,
    simQuality,
    sparringBotId,
    matchHistory.length,
  ]);

  // Auto-trigger Steebot's move when it's Steebot's turn in sparring mode
  useEffect(() => {
    if (isSparringActive && inputMode === "opp" && !isBotThinking) {
      const timer = setTimeout(() => {
        triggerSteebotMove();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isSparringActive, inputMode, isBotThinking, triggerSteebotMove]);

  // GCG & Replay Controls (Phase 7)
  const applyHistoricalTurn = useCallback(
    (turn) => {
      if (!turn) return;
      pushHistory();
      if (turn.board) {
        setBoard(turn.board.map((row) => [...row]));
        setCommittedBoard(turn.board.map((row) => [...row]));
      }
      if (turn.tileOwners) {
        setTileOwners(turn.tileOwners.map((row) => [...row]));
      }
      if (turn.myScore != null) setMyScore(turn.myScore.toString());
      if (turn.oppScore != null) setOppScore(turn.oppScore.toString());
      if (turn.player) setInputMode(turn.player);
      if (turn.rack) setRack(turn.rack.replace(/[^A-Za-z?]/g, "").toUpperCase());
    },
    [pushHistory],
  );

  const handleSelectTurn = useCallback(
    (idx) => {
      if (!matchHistory || idx < 0 || idx >= matchHistory.length) return;
      setCurrentTurnIdx(idx);
      applyHistoricalTurn(matchHistory[idx]);
    },
    [matchHistory, applyHistoricalTurn],
  );

  const handleGcgUpload = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const history = parseGcgFile(ev.target.result || "");
        if (history.length > 0) {
          setMatchHistory(history);
          const lastIdx = history.length - 1;
          setCurrentTurnIdx(lastIdx);
          applyHistoricalTurn(history[lastIdx]);
        }
      };
      reader.readAsText(file);
      e.target.value = null;
    },
    [applyHistoricalTurn],
  );

  // Game State Import & Export (Phase 7)
  const exportGame = useCallback(() => {
    const data = JSON.stringify(
      {
        board,
        committedBoard,
        tileOwners,
        rack,
        myScore,
        oppScore,
        activePresetKey,
        activeLexicon,
        intelMode,
        manualAvailableTiles,
        matchHistory,
        currentTurnIdx,
      },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waddleword_game_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    board,
    committedBoard,
    tileOwners,
    rack,
    myScore,
    oppScore,
    activePresetKey,
    activeLexicon,
    intelMode,
    manualAvailableTiles,
    matchHistory,
    currentTurnIdx,
  ]);

  const importGame = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.board) setBoard(parsed.board);
        if (parsed.committedBoard) setCommittedBoard(parsed.committedBoard);
        if (parsed.tileOwners) setTileOwners(parsed.tileOwners);
        if (parsed.rack) setRack(parsed.rack);
        if (parsed.myScore != null) setMyScore(parsed.myScore.toString());
        if (parsed.oppScore != null) setOppScore(parsed.oppScore.toString());
        if (parsed.activePresetKey) setActivePresetKey(parsed.activePresetKey);
        if (parsed.activeLexicon) setActiveLexicon(parsed.activeLexicon);
        if (parsed.intelMode) setIntelMode(parsed.intelMode);
        if (parsed.manualAvailableTiles) setManualAvailableTiles(parsed.manualAvailableTiles);
        if (parsed.matchHistory) setMatchHistory(parsed.matchHistory);
        if (parsed.currentTurnIdx != null) setCurrentTurnIdx(parsed.currentTurnIdx);
      } catch {
        alert("Failed to parse game JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  }, []);

  const topPlay = plays[0] || null;
  const isEndgame = bagCount === 0;

  return (
    <div className={`win98-body ${theme === "wood" ? "theme-hoyle" : ""}`}>
      <div className="win98-container">
        <div className="win98-window">
          {/* Win98 Title Bar */}
          <div className="win98-titlebar">
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  background: "var(--w98-surface)",
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  border: "1px solid",
                  borderColor:
                    "var(--w98-border-light) var(--w98-border-dark) var(--w98-border-dark) var(--w98-border-light)",
                }}
              >
                W
              </div>
              WaddleWord_Next.exe - [Rust Pro Engine]
            </span>
            <div style={{ display: "flex", gap: "2px" }}>
              <button
                className="win98-button win98-btn-sys"
                onClick={minimizeWindow}
                title="Minimize Window"
              >
                _
              </button>
              <button
                className="win98-button win98-btn-sys"
                onClick={toggleWindowMaximize}
                title="Maximize / Restore Window (F11)"
              >
                □
              </button>
              <button
                className="win98-button win98-btn-sys"
                onClick={closeWindow}
                title="Close Application"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Win98 Menu Bar */}
          <MenuBar
            onOpenTutorial={() => setIsTutorialOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
            onOpenReview={() => setIsReviewOpen(true)}
            onNewGame={resetGame}
            onExportGame={exportGame}
            onImportClick={() => importInputRef.current?.click()}
            onClearBoard={clearBoard}
            onUndo={handleUndo}
            onRedo={handleRedo}
            zoomLevel={zoomLevel}
            onSetZoom={setZoomLevel}
            isTournamentLayout={isTournamentLayout}
            onToggleTournamentLayout={() => setIsTournamentLayout((prev) => !prev)}
            onToggleMaximize={toggleWindowMaximize}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onOpenAnagramExplorer={() => setIsAnagramModalOpen(true)}
            onCopySnapshot={handleCopySnapshot}
            onDownloadSnapshot={handleDownloadSnapshot}
            onOpenVolumePopover={() => setIsVolumePopoverOpen(true)}
            simQuality={simQuality}
            onSetSimQuality={setSimQuality}
            onOpenTrainingStudio={() => setIsTrainingStudioOpen(true)}
            onExportGcg={handleExportGcg}
            onToggleClock={() => setIsClockVisible((v) => !v)}
            isClockVisible={isClockVisible}
            enableBlunderShield={enableBlunderShield}
            onToggleBlunderShield={() => setEnableBlunderShield((v) => !v)}
            onOpenSteebotArena={() => setIsSteebotModalOpen(true)}
          />

          <div className="win98-content">
            {/* Toolbar */}
            <div style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "stretch" }}>
                {/* Lexicon & Engine Rules */}
                <fieldset className="win98-fieldset" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", margin: 0, flex: "1 1 auto", minWidth: "420px" }}>
                  <legend>Lexicon & Engine Rules</legend>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold" }}>Board Preset:</label>
                    <select
                      className="win98-input"
                      style={{ width: "125px", cursor: "pointer", padding: "2px 4px" }}
                      value={activePresetKey}
                      onChange={(e) => handlePresetChange(e.target.value)}
                    >
                      {Object.keys(BOARD_PRESETS).map((key) => (
                        <option key={key} value={key}>
                          {BOARD_PRESETS[key].name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold" }}>Dictionary:</label>
                    <select
                      className="win98-input"
                      style={{ width: "125px", cursor: "pointer", padding: "2px 4px" }}
                      value={activeLexicon}
                      onChange={(e) => setActiveLexicon(e.target.value)}
                    >
                      <option value="twl06">TWL06 (Classic)</option>
                      <option value="nwl2023">NWL2023 (NA)</option>
                      <option value="csw24">CSW24 (Intl 2024)</option>
                      <option value="csw21">CSW21 (Intl 2021)</option>
                      <option value="sowpods">SOWPODS</option>
                      <option value="custom">Custom (.bin)</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold" }}>Engine Mode:</label>
                    <select
                      className="win98-input"
                      style={{ width: "125px", cursor: "pointer", padding: "2px 4px" }}
                      value={equityMode}
                      onChange={(e) => setEquityMode(e.target.value)}
                    >
                      <option value="trained">Trained (ML)</option>
                      <option value="static">Static Baseline</option>
                      <option value="custom">Custom Leaves</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold", color: "#000080" }}>M1 Sim Depth:</label>
                    <select
                      className="win98-input"
                      style={{ width: "125px", cursor: "pointer", padding: "2px 4px" }}
                      value={simQuality}
                      onChange={(e) => setSimQuality(e.target.value)}
                      title="Apple Silicon M1 Monte Carlo simulation depth preset"
                    >
                      <option value="blitz">⚡ Blitz (~10ms)</option>
                      <option value="standard">⚖️ Standard (~40ms)</option>
                      <option value="deep">🧠 Deep M1 (~150ms)</option>
                      <option value="championship">👑 Championship M1 (~450ms)</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold", color: "#b71c1c" }}>Sort By:</label>
                    <select className="win98-input" style={{ width: "125px", cursor: "pointer", padding: "2px 4px" }} value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                      <option value="strategic">Strategic (Eq)</option>
                      <option value="score">Highest Score</option>
                    </select>
                  </div>
                </fieldset>

                {/* Game State */}
                <fieldset className="win98-fieldset" style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0, flex: "1 1 auto", flexWrap: "wrap" }}>
                  <legend>Game State</legend>
                  <button
                    className="win98-button"
                    style={{ fontWeight: "bold", backgroundColor: isBoardLocked ? "#c0c0c0" : "#ffcccc" }}
                    onClick={() => setIsBoardLocked((prev) => !prev)}
                  >
                    {isBoardLocked ? "🔒 Locked" : "🔓 Edit"}
                  </button>
                  <div className="toolbar-separator" />
                  <button className="win98-button" onClick={handleUndo} disabled={past.length === 0} title="Ctrl+Z">
                    ↩ Undo{past.length > 0 ? ` (${past.length})` : ""}
                  </button>
                  <button className="win98-button" onClick={handleRedo} disabled={future.length === 0} title="Ctrl+Y">
                    ↪ Redo{future.length > 0 ? ` (${future.length})` : ""}
                  </button>
                  <div className="toolbar-separator" />
                  <button
                    className="win98-button"
                    style={{ fontWeight: "bold", color: showHeatmap ? "#cc0000" : "inherit" }}
                    onClick={() => setShowHeatmap((prev) => !prev)}
                  >
                    {showHeatmap ? "🔴 Heatmap" : "Heatmap"}
                  </button>
                  <button className="win98-button" style={{ fontWeight: "bold" }}
                    onClick={() => setTypingDir((d) => (["Right", "Left"].includes(d) ? "Down" : "Right"))}
                  >
                    {typingDir === "Right" ? "➔" : typingDir === "Down" ? "⬇" : typingDir === "Left" ? "⬅" : "⬆"}
                  </button>
                  <button className="win98-button" onClick={clearBoard}>Clear</button>
                  <button className="win98-button" onClick={() => setTheme((t) => (t === "classic" ? "wood" : "classic"))} title="Toggle Theme">
                    🎨
                  </button>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <button
                      ref={soundBtnRef}
                      className="win98-button"
                      style={{ fontWeight: "bold" }}
                      onClick={() => setIsVolumePopoverOpen((prev) => !prev)}
                      title="Master Volume & Soundpack Options"
                    >
                      {soundMuted ? "🔇 Muted" : "🔊 Sound ▾"}
                    </button>
                    <VolumeControlPopover
                      isOpen={isVolumePopoverOpen}
                      onClose={() => setIsVolumePopoverOpen(false)}
                      anchorRef={soundBtnRef}
                    />
                  </div>
                  <button
                    className="win98-button"
                    onClick={() => setIsAnagramModalOpen(true)}
                    title="Anagram & Sub-Word Explorer (Ctrl+F)"
                  >
                    🔤 Anagrams
                  </button>
                  <button
                    className="win98-button"
                    onClick={handleCopySnapshot}
                    title="Copy Board Snapshot to Clipboard (Ctrl+Shift+C)"
                  >
                    📸 Snapshot
                  </button>
                  <button
                    className="win98-button"
                    onClick={() => setIsTrainingStudioOpen(true)}
                    title="Training, Lexicon & Hardware Studio (Ctrl+T)"
                  >
                    🧠 Studio
                  </button>
                  <button
                    className="win98-button"
                    style={{ fontWeight: isClockVisible ? "bold" : "normal", color: isClockVisible ? "#000080" : "inherit" }}
                    onClick={() => setIsClockVisible((v) => !v)}
                    title="Toggle Tournament Chess Clock"
                  >
                    ⏱️ Clock
                  </button>
                  <div className="toolbar-separator" />
                  <button className="win98-button" onClick={exportGame} title="Export Game State (JSON)">💾 Save</button>
                  <div style={{ position: "relative", overflow: "hidden", display: "inline-block" }}>
                    <button className="win98-button" title="Import Game State (JSON)">📂 Open</button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".json"
                      onChange={importGame}
                      style={{ position: "absolute", left: 0, top: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
                    />
                  </div>
                  <button className="win98-button" onClick={() => setIsReviewOpen(true)} title="Tournament Match Review & Blunder Checker">📊 Review</button>
                  <div className="toolbar-separator" />
                  <button
                    className="win98-button"
                    style={{ fontWeight: isTournamentLayout ? "bold" : "normal", color: isTournamentLayout ? "#000080" : "inherit" }}
                    onClick={() => setIsTournamentLayout((prev) => !prev)}
                    title="Toggle Tournament Layout Mode"
                  >
                    {isTournamentLayout ? "🏆 Tournament View" : "📋 Standard View"}
                  </button>
                  <button
                    className="win98-button"
                    onClick={() => setZoomLevel((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}
                    title="Zoom Out (Ctrl+-)"
                  >
                    🔍-
                  </button>
                  <span
                    style={{ fontSize: "11px", fontWeight: "bold", padding: "0 2px", cursor: "pointer" }}
                    onClick={() => setZoomLevel(1)}
                    title="Click to reset zoom to 100% (Ctrl+0)"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    className="win98-button"
                    onClick={() => setZoomLevel((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
                    title="Zoom In (Ctrl++)"
                  >
                    🔍+
                  </button>
                </fieldset>
              </div>

              {/* Scoreboard Strip */}
              <div className="win98-inset" style={{ display: "flex", padding: "4px 12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", backgroundColor: inputMode === "me" ? "var(--w98-title-start)" : "transparent", color: inputMode === "me" ? "#fff" : "inherit", padding: "2px 6px" }}>
                    My Score:
                    <input type="text" inputMode="numeric" className="win98-input" style={{ width: "60px", textAlign: "right" }} value={myScore} onChange={(e) => setMyScore(e.target.value.replace(/[^0-9]/g, ""))} />
                  </label>
                  <button className="win98-button" onClick={() => setInputMode((m) => (m === "me" ? "opp" : "me"))} style={{ fontWeight: "bold", color: inputMode === "opp" ? "#cc0000" : "inherit" }}>
                    {inputMode === "me" ? "My Play 👤 (Alt+O)" : "Opponent Play 👿 (Alt+O)"}
                  </button>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", backgroundColor: inputMode === "opp" ? "#cc0000" : "transparent", color: inputMode === "opp" ? "#fff" : "#cc0000", padding: "2px 6px" }}>
                    Opponent Score:
                    <input type="text" inputMode="numeric" className="win98-input" style={{ width: "60px", textAlign: "right" }} value={oppScore} onChange={(e) => setOppScore(e.target.value.replace(/[^0-9]/g, ""))} />
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ fontSize: "11px" }}>
                    Bag: <strong>{bagCount}</strong>
                    <input type="range" min="0" max="86" value={bagCount} onChange={(e) => setBagCount(parseInt(e.target.value, 10))} style={{ width: "80px", verticalAlign: "middle", marginLeft: "4px" }} />
                  </div>
                  {/* Staged Move Commit/Revert HUD (Phase 3) */}
                  {stagedMoveEvaluation && stagedMoveEvaluation.isValid && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 6px", border: "1px solid var(--w98-border-dark)", background: "#e8ffe8" }}>
                      <span style={{ fontSize: "11px", fontWeight: "bold", color: "#006600" }}>
                        ✍ {stagedMoveEvaluation.cleanWord} ({stagedMoveEvaluation.posString}) +{stagedMoveEvaluation.score}
                      </span>
                      <button className="win98-button" onClick={commitCurrentPlay} style={{ fontWeight: "bold", color: "#006600" }} title="Enter">
                        ✔ Commit
                      </button>
                      <button className="win98-button" onClick={revertUncommittedTiles} style={{ color: "#cc0000" }} title="Esc">
                        ✖ Cancel
                      </button>
                    </div>
                  )}
                  {stagedMoveEvaluation && !stagedMoveEvaluation.isValid && (
                    <span style={{ fontSize: "10px", color: "#cc0000", fontWeight: "bold" }}>
                      ⚠ {stagedMoveEvaluation.reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Tournament Chess Clock (Phase 4) */}
              <TournamentClock
                inputMode={inputMode}
                isVisible={isClockVisible}
                onToggleVisible={() => setIsClockVisible(false)}
              />
            </div>

            {/* Main Layout: Board + Results */}
            <div className={`v3-layout ${isTournamentLayout ? "tournament-mode" : ""}`}>
              {/* Left Column: Board */}
              <div>
                {/* Phase 9: Sparring Arena Status Banner */}
                {isSparringActive && (
                  <div
                    className="win98-window"
                    style={{
                      marginBottom: "6px",
                      padding: "4px 8px",
                      backgroundColor: "#000080",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "6px",
                      fontSize: "11px",
                      boxShadow: "inset 1px 1px #fff, inset -1px -1px #000",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "14px" }}>
                        {activeSparringBot.avatar}
                      </span>
                      <strong style={{ letterSpacing: "0.5px" }}>
                        SPARRING VS {activeSparringBot.name.toUpperCase()}
                      </strong>
                      <span
                        style={{
                          padding: "1px 5px",
                          backgroundColor: "#ece9d8",
                          color: "#000",
                          fontSize: "10px",
                          fontWeight: "bold",
                          border: "1px inset #fff",
                        }}
                        title="Woogles.io Point Average"
                      >
                        {activeSparringBot.avgScore || activeSparringBot.rating}
                      </span>
                      {isBotThinking ? (
                        <span
                          style={{
                            padding: "1px 6px",
                            backgroundColor: "#ffeb3b",
                            color: "#000",
                            fontSize: "10px",
                            fontWeight: "bold",
                          }}
                        >
                          ⏳ {activeSparringBot.name} Thinking...
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "1px 6px",
                            backgroundColor: inputMode === "me" ? "#4caf50" : "#ff9800",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: "bold",
                          }}
                        >
                          {inputMode === "me" ? "👤 YOUR TURN" : `${activeSparringBot.avatar} ${activeSparringBot.name.toUpperCase()} TURN`}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", opacity: 0.9 }}>
                        Lead: {scoreDifferential >= 0 ? `+${scoreDifferential}` : scoreDifferential}
                      </span>
                      <span style={{ fontSize: "11px", opacity: 0.9 }}>
                        | Bag: {bagCount}
                      </span>
                      <button
                        className="win98-button"
                        style={{ padding: "1px 6px", fontSize: "10px", fontWeight: "bold" }}
                        onClick={() => setIsSteebotModalOpen(true)}
                      >
                        📊 Arena / Report
                      </button>
                      <button
                        className="win98-button"
                        style={{ padding: "1px 6px", fontSize: "10px", color: "#b71c1c" }}
                        onClick={handleStopSparring}
                        title="Stop Sparring Session"
                      >
                        ⏹️ Exit
                      </button>
                    </div>
                  </div>
                )}

                {/* Phase 9: Live Turn-by-Turn Equity Gap Bar */}
                {turnEquityFeedback && (
                  <div
                    style={{
                      marginBottom: "6px",
                      padding: "4px 8px",
                      backgroundColor: turnEquityFeedback.bg || "#e8f5e9",
                      color: turnEquityFeedback.color || "#1b5e20",
                      border: `1px solid ${turnEquityFeedback.color || "#1b5e20"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      fontSize: "11px",
                      boxShadow: "inset 1px 1px 0px #fff, 1px 1px 2px rgba(0,0,0,0.15)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: "1 1 auto", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "1px 5px",
                          backgroundColor: turnEquityFeedback.color,
                          color: "#fff",
                          fontWeight: "bold",
                          fontSize: "10px",
                          borderRadius: "2px",
                        }}
                      >
                        {turnEquityFeedback.badge}
                      </span>
                      <span style={{ fontWeight: "bold", fontSize: "11px" }}>
                        {turnEquityFeedback.equityLoss === 0
                          ? "0.0 Equity Loss"
                          : `-${turnEquityFeedback.equityLoss.toFixed(1)} pts`}
                      </span>
                      <span style={{ fontSize: "10px", color: "#333" }}>
                        {turnEquityFeedback.desc}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button
                        className="win98-button"
                        style={{ padding: "1px 5px", fontSize: "10px" }}
                        onClick={() => setIsSteebotModalOpen(true)}
                      >
                        📈 Timeline
                      </button>
                      <button
                        className="win98-button"
                        style={{ padding: "1px 5px", fontSize: "10px" }}
                        onClick={() => setTurnEquityFeedback(null)}
                        title="Dismiss feedback"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                <Board
                  board={board}
                  committedBoard={committedBoard}
                  tileOwners={tileOwners}
                  selectedCell={selectedCell}
                  typingDir={typingDir}
                  isBoardLocked={isBoardLocked}
                  hoveredPlay={hoveredPlay}
                  dangerSquares={dangerSquares}
                  onCellClick={handleCellClick}
                  activePreset={activePreset}
                  onCommit={commitCurrentPlay}
                  onRevert={revertUncommittedTiles}
                  onDropTile={handleDropTileOnBoard}
                  onReturnTileToRack={handleDropTileFromBoard}
                  inputMode={inputMode}
                />

                {/* Rack Tray (Feature 1 Drag & Drop + Feature 3 Exchange Simulation + Feature 5 Anagrams) */}
                <RackTray
                  rack={rack}
                  onRackChange={handleRackChange}
                  onShuffle={handleShuffleRack}
                  inputMode={inputMode}
                  isBoardLocked={isBoardLocked}
                  onDropTileFromBoard={handleDropTileFromBoard}
                  onDropTileOnBoard={handleDropTileOnBoard}
                  onRackTileClick={handleRackTileClick}
                  selectedRackTileIdx={selectedRackTile?.index}
                  scores={activePreset?.scores}
                  candidatePlays={plays}
                  bagCount={bagCount}
                  equityMode={equityMode}
                  onConfirmExchange={handleConfirmExchange}
                  onOpenAnagramExplorer={() => setIsAnagramModalOpen(true)}
                />

                {/* Match Replay Controls (Phase 7) */}
                <ReplayControls
                  currentTurnIdx={currentTurnIdx}
                  matchHistory={matchHistory}
                  onSelectTurn={handleSelectTurn}
                  onGcgUpload={handleGcgUpload}
                />

                {/* Unseen Tile Tracker (Phase 4) */}
                <UnseenTileTracker
                  board={board}
                  rack={rack}
                  enableIntel={enableIntel}
                  intelMode={intelMode}
                  manualAvailableTiles={manualAvailableTiles}
                  activePreset={activePreset}
                  lastOppContext={lastOppContext}
                />

                {/* Referee Word Checker (Phase 8) */}
                <RefereeChecker
                  activeLexicon={activeLexicon}
                  activePreset={activePreset}
                  lookupWord={lookupWord}
                  onInvalidWord={playWin98Chord}
                />
              </div>

              {/* Right Column: Intel & Plays */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {!isTournamentLayout && (
                  <>
                    {/* Intel Panel (Phase 4) */}
                    <IntelPanel
                      enableIntel={enableIntel}
                      onToggleIntel={setEnableIntel}
                      showIntelSettings={showIntelSettings}
                      onToggleIntelSettings={() => setShowIntelSettings((prev) => !prev)}
                      intelMode={intelMode}
                      onIntelModeChange={setIntelMode}
                      manualAvailableTiles={manualAvailableTiles}
                      onManualAvailableTilesChange={setManualAvailableTiles}
                    />

                    <BingoRadarHUD topPlay={topPlay} runwayScore={topPlay?.bingo_runway_score || 0} />
                  </>
                )}
                {isEndgame && topPlay && <EndgameExplorer endgamePlay={topPlay} />}
                <MoveList
                  plays={plays}
                  onHoverPlay={setHoveredPlay}
                  onApplyPlay={handleApplyPlay}
                  sortMode={sortMode}
                  onSortModeChange={setSortMode}
                  rack={rack}
                  activeLexicon={activeLexicon}
                  activePreset={activePreset}
                  highlightedPlayIndex={highlightedPlayIndex}
                  onSelectPlayIndex={(idx) => {
                    setHighlightedPlayIndex(idx);
                    if (idx >= 0 && plays[idx]) setHoveredPlay(plays[idx]);
                    else if (idx === -1) setHoveredPlay(null);
                  }}
                  scoreDifferential={scoreDifferential}
                  simQuality={simQuality}
                />
              </div>
            </div>
          </div>

          {/* Win98 Status Bar */}
          <StatusBar
            isSolving={isSolving}
            inputMode={inputMode}
            scoreDifferential={scoreDifferential}
            stagedMoveEvaluation={stagedMoveEvaluation}
          />
        </div>

        {/* Modals */}
        <GameReviewModal
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          currentMatchHistory={matchHistory}
          onSelectTurn={(turn, idx) => {
            setCurrentTurnIdx(idx);
            applyHistoricalTurn(turn);
            setIsReviewOpen(false);
          }}
        />
        <BlunderShieldModal
          isOpen={Boolean(blunderHazard)}
          hazard={blunderHazard}
          onClose={() => setBlunderHazard(null)}
          onDisableShield={() => setEnableBlunderShield(false)}
        />
        <BlankTileModal
          isOpen={Boolean(blankPrompt)}
          onClose={() => {
            if (blankPrompt && typeof blankPrompt === "object") {
              setRack((r) => (r.length < 7 ? r + "?" : r));
            }
            setBlankPrompt(null);
          }}
          onSelectLetter={handleSelectBlank}
        />
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />
        <HelpModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
        />
        <FloatingDefinitionTooltip
          hoveredPlay={hoveredPlay}
          lookupWord={lookupWord}
          activeLexicon={activeLexicon}
          onLeave={() => setHoveredPlay(null)}
        />
        <AnagramExplorerModal
          isOpen={isAnagramModalOpen}
          onClose={() => setIsAnagramModalOpen(false)}
          initialRack={rack}
          activeLexicon={activeLexicon}
        />
        <TrainingStudioModal
          isOpen={isTrainingStudioOpen}
          onClose={() => setIsTrainingStudioOpen(false)}
          activeLexicon={activeLexicon}
          onSetActiveLexicon={setActiveLexicon}
          equityMode={equityMode}
          onSetEquityMode={setEquityMode}
        />
        <SteebotArenaModal
          isOpen={isSteebotModalOpen}
          onClose={() => setIsSteebotModalOpen(false)}
          isSparringActive={isSparringActive}
          onStartSparring={handleStartSparring}
          onStopSparring={handleStopSparring}
          onTriggerBotMove={triggerSteebotMove}
          isBotThinking={isBotThinking}
          myScore={myScore}
          oppScore={oppScore}
          bagCount={bagCount}
          matchHistory={matchHistory}
          activeLexicon={activeLexicon}
          simQuality={simQuality}
          onSetSimQuality={setSimQuality}
          onReplayHistoricalTurn={(turn, idx) => {
            setCurrentTurnIdx(idx);
            applyHistoricalTurn(turn);
            setIsSteebotModalOpen(false);
          }}
        />
        {snapshotToast && (
          <div
            className="win98-window"
            style={{
              position: "fixed",
              bottom: "32px",
              right: "20px",
              padding: "6px 14px",
              zIndex: 999999,
              boxShadow: "3px 3px 12px rgba(0,0,0,0.5)",
              fontWeight: "bold",
              fontSize: "12px",
              color: "#006600",
              backgroundColor: "#f0fff0",
              border: "2px outset #ffffff",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>📸</span>
            <span>{snapshotToast}</span>
          </div>
        )}
      </div>
    </div>
  );
}
