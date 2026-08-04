// audio.js — tiny UI sound effects generated with an oscillator, so there's
// no click.ogg/level-up.ogg binary asset to bundle, host, or worry about
// licensing for. Sounds only play after a user gesture (click), which also
// satisfies browser autoplay-policy requirements for AudioContext.

let ctx = null;
function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq, duration, type = "square", startAt = 0, gain = 0.06 }) {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime + startAt);
  gainNode.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startAt + duration);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + startAt);
  osc.stop(audioCtx.currentTime + startAt + duration + 0.02);
}

export const uiSound = {
  enabled: true,

  setEnabled(value) {
    uiSound.enabled = value;
  },

  click() {
    if (!uiSound.enabled) return;
    tone({ freq: 780, duration: 0.05, type: "square", gain: 0.05 });
  },

  toggle() {
    if (!uiSound.enabled) return;
    tone({ freq: 520, duration: 0.06, type: "triangle", gain: 0.05 });
  },

  error() {
    if (!uiSound.enabled) return;
    tone({ freq: 180, duration: 0.15, type: "sawtooth", gain: 0.06 });
  },

  // Short ascending arpeggio — the "level up" style success cue used when
  // launch pre-processing completes / login succeeds.
  success() {
    if (!uiSound.enabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone({ freq, duration: 0.12, type: "triangle", startAt: i * 0.07, gain: 0.05 })
    );
  },
};
