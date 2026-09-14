// src/lib/dragDropManager.js - 100% Cross-Platform Drag & Drop Payload Manager
// Solves WebKit / Safari / WKWebView dataTransfer restrictions in Tauri v2.

let activeDragPayload = null;
let lastDragPayload = null;
let clearTimer = null;
let selectedRackTile = null;

const subscribers = new Set();

function notifySubscribers() {
  for (const fn of subscribers) {
    try {
      fn();
    } catch (err) {
      console.error("DragDrop subscriber error:", err);
    }
  }
}

export function subscribeDragDrop(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function setSelectedRackTile(tile) {
  selectedRackTile = tile;
  notifySubscribers();
}

export function getSelectedRackTile() {
  return selectedRackTile;
}

export function clearSelectedRackTile() {
  selectedRackTile = null;
  notifySubscribers();
}

export function setActiveDragPayload(payload) {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  activeDragPayload = payload;
  lastDragPayload = payload;
}

export function getActiveDragPayload() {
  return activeDragPayload || lastDragPayload;
}

/**
 * Clears active payload. Does NOT immediately wipe lastDragPayload unless immediate === true,
 * ensuring asynchronous drop events in WKWebView / WebKit can read the payload before it expires.
 */
export function clearActiveDragPayload(immediate = false) {
  activeDragPayload = null;
  if (immediate) {
    lastDragPayload = null;
  } else {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      lastDragPayload = null;
    }, 1500);
  }
}

/**
 * Attaches drag payload to both in-memory store and dataTransfer (supporting multiple MIME types).
 */
export function setDragData(e, payload) {
  setActiveDragPayload(payload);
  if (!e?.dataTransfer) return;

  const jsonStr = JSON.stringify(payload);
  try {
    e.dataTransfer.setData("text/plain", jsonStr);
  } catch {}
  try {
    e.dataTransfer.setData("application/json", jsonStr);
  } catch {}
  try {
    e.dataTransfer.setData("text", jsonStr);
  } catch {}
  e.dataTransfer.effectAllowed = "move";
}

/**
 * Retrieves drag payload from in-memory store or dataTransfer fallbacks.
 */
export function getDragData(e) {
  // First check in-memory store (most reliable in WKWebView)
  if (activeDragPayload) {
    return activeDragPayload;
  }
  if (lastDragPayload) {
    return lastDragPayload;
  }

  if (!e?.dataTransfer) return null;

  // Try multiple MIME types
  const types = ["application/json", "text/plain", "text"];
  for (const type of types) {
    try {
      const raw = e.dataTransfer.getData(type);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
  }

  return null;
}
