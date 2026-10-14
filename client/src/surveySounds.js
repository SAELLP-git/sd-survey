let context;

function audioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!context) context = new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function bubble(ctx, start, from, to, volume = 0.045) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + 0.11);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.14);
}

export function playChoiceSound() {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  bubble(ctx, now, 520, 790, 0.035);
  bubble(ctx, now + 0.035, 760, 1040, 0.018);
}

export function playBottleSound() {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;
  const duration = 0.42;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const progress = index / samples.length;
    samples[index] = (Math.random() * 2 - 1) * Math.sin(Math.PI * progress);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(920, now);
  filter.frequency.exponentialRampToValueAtTime(540, now + duration);
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.022, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);

  bubble(ctx, now + 0.06, 300, 195, 0.032);
  bubble(ctx, now + 0.17, 350, 220, 0.026);
  bubble(ctx, now + 0.28, 410, 245, 0.02);
}
