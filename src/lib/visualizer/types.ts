export const VIZ_MODES = ["bars", "mirror", "radial", "orbit", "wave"] as const;
export type VizMode = (typeof VIZ_MODES)[number];

export const VIZ_THEMES = ["ember", "ice", "moss", "bloom", "noir", "rose"] as const;
export type VizTheme = (typeof VIZ_THEMES)[number];

export type AudioSource = "idle" | "mic" | "file";

export type Rgb = readonly [number, number, number];

export type ThemePalette = {
  id: VizTheme;
  label: string;
  bg: Rgb;
  low: Rgb;
  mid: Rgb;
  high: Rgb;
  swatch: string;
};

export type VizFrame = {
  bands: Float32Array;
  waveform: Float32Array;
  bass: number;
  mids: number;
  treble: number;
  energy: number;
  time: number;
};
