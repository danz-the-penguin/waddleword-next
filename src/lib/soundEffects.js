// src/lib/soundEffects.js - Web Audio API Sound Synthesizer with Master Volume & Soundpacks
// Supports Win98 synth, Organic Wood acoustics, and Tournament Silent modes.

let audioCtx = null;
let masterGainNode = null;
let isMuted = false;
let soundVolume = 0.75;
let currentSoundpack = "win98"; // "win98" | "wood" | "silent"

// Restore user preferences from localStorage
try {
  if (typeof window !== "undefined" && window.localStorage) {
    const savedMuted = localStorage.getItem("waddleword_sound_muted");
    if (savedMuted !== null) isMuted = savedMuted === "true";

    const savedVol = localStorage.getItem("waddleword_sound_volume");
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) soundVolume = parsed;
    }

    const savedPack = localStorage.getItem("waddleword_soundpack");
    if (savedPack && ["win98", "wood", "silent"].includes(savedPack)) {
      currentSoundpack = savedPack;
    }
  }
} catch {
  // Ignore storage errors
}

export function isSoundMuted() {
  return isMuted;
}

export function setSoundMuted(muted) {
  isMuted = Boolean(muted);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("waddleword_sound_muted", String(isMuted));
    }
  } catch {}
  updateMasterGain();
}

export function toggleSound() {
  setSoundMuted(!isMuted);
  if (!isMuted) {
    playTileClack();
  }
  return isMuted;
}

export function getSoundVolume() {
  return soundVolume;
}

export function setSoundVolume(vol) {
  const clamped = Math.max(0, Math.min(1, Number(vol)));
  soundVolume = clamped;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("waddleword_sound_volume", String(clamped));
    }
  } catch {}
  updateMasterGain();
}

export function getSoundpack() {
  return currentSoundpack;
}

export function setSoundpack(pack) {
  if (["win98", "wood", "silent"].includes(pack)) {
    currentSoundpack = pack;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("waddleword_soundpack", pack);
      }
    } catch {}
    if (pack !== "silent") {
      playTileClack();
    }
  }
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      masterGainNode = audioCtx.createGain();
      masterGainNode.connect(audioCtx.destination);
      updateMasterGain();
    }
  }
  return audioCtx;
}

function updateMasterGain() {
  if (!masterGainNode || !audioCtx) return;
  const targetGain = isMuted || currentSoundpack === "silent" ? 0 : soundVolume;
  try {
    masterGainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);
  } catch {}
}

// Proactive user interaction listener for audio context unlock
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("click", unlockAudio, { passive: true });
}

function runWithActiveContext(playbackFn) {
  if (isMuted || currentSoundpack === "silent" || typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (!ctx || !masterGainNode) return;

  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => {
        try {
          playbackFn(ctx, masterGainNode);
        } catch (err) {
          console.error("Audio playback error:", err);
        }
      })
      .catch(() => {});
  } else {
    try {
      playbackFn(ctx, masterGainNode);
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }
}

/**
 * Tactical Scrabble tile clack.
 * Adapts based on currentSoundpack ("wood" vs "win98").
 */
export function playTileClack() {
  runWithActiveContext((ctx, out) => {
    const t = ctx.currentTime;

    if (currentSoundpack === "wood") {
      // Physical Wood acoustics: randomized pitch resonance + bandpass filter
      const pitchVariance = 0.92 + Math.random() * 0.16; // +/- 8%
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(540 * pitchVariance, t);
      osc.frequency.exponentialRampToValueAtTime(110 * pitchVariance, t + 0.045);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200 * pitchVariance, t);
      filter.Q.value = 3.5;

      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc.start(t);
      osc.stop(t + 0.055);
    } else {
      // Vintage Win98: retro square-wave click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "square";
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.035);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(4500, t);
      filter.frequency.exponentialRampToValueAtTime(250, t + 0.04);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc.start(t);
      osc.stop(t + 0.045);
    }
  });
}

/**
 * Windows 98 major chord tone.
 */
export function playWin98Chord() {
  runWithActiveContext((ctx, out) => {
    const t = ctx.currentTime;
    const isWood = currentSoundpack === "wood";

    const playTone = (freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isWood ? "sine" : "triangle";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + (isWood ? 0.6 : 0.9));

      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + (isWood ? 0.65 : 1.0));
    };

    playTone(440);
    playTone(554.37);
    playTone(659.25);
  });
}

/**
 * Notification chime (alias or pleasant alert).
 */
export function playChime() {
  runWithActiveContext((ctx, out) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.12);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.26);
  });
}

/**
 * Subtle Windows 98 UI button click sound.
 */
export function playButtonClick() {
  runWithActiveContext((ctx, out) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.025);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.025);

    osc.connect(gain);
    gain.connect(out);

    osc.start(t);
    osc.stop(t + 0.03);
  });
}

/**
 * 4-note ascending celebratory chime for 7-tile bingos.
 */
export function playBingoChime() {
  runWithActiveContext((ctx, out) => {
    const t = ctx.currentTime;
    const isWood = currentSoundpack === "wood";
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const delay = i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isWood ? "triangle" : "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.35, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delay + (isWood ? 0.4 : 0.55));

      osc.connect(gain);
      gain.connect(out);
      osc.start(t + delay);
      osc.stop(t + delay + (isWood ? 0.45 : 0.6));
    });
  });
}
