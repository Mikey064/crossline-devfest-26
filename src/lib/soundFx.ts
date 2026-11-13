let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', gainPeak = 0.06, delayMs = 0) {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export function playMoveSound(symbol: 'X' | 'O', muted: boolean) {
  if (muted) return;
  if (symbol === 'X') {
    playTone(520, 90, 'triangle', 0.055);
  } else {
    playTone(390, 100, 'sine', 0.06);
  }
}

export function playWinSound(muted: boolean) {
  if (muted) return;
  playTone(523.25, 130, 'triangle', 0.06, 0);
  playTone(659.25, 130, 'triangle', 0.06, 90);
  playTone(783.99, 220, 'triangle', 0.07, 180);
}

export function playDrawSound(muted: boolean) {
  if (muted) return;
  playTone(349.23, 120, 'sine', 0.045, 0);
  playTone(329.63, 180, 'sine', 0.045, 110);
}

export function playRollbackSound(muted: boolean) {
  if (muted) return;
  playTone(480, 80, 'sine', 0.045, 0);
  playTone(360, 110, 'sine', 0.045, 70);
}
