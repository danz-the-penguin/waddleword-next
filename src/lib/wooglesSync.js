// src/lib/wooglesSync.js - Woogles.io Match Sync API Client
// Connects to Woogles game service to retrieve tournament transcripts in GCG format.

/**
 * Extracts a Woogles game ID from a full match URL, share link, or raw string.
 * Supports URLs like:
 * - https://woogles.io/game/akPTPGHkN4
 * - https://woogles.io/game/live/akPTPGHkN4
 * - https://woogles.io/match/akPTPGHkN4
 * - akPTPGHkN4
 */
export function extractWooglesGameId(input) {
  if (!input) return "";
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/(?:game|match)(?:\/live)?\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  const bareMatch = trimmed.match(/^[a-zA-Z0-9_-]{6,40}$/);
  if (bareMatch) {
    return bareMatch[0];
  }

  return trimmed;
}

/**
 * Fetches the GCG transcript from Woogles metadata API service.
 * Returns { gameId, gcg }.
 */
export async function fetchWooglesGcg(input) {
  const gameId = extractWooglesGameId(input);
  if (!gameId) {
    throw new Error("Please provide a valid Woogles game URL or Game ID.");
  }

  try {
    const response = await fetch(
      "https://woogles.io/api/game_service.GameMetadataService/GetGCG",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ game_id: gameId }),
      }
    );

    if (!response.ok) {
      throw new Error(`Woogles service error (HTTP ${response.status})`);
    }

    const data = await response.json();
    if (data.code && data.message) {
      throw new Error(`Woogles: ${data.message}`);
    }

    const gcg = data.gcg || data.GCG || data.text;
    if (!gcg) {
      throw new Error("No GCG match transcript found in response.");
    }

    return { gameId, gcg };
  } catch (err) {
    // If browser CORS prevents direct fetch outside Tauri, advise user
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(
        "Network request failed (possibly CORS in web browser preview). You can paste the GCG text directly or run inside Tauri app."
      );
    }
    throw err;
  }
}
