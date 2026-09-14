// src/lib/boardSnapshot.js - HTML5 Canvas Board Snapshot Generator
// Exports high-resolution 2x Retina PNG snapshots of board positions to clipboard & disk

import { BOARD_PRESETS, COLUMNS, TILE_SCORES } from "./presets";

const PREMIUM_COLORS = {
  "3W": { bg: "#c0392b", fg: "#ffffff", label: "3W" },
  "2W": { bg: "#e84393", fg: "#ffffff", label: "2W" },
  "3L": { bg: "#0984e3", fg: "#ffffff", label: "3L" },
  "2L": { bg: "#74b9ff", fg: "#111111", label: "2L" },
  CENTER: { bg: "#e84393", fg: "#ffffff", label: "★" },
  NORMAL: { bg: "#ded7cc", fg: "#999999", label: "" },
};

/**
 * Generates an offscreen Canvas rendering the 15x15 Scrabble board at 2x resolution.
 */
export function generateBoardCanvas(board, options = {}) {
  const {
    myScore = 0,
    oppScore = 0,
    activeLexicon = "TWL06",
    turn = 1,
    bagCount = null,
    playerName = "Player",
    oppName = "Opponent",
    premiums = BOARD_PRESETS.scrabble.premiums,
    tileScores = TILE_SCORES,
  } = options;

  const dpr = 2; // 2x Retina resolution
  const cellSize = 44;
  const coordMargin = 28;
  const headerHeight = 64;
  const footerHeight = 28;
  const boardSize = 15 * cellSize;

  const totalWidth = boardSize + coordMargin * 2;
  const totalHeight = headerHeight + boardSize + coordMargin * 2 + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth * dpr;
  canvas.height = totalHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  // Background frame
  ctx.fillStyle = "#1e3a1e"; // Classic felt Scrabble green frame
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Header Banner
  ctx.fillStyle = "#142614";
  ctx.fillRect(0, 0, totalWidth, headerHeight);

  // Header Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px 'Segoe UI', Tahoma, sans-serif";
  ctx.fillText("WADDLEWORD NEXT • SCRABBLE POSITION", coordMargin, 26);

  // Header Subtext & Score
  ctx.font = "12px 'Segoe UI', Tahoma, sans-serif";
  ctx.fillStyle = "#a3e635"; // Accent lime
  ctx.fillText(
    `${playerName}: ${myScore} pts   vs   ${oppName}: ${oppScore} pts`,
    coordMargin,
    48
  );

  ctx.fillStyle = "#d1d5db";
  ctx.font = "11px 'Segoe UI', Tahoma, sans-serif";
  const lexInfo = `Lexicon: ${activeLexicon.toUpperCase()}  |  ${
    bagCount !== null ? `Bag: ${bagCount}  |  ` : ""
  }Turn: ${turn}`;
  const lexWidth = ctx.measureText(lexInfo).width;
  ctx.fillText(lexInfo, totalWidth - coordMargin - lexWidth, 48);

  // Board Offset Coordinates
  const boardX = coordMargin;
  const boardY = headerHeight + coordMargin;

  // Board Background Grid Border
  ctx.fillStyle = "#111827";
  ctx.fillRect(boardX - 1, boardY - 1, boardSize + 2, boardSize + 2);

  // Coordinate Labels (A-O Columns, 1-15 Rows)
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "#d1d5db";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let c = 0; c < 15; c++) {
    const colName = COLUMNS[c];
    const x = boardX + c * cellSize + cellSize / 2;
    // Top column label
    ctx.fillText(colName, x, headerHeight + coordMargin / 2);
    // Bottom column label
    ctx.fillText(colName, x, boardY + boardSize + coordMargin / 2);
  }

  for (let r = 0; r < 15; r++) {
    const rowName = String(r + 1);
    const y = boardY + r * cellSize + cellSize / 2;
    // Left row label
    ctx.fillText(rowName, coordMargin / 2, y);
    // Right row label
    ctx.fillText(rowName, totalWidth - coordMargin / 2, y);
  }

  // Draw 15x15 Cells
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const cellX = boardX + c * cellSize;
      const cellY = boardY + r * cellSize;
      const premiumKey = `${r},${c}`;
      const premiumType = premiums[premiumKey] || "NORMAL";
      const style = PREMIUM_COLORS[premiumType] || PREMIUM_COLORS.NORMAL;

      // Cell square
      ctx.fillStyle = style.bg;
      ctx.fillRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);

      const tileLetter = board?.[r]?.[c];

      if (!tileLetter) {
        // Draw empty premium label or star
        if (style.label) {
          ctx.fillStyle = style.fg;
          ctx.font = style.label === "★" ? "bold 18px sans-serif" : "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(style.label, cellX + cellSize / 2, cellY + cellSize / 2);
        }
      } else {
        // Placed wooden tile
        const isBlank = tileLetter === tileLetter.toLowerCase() && /[a-z]/.test(tileLetter);
        const letterUpper = tileLetter.toUpperCase();
        const scoreVal = isBlank ? 0 : (tileScores[letterUpper] ?? 0);

        // Tile bevel shadow
        ctx.fillStyle = "#cbb28d";
        ctx.fillRect(cellX + 2, cellY + 2, cellSize - 4, cellSize - 4);

        // Tile face
        ctx.fillStyle = "#fdfbf7";
        ctx.fillRect(cellX + 2.5, cellY + 2.5, cellSize - 5, cellSize - 5);

        // Letter
        ctx.fillStyle = isBlank ? "#0066cc" : "#1a1a1a";
        ctx.font = "bold 20px 'Segoe UI', Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letterUpper, cellX + cellSize / 2 - 3, cellY + cellSize / 2);

        // Point score subscript
        if (!isBlank && scoreVal > 0) {
          ctx.font = "bold 9px 'Segoe UI', Tahoma, sans-serif";
          ctx.fillStyle = "#333333";
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText(String(scoreVal), cellX + cellSize - 4, cellY + cellSize - 3);
        }
      }
    }
  }

  // Footer Banner
  ctx.fillStyle = "#142614";
  ctx.fillRect(0, totalHeight - footerHeight, totalWidth, footerHeight);

  ctx.font = "10px 'Segoe UI', Tahoma, sans-serif";
  ctx.fillStyle = "#9ca3af";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Generated by WaddleWord Next (Tauri Scrabble Engine)",
    totalWidth / 2,
    totalHeight - footerHeight / 2
  );

  return canvas;
}

/**
 * Exports board canvas directly to a PNG Blob.
 */
export function exportBoardToBlob(board, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = generateBoardCanvas(board, options);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas blob conversion failed"));
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Copies high-res board snapshot directly to the OS system clipboard.
 */
export async function copyBoardToClipboard(board, options = {}) {
  const blob = await exportBoardToBlob(board, options);
  if (navigator?.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([
      new window.ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  }
  throw new Error("Clipboard API not supported in this environment");
}

/**
 * Downloads high-res board snapshot PNG to the user's downloads folder.
 */
export async function downloadBoardAsPng(
  board,
  options = {},
  filename = "waddleword-board.png"
) {
  const blob = await exportBoardToBlob(board, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
