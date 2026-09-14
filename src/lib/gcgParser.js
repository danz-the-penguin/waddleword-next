// src/lib/gcgParser.js - Tournament GCG transcript parser
// Ported from original waddleword web app, adapted for waddleword-next (null empty cells)

export function parseGcgFile(fileContent) {
  const lines = fileContent.split(/\r?\n/);
  const history = [];

  let player1 = null;
  let player2 = null;

  let currentBoard = Array.from({ length: 15 }, () => Array(15).fill(null));
  let currentOwners = Array.from({ length: 15 }, () => Array(15).fill(""));
  let p1Score = 0;
  let p2Score = 0;
  let lastPlacedByP1 = [];
  let lastPlacedByP2 = [];

  for (const line of lines) {
    if (line.startsWith("#player1")) {
      player1 = line.split(" ")[1] || "Player 1";
    } else if (line.startsWith("#player2")) {
      player2 = line.split(" ")[1] || "Player 2";
    } else if (line.startsWith(">")) {
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 4) {
        let rawName = parts[0];
        if (rawName.startsWith(">")) rawName = rawName.substring(1);
        if (rawName.endsWith(":")) rawName = rawName.substring(0, rawName.length - 1);
        const playerName = rawName;

        if (!player1) player1 = playerName;
        if (!player2 && playerName !== player1) player2 = playerName;

        const isPlayer1 = playerName === player1;

        // Check for endgame rack adjustment lines: >player: (XYZ) -10 350
        if (parts.length === 4 && parts[1].startsWith("(") && parts[1].endsWith(")")) {
          const rack = parts[1];
          const score = parseInt(parts[2], 10) || 0;
          if (isPlayer1) p1Score += score;
          else p2Score += score;

          history.push({
            turnNum: history.length + 1,
            player: isPlayer1 ? "me" : "opp",
            playerName,
            rack,
            myScore: p1Score,
            oppScore: p2Score,
            board: currentBoard.map((row) => [...row]),
            tileOwners: currentOwners.map((row) => [...row]),
          });
          continue;
        }

        if (parts.length >= 5) {
          const rack = parts[1];
          const pos = parts[2];
          let rawWord = parts[3];
          const score = parseInt(parts[4], 10) || 0;

          if (isPlayer1) p1Score += score;
          else p2Score += score;

          // Check for challenge takeback: pos === '--' or rawWord === '--'
          if (pos === "--" || rawWord === "--") {
            const toRevert = isPlayer1 ? lastPlacedByP1 : lastPlacedByP2;
            for (const p of toRevert) {
              currentBoard[p.r][p.c] = null;
              currentOwners[p.r][p.c] = "";
            }
            if (isPlayer1) lastPlacedByP1 = [];
            else lastPlacedByP2 = [];

            history.push({
              turnNum: history.length + 1,
              player: isPlayer1 ? "me" : "opp",
              playerName,
              rack,
              pos: "--",
              word: "--",
              score,
              myScore: p1Score,
              oppScore: p2Score,
              board: currentBoard.map((row) => [...row]),
              tileOwners: currentOwners.map((row) => [...row]),
              isChallenge: true,
            });
            continue;
          }

          if (/[0-9]/.test(pos) && /[A-Za-z]/.test(pos)) {
            let dir = "H";
            let row = 0;
            let col = 0;

            if (/[0-9]/.test(pos[0])) {
              dir = "H";
              const numMatch = pos.match(/[0-9]+/);
              const letterMatch = pos.match(/[A-Za-z]+/);
              row = parseInt(numMatch[0], 10) - 1;
              col = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
            } else {
              dir = "V";
              const letterMatch = pos.match(/[A-Za-z]+/);
              const numMatch = pos.match(/[0-9]+/);
              col = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
              row = parseInt(numMatch[0], 10) - 1;
            }

            const word = rawWord.replace(/[()]/g, "");
            const newlyPlaced = [];
            for (let i = 0; i < word.length; i++) {
              const r = dir === "V" ? row + i : row;
              const c = dir === "H" ? col + i : col;
              if (r >= 0 && r < 15 && c >= 0 && c < 15) {
                if (!currentBoard[r][c]) {
                  const char = word[i];
                  currentBoard[r][c] = char;
                  currentOwners[r][c] = isPlayer1 ? "me" : "opp";
                  newlyPlaced.push({ r, c });
                }
              }
            }
            if (isPlayer1) lastPlacedByP1 = newlyPlaced;
            else lastPlacedByP2 = newlyPlaced;
          }

          history.push({
            turnNum: history.length + 1,
            player: isPlayer1 ? "me" : "opp",
            playerName,
            rack,
            pos,
            word: rawWord,
            score,
            myScore: p1Score,
            oppScore: p2Score,
            board: currentBoard.map((row) => [...row]),
            tileOwners: currentOwners.map((row) => [...row]),
          });
        }
      }
    }
  }
  return history;
}

/**
 * Serializes match history turns into standard tournament GCG format (.gcg)
 * Compatible with Woogles, Quackle, CoCo, and Cross-Tables.
 */
export function serializeMatchToGcg(history, metadata = {}) {
  const p1 = metadata.player1 || "Me";
  const p2 = metadata.player2 || "Opponent";
  const lexicon = (metadata.lexicon || "TWL06").toUpperCase();
  const title = metadata.title || "WaddleWord Next Tournament Match";

  const lines = [
    `#player1 ${p1} ${p1}`,
    `#player2 ${p2} ${p2}`,
    `#description ${title}`,
    `#lexicon ${lexicon}`,
  ];

  let cumulativeP1 = 0;
  let cumulativeP2 = 0;

  for (let i = 0; i < history.length; i++) {
    const turn = history[i];
    const isP1 = turn.player === "me" || turn.playerName === p1;
    const name = isP1 ? p1 : p2;
    const rack = (turn.rack || "-------").toUpperCase();
    const score = Number(turn.score) || 0;

    if (isP1) cumulativeP1 += score;
    else cumulativeP2 += score;

    const cumulative = isP1 ? cumulativeP1 : cumulativeP2;
    const pos = turn.pos || turn.coord || "--";
    const word = (turn.word || "--").toUpperCase();

    lines.push(`>${name}: ${rack} ${pos} ${word} ${score} ${cumulative}`);
  }

  return lines.join("\n");
}

export function downloadMatchAsGcg(history, metadata = {}) {
  const gcgText = serializeMatchToGcg(history, metadata);
  const blob = new Blob([gcgText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `waddleword_match_${dateStr}.gcg`;
  a.click();
  URL.revokeObjectURL(url);
  return gcgText;
}

export async function copyMatchGcgToClipboard(history, metadata = {}) {
  const gcgText = serializeMatchToGcg(history, metadata);
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(gcgText);
  }
  return gcgText;
}
