// src/lib/coachingEngine.js - Grandmaster Sparring & Coaching Engine
// Evaluates equity loss, grades player accuracy, and manages tournament tile bag

export const STANDARD_ENGLISH_TILES =
  "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ??";

/**
 * Creates a freshly shuffled tournament Scrabble tile bag (100 tiles).
 */
export function createShuffledBag() {
  const tiles = STANDARD_ENGLISH_TILES.split("");
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/**
 * Draws N tiles from the bag.
 * Returns { drawn: string[], remainingBag: string[] }
 */
export function drawTiles(bag, count) {
  const numToDraw = Math.min(count, bag.length);
  const drawn = bag.slice(0, numToDraw);
  const remainingBag = bag.slice(numToDraw);
  return { drawn, remainingBag };
}

/**
 * Replenishes a rack from the bag up to targetSize (default 7).
 * Returns { newRack: string, remainingBag: string[], drawnCount: number }
 */
export function replenishRack(currentRack, bag, targetSize = 7) {
  const needed = Math.max(0, targetSize - currentRack.length);
  const { drawn, remainingBag } = drawTiles(bag, needed);
  const newRack = (currentRack + drawn.join("")).toUpperCase();
  return { newRack, remainingBag, drawnCount: drawn.length };
}

/**
 * Evaluates the strategic quality of a move made by the player.
 * Compares against the engine's #1 optimal play.
 */
export function evaluateTurnQuality({
  playedWord,
  playedScore,
  playedVal,
  optimalPlay,
  plays = [],
}) {
  if (!optimalPlay) {
    return {
      equityLoss: 0,
      rating: "gm",
      badge: "🌟 GM MOVE",
      title: "Grandmaster Move",
      color: "#1b5e20",
      bg: "#e8f5e9",
      desc: `Played ${playedWord} for +${playedScore} pts.`,
    };
  }

  const cleanPlayed = (playedWord || "").toUpperCase().trim();
  const cleanOptimal = (optimalPlay.word || "").toUpperCase().trim();
  const isMatch = cleanPlayed === cleanOptimal || (optimalPlay.is_exchange && cleanPlayed.startsWith("EXCH"));

  if (isMatch) {
    return {
      equityLoss: 0.0,
      rating: "gm",
      badge: "🌟 GRANDMASTER",
      title: "Grandmaster Choice",
      color: "#1b5e20",
      bg: "#e8f5e9",
      desc: `Flawless! Matches Steebot's #1 move (+${playedScore} pts, 0.0 equity loss).`,
    };
  }

  // Look for the played word among candidate plays to get its exact total_val
  const matchInCandidates = plays.find(
    (p) => (p.word || "").toUpperCase().trim() === cleanPlayed
  );

  const playedTotalVal = matchInCandidates
    ? matchInCandidates.total_val
    : playedVal != null
    ? playedVal
    : playedScore;

  const rawLoss = optimalPlay.total_val - playedTotalVal;
  const equityLoss = Math.max(0, Math.round(rawLoss * 10) / 10);

  if (equityLoss <= 0.8) {
    return {
      equityLoss,
      rating: "gm",
      badge: "🌟 GRANDMASTER",
      title: "Grandmaster Move",
      color: "#1b5e20",
      bg: "#e8f5e9",
      desc: `Near perfect: -${equityLoss} pts from top line (${optimalPlay.word} for +${optimalPlay.score} pts).`,
    };
  }

  if (equityLoss <= 2.8) {
    return {
      equityLoss,
      rating: "strong",
      badge: "👍 STRONG MOVE",
      title: "Strong Choice",
      color: "#0d47a1",
      bg: "#e3f2fd",
      desc: `Solid move: -${equityLoss} pts. Optimal was ${optimalPlay.word} (+${optimalPlay.score} pts).`,
    };
  }

  if (equityLoss <= 7.5) {
    return {
      equityLoss,
      rating: "inaccuracy",
      badge: "⚠️ INACCURACY",
      title: "Positional Inaccuracy",
      color: "#e65100",
      bg: "#fff3e0",
      desc: `Inaccuracy (-${equityLoss} pts): Played ${cleanPlayed} (+${playedScore}). Steebot preferred ${optimalPlay.word} (+${optimalPlay.score} pts, +${optimalPlay.total_val} eq).`,
    };
  }

  if (equityLoss <= 17.0) {
    return {
      equityLoss,
      rating: "mistake",
      badge: "⚠️ MISTAKE",
      title: "Strategic Mistake",
      color: "#b71c1c",
      bg: "#ffebee",
      desc: `Mistake (-${equityLoss} pts): Sacrificed major equity! Steebot recommended ${optimalPlay.word} (+${optimalPlay.score} pts, leave: ${optimalPlay.leave}).`,
    };
  }

  return {
    equityLoss,
    rating: "blunder",
    badge: "🛑 CRITICAL BLUNDER",
    title: "Critical Blunder",
    color: "#ffffff",
    bg: "#b71c1c",
    desc: `Blunder (-${equityLoss} pts): Heavy concession! Steebot found ${optimalPlay.word} (+${optimalPlay.score} pts, +${optimalPlay.total_val} equity).`,
  };
}

/**
 * Generates a comprehensive tournament coaching report from matchHistory.
 */
export function generateMatchCoachingReport(matchHistory = []) {
  const playerTurns = matchHistory.filter((t) => t.player === "me" || t.playerName === "Me" || t.playerName === "You");
  const oppTurns = matchHistory.filter((t) => t.player === "opp" || t.playerName === "Opponent" || t.playerName === "Steebot");

  const totalTurns = playerTurns.length;
  const playerScore = playerTurns.reduce((acc, t) => acc + (t.score || 0), 0);
  const oppScore = oppTurns.reduce((acc, t) => acc + (t.score || 0), 0);

  let totalEquityLoss = 0;
  let gmCount = 0;
  let strongCount = 0;
  let inaccuracyCount = 0;
  let mistakeCount = 0;
  let blunderCount = 0;
  let playerBingos = 0;
  let oppBingos = 0;

  const evaluatedTurns = [];

  for (const t of playerTurns) {
    const loss = Number(t.equityLoss) || 0;
    totalEquityLoss += loss;

    if (loss <= 0.8) gmCount++;
    else if (loss <= 2.8) strongCount++;
    else if (loss <= 7.5) inaccuracyCount++;
    else if (loss <= 17.0) mistakeCount++;
    else blunderCount++;

    if ((t.word && t.word.replace(/[^a-zA-Z]/g, "").length >= 7) || (t.score && t.score >= 50)) {
      playerBingos++;
    }

    evaluatedTurns.push({
      ...t,
      loss,
    });
  }

  for (const t of oppTurns) {
    if ((t.word && t.word.replace(/[^a-zA-Z]/g, "").length >= 7) || (t.score && t.score >= 50)) {
      oppBingos++;
    }
  }

  const avgLoss = totalTurns > 0 ? Math.round((totalEquityLoss / totalTurns) * 10) / 10 : 0;
  const accuracyPct = Math.max(
    0,
    Math.min(100, Math.round((100 - avgLoss * 4.0) * 10) / 10)
  );

  let letterGrade = "A+";
  let gradeTitle = "Grandmaster Tier";
  let gradeColor = "#1b5e20";

  if (avgLoss <= 2.0 && accuracyPct >= 92) {
    letterGrade = "A+";
    gradeTitle = "Grandmaster Champion";
    gradeColor = "#1b5e20";
  } else if (avgLoss <= 4.0 && accuracyPct >= 84) {
    letterGrade = "A";
    gradeTitle = "Tournament Master";
    gradeColor = "#2e7d32";
  } else if (avgLoss <= 7.5 && accuracyPct >= 70) {
    letterGrade = "B";
    gradeTitle = "Expert Player";
    gradeColor = "#0277bd";
  } else if (avgLoss <= 14.0 && accuracyPct >= 52) {
    letterGrade = "C";
    gradeTitle = "Club Competitor";
    gradeColor = "#e65100";
  } else {
    letterGrade = "D";
    gradeTitle = "Novice Apprentice";
    gradeColor = "#c62828";
  }

  // Sort turns by equity loss descending to pick top 3 blunders
  const topBlunders = [...evaluatedTurns]
    .filter((t) => t.loss >= 3.0)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 3);

  return {
    totalTurns,
    playerScore,
    oppScore,
    spread: playerScore - oppScore,
    totalEquityLoss: Math.round(totalEquityLoss * 10) / 10,
    avgLoss,
    accuracyPct,
    letterGrade,
    gradeTitle,
    gradeColor,
    gmCount,
    strongCount,
    inaccuracyCount,
    mistakeCount,
    blunderCount,
    playerBingos,
    oppBingos,
    topBlunders,
    evaluatedTurns,
  };
}
