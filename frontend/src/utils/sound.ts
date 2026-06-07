/**
 * Sound effects for the app.
 *
 * Three distinct, pleasant, synthesized SFX are produced live via the Web
 * Audio API — no asset files, no network requests, very small footprint.
 *
 * - playRoomEnterSound(): airy "whoosh-pop" → user enters the room
 * - playNotificationSound(): bright two-note "ding" → notification arrives
 * - playMessageSound(): soft "pop-tap" → message arrives (room or DM)
 *
 * On non-web platforms (iOS/Android via Expo) the calls are no-ops; bundle
 * real assets via expo-audio later if native sound is needed.
 *
 * All sounds respect a single in-process mute flag (`setSoundsEnabled`) and
 * are tagged with a minimum-spacing throttle so a flurry of arrivals does
 * not produce an unpleasant burst.
 */

import { Platform } from 'react-native';

type Tag = 'room-enter' | 'notification' | 'message';

const MIN_SPACING_MS: Record<Tag, number> = {
  'room-enter': 250,
  notification: 350,
  message: 220,
};

const lastPlayedAt: Record<Tag, number> = {
  'room-enter': 0,
  notification: 0,
  message: 0,
};

let enabled = true;
let ctxSingleton: AudioContext | null = null;
let unlockBound = false;

export function setSoundsEnabled(v: boolean) {
  enabled = v;
}

export function areSoundsEnabled() {
  return enabled;
}

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

function getAudioContext(): AudioContext | null {
  if (!isWeb()) return null;
  if (ctxSingleton) return ctxSingleton;
  // @ts-ignore — webkit prefix for older Safari
  const Ctor: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctxSingleton = new Ctor();
  } catch {
    return null;
  }
  // Most browsers require a user gesture to start audio. We bind a one-time
  // unlock on the first pointer/keyboard event so sound starts working after
  // the user interacts with the page at least once.
  if (!unlockBound) {
    unlockBound = true;
    const unlock = () => {
      try {
        ctxSingleton?.resume?.();
      } catch {}
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }
  return ctxSingleton;
}

function shouldThrottle(tag: Tag): boolean {
  const now = Date.now();
  if (now - lastPlayedAt[tag] < MIN_SPACING_MS[tag]) return true;
  lastPlayedAt[tag] = now;
  return false;
}

interface Voice {
  type: OscillatorType;
  freq: number;
  freqTo?: number; // optional pitch sweep target
  start: number; // offset seconds
  duration: number; // seconds
  gain: number; // peak gain 0..1
  attack?: number; // seconds
  release?: number; // seconds
}

function playVoices(voices: Voice[], masterGain = 0.18, addNoise?: { duration: number; gain: number }) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try { ctx.resume(); } catch {}
  }
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = masterGain;
  out.connect(ctx.destination);

  for (const v of voices) {
    const osc = ctx.createOscillator();
    osc.type = v.type;
    const g = ctx.createGain();
    const t0 = now + v.start;
    const tEnd = t0 + v.duration;
    const attack = v.attack ?? 0.005;
    const release = v.release ?? Math.max(0.04, v.duration * 0.6);

    osc.frequency.setValueAtTime(v.freq, t0);
    if (v.freqTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, v.freqTo), tEnd);
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v.gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, tEnd + release);

    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(tEnd + release + 0.02);
  }

  if (addNoise) {
    // Tiny burst of filtered noise — used for the "whoosh"
    const dur = addNoise.duration;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // White noise with light low-pass shaping
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + dur);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, now);
    ng.gain.linearRampToValueAtTime(addNoise.gain, now + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter).connect(ng).connect(out);
    src.start(now);
    src.stop(now + dur + 0.05);
  }
}

/* ----- Public players ----- */

export function playRoomEnterSound() {
  if (!enabled) return;
  if (shouldThrottle('room-enter')) return;
  // "Whoosh-pop": upward sine glide + soft noise burst.
  playVoices(
    [
      {
        type: 'sine',
        freq: 220,
        freqTo: 660,
        start: 0,
        duration: 0.22,
        gain: 0.55,
        attack: 0.01,
        release: 0.12,
      },
      {
        type: 'triangle',
        freq: 880,
        freqTo: 1320,
        start: 0.06,
        duration: 0.16,
        gain: 0.22,
        attack: 0.005,
        release: 0.08,
      },
    ],
    0.22,
    { duration: 0.18, gain: 0.06 },
  );
}

export function playNotificationSound() {
  if (!enabled) return;
  if (shouldThrottle('notification')) return;
  // Two-note "ding-ding" — bright bell-like.
  playVoices(
    [
      {
        type: 'sine',
        freq: 1318.51, // E6
        start: 0,
        duration: 0.22,
        gain: 0.65,
        attack: 0.003,
        release: 0.30,
      },
      {
        type: 'sine',
        freq: 1760.0, // A6
        start: 0.12,
        duration: 0.30,
        gain: 0.55,
        attack: 0.003,
        release: 0.40,
      },
      // Subtle harmonic for sparkle
      {
        type: 'sine',
        freq: 2637.02, // E7
        start: 0.0,
        duration: 0.30,
        gain: 0.12,
        attack: 0.003,
        release: 0.25,
      },
    ],
    0.18,
  );
}

export function playMessageSound() {
  if (!enabled) return;
  if (shouldThrottle('message')) return;
  // Soft percussive "pop-tap": short downward sine + quick triangle tap.
  playVoices(
    [
      {
        type: 'sine',
        freq: 660,
        freqTo: 420,
        start: 0,
        duration: 0.09,
        gain: 0.6,
        attack: 0.003,
        release: 0.08,
      },
      {
        type: 'triangle',
        freq: 1240,
        start: 0.02,
        duration: 0.07,
        gain: 0.2,
        attack: 0.002,
        release: 0.05,
      },
    ],
    0.2,
  );
}
