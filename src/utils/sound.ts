type Tag = 'room-enter' | 'notification' | 'message' | 'win';

const MIN_SPACING_MS: Record<Tag, number> = {
  'room-enter': 250,
  notification: 350,
  message: 220,
  win: 400,
};

const lastPlayedAt: Record<Tag, number> = {
  'room-enter': 0,
  notification: 0,
  message: 0,
  win: 0,
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

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctxSingleton) return ctxSingleton;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctxSingleton = new Ctor();
  } catch {
    return null;
  }
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
  freqTo?: number;
  start: number;
  duration: number;
  gain: number;
  attack?: number;
  release?: number;
}

function playVoices(voices: Voice[], masterGain = 0.18, addNoise?: { duration: number; gain: number }) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      ctx.resume();
    } catch {}
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
    const dur = addNoise.duration;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
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

export function playRoomEnterSound() {
  if (!enabled) return;
  if (shouldThrottle('room-enter')) return;
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
  playVoices(
    [
      {
        type: 'sine',
        freq: 1318.51,
        start: 0,
        duration: 0.22,
        gain: 0.65,
        attack: 0.003,
        release: 0.3,
      },
      {
        type: 'sine',
        freq: 1760.0,
        start: 0.12,
        duration: 0.3,
        gain: 0.55,
        attack: 0.003,
        release: 0.4,
      },
      {
        type: 'sine',
        freq: 2637.02,
        start: 0.0,
        duration: 0.3,
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

export function playWinSound() {
  if (!enabled) return;
  if (shouldThrottle('win')) return;
  playVoices(
    [
      {
        type: 'sine',
        freq: 523.25, // C5
        start: 0,
        duration: 0.1,
        gain: 0.4,
      },
      {
        type: 'sine',
        freq: 659.25, // E5
        start: 0.08,
        duration: 0.1,
        gain: 0.45,
      },
      {
        type: 'sine',
        freq: 783.99, // G5
        start: 0.16,
        duration: 0.12,
        gain: 0.5,
      },
      {
        type: 'sine',
        freq: 1046.5, // C6
        start: 0.24,
        duration: 0.35,
        gain: 0.6,
        release: 0.3,
      },
    ],
    0.22,
  );
}
