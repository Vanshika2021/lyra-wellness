// Lightweight in-browser vocal feature extraction.
// Decodes the recorded blob, then computes pitch (autocorrelation per frame),
// energy (RMS), and pause ratio. From those we derive a mood signature.

export type VocalFeatures = {
  durationSec: number;
  rmsMean: number;        // 0..1-ish loudness
  rmsVar: number;         // dynamics / expressiveness
  pitchMeanHz: number;    // average voiced pitch
  pitchVarHz: number;     // pitch variability (monotone vs expressive)
  voicedRatio: number;    // fraction of frames with detectable pitch (0..1)
  pauseRatio: number;     // fraction of silent frames (0..1)
  speechRateWps: number;  // words per second (filled in once transcript known)
};

export type MoodSignature = {
  distress: number; // 0..1  (tender/stormy)
  arousal: number;  // 0..1  (stilled/charged)
  descriptor: string; // human/AI-readable summary of the voice
};

const FRAME_SEC = 0.03;          // 30ms frames
const SILENCE_RMS = 0.012;       // below this = silence
const MIN_PITCH = 70;            // Hz
const MAX_PITCH = 400;           // Hz

export async function extractVocalFeatures(blob: Blob): Promise<VocalFeatures> {
  const arrayBuf = await blob.arrayBuffer();
  // Safari prefix
  const Ctx: typeof AudioContext =
    (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new Ctx();
  let audio: AudioBuffer;
  try {
    audio = await ctx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }

  const sr = audio.sampleRate;
  // Mono mix
  const ch0 = audio.getChannelData(0);
  const data = audio.numberOfChannels > 1
    ? mix(ch0, audio.getChannelData(1))
    : ch0;

  const frameLen = Math.floor(FRAME_SEC * sr);
  const frames = Math.floor(data.length / frameLen);

  const rmsArr: number[] = [];
  const pitchArr: number[] = [];
  let silent = 0;

  for (let i = 0; i < frames; i++) {
    const start = i * frameLen;
    const frame = data.subarray(start, start + frameLen);
    const rms = calcRms(frame);
    rmsArr.push(rms);

    if (rms < SILENCE_RMS) {
      silent++;
      continue;
    }
    const p = autocorrPitch(frame, sr);
    if (p > 0) pitchArr.push(p);
  }

  const rmsMean = mean(rmsArr);
  const rmsVar = variance(rmsArr, rmsMean);
  const pitchMeanHz = pitchArr.length ? mean(pitchArr) : 0;
  const pitchVarHz = pitchArr.length ? Math.sqrt(variance(pitchArr, pitchMeanHz)) : 0;

  return {
    durationSec: audio.duration,
    rmsMean,
    rmsVar,
    pitchMeanHz,
    pitchVarHz,
    voicedRatio: frames ? pitchArr.length / frames : 0,
    pauseRatio: frames ? silent / frames : 0,
    speechRateWps: 0, // set by caller
  };
}

export function buildMoodSignature(f: VocalFeatures, transcript: string): MoodSignature {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wps = f.durationSec > 0 ? words / f.durationSec : 0;
  f.speechRateWps = wps;

  // Normalize features to 0..1 with gentle bounds (these are heuristic, not clinical)
  const energy = clamp01(f.rmsMean / 0.18);                   // typical speech RMS ~0.05–0.2
  const dynamics = clamp01(Math.sqrt(f.rmsVar) / 0.08);       // expressiveness
  const pitchHi = clamp01((f.pitchMeanHz - 110) / 140);       // 110 low → 250 high
  const pitchExpressive = clamp01(f.pitchVarHz / 45);         // monotone → varied
  const fast = clamp01((wps - 1.6) / 2.2);                    // 1.6 wps calm → 3.8 wps fast
  const pausy = clamp01(f.pauseRatio / 0.45);                 // lots of silence
  const lowVoiced = clamp01(1 - f.voicedRatio / 0.6);         // breathy / hesitant

  // Arousal: how activated the voice is
  const arousal = clamp01(0.35 * energy + 0.25 * fast + 0.2 * pitchHi + 0.2 * pitchExpressive);
  // Distress: tension/heaviness — high pitch + dynamics OR very low energy + lots of pauses
  const tense = 0.45 * pitchHi + 0.35 * dynamics + 0.2 * fast;
  const heavy = 0.5 * pausy + 0.3 * lowVoiced + 0.2 * (1 - energy);
  const distress = clamp01(0.6 * tense + 0.4 * heavy);

  const descriptor = describe({ energy, dynamics, pitchHi, pitchExpressive, fast, pausy, lowVoiced, wps, f });

  return { distress, arousal, descriptor };
}

function describe(x: {
  energy: number; dynamics: number; pitchHi: number; pitchExpressive: number;
  fast: number; pausy: number; lowVoiced: number; wps: number; f: VocalFeatures;
}): string {
  const tags: string[] = [];
  tags.push(x.energy < 0.3 ? "soft, quiet voice" : x.energy > 0.7 ? "loud, forceful voice" : "moderate volume");
  tags.push(x.fast > 0.65 ? "fast pace" : x.fast < 0.2 ? "slow, deliberate pace" : "steady pace");
  tags.push(x.pitchHi > 0.65 ? "higher pitch" : x.pitchHi < 0.25 ? "lower pitch" : "mid pitch");
  tags.push(x.pitchExpressive > 0.6 ? "expressive intonation" : x.pitchExpressive < 0.25 ? "flat, monotone delivery" : "moderate intonation");
  if (x.pausy > 0.55) tags.push("long pauses / hesitation");
  if (x.dynamics > 0.6) tags.push("uneven dynamics (some bursts)");
  if (x.lowVoiced > 0.6) tags.push("breathy or trembling");
  return `Voice signature: ${tags.join("; ")}. Speech rate ≈ ${x.wps.toFixed(2)} words/sec; pitch ≈ ${Math.round(x.f.pitchMeanHz)}Hz.`;
}

// ---------- math helpers ----------
function mix(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = 0.5 * (a[i] + (b[i] ?? 0));
  return out;
}
function calcRms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}
function mean(a: number[]): number { return a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0; }
function variance(a: number[], m: number): number {
  if (!a.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - m; s += d * d; }
  return s / a.length;
}
function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Autocorrelation-based pitch estimator (good enough for mood, not music)
function autocorrPitch(buf: Float32Array, sr: number): number {
  const minLag = Math.floor(sr / MAX_PITCH);
  const maxLag = Math.floor(sr / MIN_PITCH);
  let bestLag = -1;
  let bestCorr = 0;
  // normalize energy
  let norm = 0;
  for (let i = 0; i < buf.length; i++) norm += buf[i] * buf[i];
  if (norm < 1e-6) return 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    const n = buf.length - lag;
    for (let i = 0; i < n; i++) c += buf[i] * buf[i + lag];
    c /= norm;
    if (c > bestCorr) { bestCorr = c; bestLag = lag; }
  }
  if (bestLag < 0 || bestCorr < 0.3) return 0;
  return sr / bestLag;
}
