import { useState, useCallback, useRef, useEffect } from 'react';

const clone2D = (arr) => (arr ? arr.map((r) => [...r]) : arr);

/**
 * useScrabbleHistory - Single-turn Undo/Redo history management for the Scrabble game state.
 * Manages snapshots of: board, rack, tileOwners, myScore, oppScore, committedBoard, inputMode, matchHistory, currentTurnIdx.
 * Keeps up to 50 undo states.
 */
export function useScrabbleHistory(
  board, setBoard, 
  rack, setRack, 
  tileOwners, setTileOwners,
  myScore, setMyScore,
  oppScore, setOppScore,
  setHoveredPlay,
  committedBoard, setCommittedBoard,
  inputMode, setInputMode,
  matchHistory, setMatchHistory,
  currentTurnIdx, setCurrentTurnIdx
) {
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const boardRef = useRef(board);
  const rackRef = useRef(rack);
  const tileOwnersRef = useRef(tileOwners);
  const myScoreRef = useRef(myScore);
  const oppScoreRef = useRef(oppScore);
  const committedBoardRef = useRef(committedBoard);
  const inputModeRef = useRef(inputMode);
  const matchHistoryRef = useRef(matchHistory);
  const currentTurnIdxRef = useRef(currentTurnIdx);

  useEffect(() => {
    boardRef.current = board;
    rackRef.current = rack;
    tileOwnersRef.current = tileOwners;
    myScoreRef.current = myScore;
    oppScoreRef.current = oppScore;
    committedBoardRef.current = committedBoard;
    inputModeRef.current = inputMode;
    matchHistoryRef.current = matchHistory;
    currentTurnIdxRef.current = currentTurnIdx;
  }, [board, rack, tileOwners, myScore, oppScore, committedBoard, inputMode, matchHistory, currentTurnIdx]);

  const captureCurrentSnapshot = useCallback(() => ({
    board: clone2D(boardRef.current), 
    rack: rackRef.current,
    tileOwners: clone2D(tileOwnersRef.current),
    myScore: myScoreRef.current,
    oppScore: oppScoreRef.current,
    committedBoard: clone2D(committedBoardRef.current),
    inputMode: inputModeRef.current,
    matchHistory: matchHistoryRef.current ? matchHistoryRef.current.map((t) => ({ ...t })) : [],
    currentTurnIdx: currentTurnIdxRef.current,
  }), []);

  const pushHistory = useCallback(() => {
    const snapshot = captureCurrentSnapshot();
    setPast((p) => [...p.slice(-49), snapshot]);
    setFuture([]);
  }, [captureCurrentSnapshot]);

  const handleUndo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      const snapshot = captureCurrentSnapshot();
      
      // Update future cleanly without nested callback side-effects
      setFuture((f) => [snapshot, ...f]);

      setBoard(clone2D(previous.board));
      setRack(previous.rack);
      setTileOwners(clone2D(previous.tileOwners));
      setMyScore(previous.myScore);
      setOppScore(previous.oppScore);
      if (setCommittedBoard && previous.committedBoard) {
        setCommittedBoard(clone2D(previous.committedBoard));
      }
      if (setInputMode && previous.inputMode) {
        setInputMode(previous.inputMode);
      }
      if (setMatchHistory && previous.matchHistory) {
        setMatchHistory(previous.matchHistory.map((t) => ({ ...t })));
      }
      if (setCurrentTurnIdx && previous.currentTurnIdx != null) {
        setCurrentTurnIdx(previous.currentTurnIdx);
      }
      if (setHoveredPlay) setHoveredPlay(null);
      return p.slice(0, -1);
    });
  }, [captureCurrentSnapshot, setBoard, setRack, setTileOwners, setMyScore, setOppScore, setCommittedBoard, setInputMode, setMatchHistory, setCurrentTurnIdx, setHoveredPlay]);

  const handleRedo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      const snapshot = captureCurrentSnapshot();

      setPast((p) => [...p, snapshot]);

      setBoard(clone2D(next.board));
      setRack(next.rack);
      setTileOwners(clone2D(next.tileOwners));
      setMyScore(next.myScore);
      setOppScore(next.oppScore);
      if (setCommittedBoard && next.committedBoard) {
        setCommittedBoard(clone2D(next.committedBoard));
      }
      if (setInputMode && next.inputMode) {
        setInputMode(next.inputMode);
      }
      if (setMatchHistory && next.matchHistory) {
        setMatchHistory(next.matchHistory.map((t) => ({ ...t })));
      }
      if (setCurrentTurnIdx && next.currentTurnIdx != null) {
        setCurrentTurnIdx(next.currentTurnIdx);
      }
      if (setHoveredPlay) setHoveredPlay(null);
      return f.slice(1);
    });
  }, [captureCurrentSnapshot, setBoard, setRack, setTileOwners, setMyScore, setOppScore, setCommittedBoard, setInputMode, setMatchHistory, setCurrentTurnIdx, setHoveredPlay]);

  return {
    past,
    setPast,
    future,
    setFuture,
    pushHistory,
    handleUndo,
    handleRedo,
  };
}
