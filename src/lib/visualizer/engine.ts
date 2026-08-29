import type { VizFrame } from "./types";

const FFT_SIZE = 2048;
const BAND_COUNT = 96;
const WAVE_COUNT = 256;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function meanRange(data: Uint8Array, start: number, end: number) {
  const a = Math.max(0, start);
  const b = Math.max(a + 1, Math.min(data.length, end));
  let sum = 0;
  for (let i = a; i < b; i++) sum += data[i] ?? 0;
  return sum / (b - a) / 255;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private fileSource: MediaElementAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private objectUrl: string | null = null;
  private freqBytes = new Uint8Array(FFT_SIZE / 2);
  private timeBytes = new Uint8Array(FFT_SIZE);
  private logMap: Uint16Array | null = null;
  private audio: HTMLAudioElement | null = null;
  readonly bands = new Float32Array(BAND_COUNT);
  readonly waveform = new Float32Array(WAVE_COUNT);
  private peaks = new Float32Array(BAND_COUNT);
  private clock = 0;
  private sourceKind: "idle" | "mic" | "file" = "idle";

  get element() {
    return this.audio;
  }

  get kind() {
    return this.sourceKind;
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.crossOrigin = "anonymous";
      this.audio.loop = true;
      this.audio.preload = "auto";
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC({ latencyHint: "interactive" });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.52;
      this.analyser.minDecibels = -88;
      this.analyser.maxDecibels = -22;
      this.freqBytes = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeBytes = new Uint8Array(this.analyser.fftSize);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  private ensureLogMap() {
    if (!this.ctx || !this.analyser || this.logMap) return;
    const binCount = this.analyser.frequencyBinCount;
    const nyquist = this.ctx.sampleRate / 2;
    const minF = 22;
    const maxF = Math.min(nyquist, 17500);
    const minL = Math.log2(minF);
    const maxL = Math.log2(maxF);
    const map = new Uint16Array(BAND_COUNT + 1);
    for (let i = 0; i <= BAND_COUNT; i++) {
      const freq = 2 ** (minL + (i / BAND_COUNT) * (maxL - minL));
      const bin = Math.round((freq / nyquist) * binCount);
      map[i] = clamp(bin, 1, binCount - 1);
    }
    this.logMap = map;
  }

  private connectAnalyserToOutput(hear: boolean) {
    if (!this.analyser || !this.ctx) return;
    try {
      this.analyser.disconnect();
    } catch {
      /* already disconnected */
    }
    if (hear) this.analyser.connect(this.ctx.destination);
  }

  private stopMic() {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        /* noop */
      }
      this.micSource = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }

  private pauseFile() {
    this.audio?.pause();
  }

  async startMic() {
    this.unlock();
    if (!this.ctx || !this.analyser) {
      throw new Error("Audio is not available in this browser.");
    }
    this.pauseFile();
    if (this.fileSource) {
      try {
        this.fileSource.disconnect();
      } catch {
        /* noop */
      }
    }
    this.stopMic();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    this.stream = stream;
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.analyser);
    this.connectAnalyserToOutput(false);
    this.sourceKind = "mic";
    this.ensureLogMap();
  }

  async loadFile(file: File) {
    this.unlock();
    if (!this.ctx || !this.analyser || !this.audio) {
      throw new Error("Audio is not available in this browser.");
    }
    this.stopMic();
    const url = URL.createObjectURL(file);
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = url;
    this.audio.src = url;
    await new Promise<void>((resolve, reject) => {
      const audio = this.audio;
      if (!audio) {
        reject(new Error("Audio element missing."));
        return;
      }
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error("Could not read that audio file."));
      };
      const cleanup = () => {
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("error", onErr);
      };
      audio.addEventListener("canplay", onReady);
      audio.addEventListener("error", onErr);
      audio.load();
    });
    if (!this.fileSource) {
      this.fileSource = this.ctx.createMediaElementSource(this.audio);
    } else {
      try {
        this.fileSource.disconnect();
      } catch {
        /* noop */
      }
    }
    this.fileSource.connect(this.analyser);
    this.connectAnalyserToOutput(true);
    this.sourceKind = "file";
    this.ensureLogMap();
  }

  async play() {
    this.unlock();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
    await this.audio?.play();
  }

  pause() {
    this.audio?.pause();
  }

  seek(time: number) {
    if (!this.audio || !Number.isFinite(this.audio.duration)) return;
    this.audio.currentTime = clamp(time, 0, this.audio.duration);
  }

  setVolume(volume: number, muted: boolean) {
    if (!this.audio) return;
    this.audio.volume = muted ? 0 : clamp(volume, 0, 1);
  }

  resumeContext() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private fillIdle(dt: number) {
    this.clock += dt;
    const t = this.clock;
    const bpm = 86;
    const beatDur = 60 / bpm;
    const pos = t / beatDur;
    const beatPhase = pos % 1;
    const beat = beatPhase < 0.28 ? (1 - beatPhase / 0.28) ** 1.7 : 0;
    const bar = Math.floor(pos) % 4;
    const halfPhase = (pos + 0.5) % 1;
    const half = halfPhase < 0.18 ? (1 - halfPhase / 0.18) ** 1.8 * 0.55 : 0;
    const snare = bar === 1 || bar === 3 ? half : 0;

    for (let i = 0; i < BAND_COUNT; i++) {
      const x = i / (BAND_COUNT - 1);
      const bass = Math.exp(-x * 11) * beat * 0.95;
      const body = Math.exp(-(((x - 0.2) / 0.11) ** 2)) * snare * 0.72;
      const hat =
        Math.exp(-(((x - 0.74) / 0.16) ** 2)) *
        (0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 17 + i * 0.4)));
      const drone = (0.14 + 0.1 * Math.sin(t * 0.55 + x * 5)) * Math.exp(-x * 1.15);
      const shimmer = 0.045 * (0.5 + 0.5 * Math.sin(t * 2.2 + x * 18));
      const target = clamp(bass + body + hat + drone + shimmer, 0, 1);
      const current = this.bands[i] ?? 0;
      const rate = target > current ? 14 : 5;
      const k = 1 - Math.exp(-dt * rate);
      this.bands[i] = current + (target - current) * k;
      this.peaks[i] = Math.max(this.bands[i] ?? 0, (this.peaks[i] ?? 0) - dt * 0.55);
    }

    for (let i = 0; i < WAVE_COUNT; i++) {
      const x = i / (WAVE_COUNT - 1);
      const w =
        Math.sin(x * Math.PI * 2 + t * 2.1) * (0.18 + beat * 0.45) +
        Math.sin(x * Math.PI * 6 + t * 1.3) * 0.08 +
        Math.sin(x * Math.PI * 13 + t * 3.4) * 0.03;
      this.waveform[i] = w;
    }
  }

  private fillAnalyser(dt: number, sensitivity: number) {
    if (this.sourceKind === "file" && this.audio?.paused) {
      return;
    }
    if (!this.analyser || !this.logMap) {
      this.fillIdle(dt);
      return;
    }
    this.analyser.getByteFrequencyData(this.freqBytes as Uint8Array<ArrayBuffer>);
    this.analyser.getByteTimeDomainData(this.timeBytes as Uint8Array<ArrayBuffer>);
    const boost = clamp(sensitivity, 0.25, 3);

    for (let i = 0; i < BAND_COUNT; i++) {
      const start = this.logMap[i] ?? 1;
      const end = this.logMap[i + 1] ?? start + 1;
      let value = meanRange(this.freqBytes, start, Math.max(end, start + 1));
      value = value ** 0.85 * boost;
      value = clamp(value, 0, 1);
      const current = this.bands[i] ?? 0;
      const rate = value > current ? 22 : 7;
      const k = 1 - Math.exp(-dt * rate);
      this.bands[i] = current + (value - current) * k;
      this.peaks[i] = Math.max(this.bands[i] ?? 0, (this.peaks[i] ?? 0) - dt * 0.7);
    }

    const step = Math.max(1, Math.floor(this.timeBytes.length / WAVE_COUNT));
    for (let i = 0; i < WAVE_COUNT; i++) {
      const sample = this.timeBytes[i * step] ?? 128;
      const target = (sample - 128) / 128;
      const current = this.waveform[i] ?? 0;
      const k = 1 - Math.exp(-dt * 28);
      this.waveform[i] = current + (target - current) * k;
    }
  }

  getFrame(dt: number, sensitivity: number): VizFrame {
    const capped = Math.min(dt, 0.08);
    if (this.sourceKind === "idle" || !this.analyser) this.fillIdle(capped);
    else this.fillAnalyser(capped, sensitivity);

    const bass = bandEnergy(this.bands, 0, 10);
    const mids = bandEnergy(this.bands, 10, 40);
    const treble = bandEnergy(this.bands, 40, BAND_COUNT);
    const energy = bass * 0.5 + mids * 0.32 + treble * 0.18;

    return {
      bands: this.bands,
      waveform: this.waveform,
      bass,
      mids,
      treble,
      energy,
      time: this.clock,
    };
  }

  getPeaks() {
    return this.peaks;
  }

  dispose() {
    this.pauseFile();
    this.stopMic();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.fileSource) {
      try {
        this.fileSource.disconnect();
      } catch {
        /* noop */
      }
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        /* noop */
      }
    }
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.fileSource = null;
    this.audio = null;
    this.sourceKind = "idle";
  }
}

function bandEnergy(bands: Float32Array, start: number, end: number) {
  let sum = 0;
  const a = Math.max(0, start);
  const b = Math.min(bands.length, end);
  if (b <= a) return 0;
  for (let i = a; i < b; i++) sum += bands[i] ?? 0;
  return sum / (b - a);
}
