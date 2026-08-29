import { create } from "zustand";
import type { AudioSource, VizMode, VizTheme } from "./types";

export type VizState = {
  mode: VizMode;
  theme: VizTheme;
  sensitivity: number;
  source: AudioSource;
  playing: boolean;
  fileName: string | null;
  duration: number;
  currentTime: number;
  volume: number;
  muted: boolean;
  error: string | null;
  dragging: boolean;
  hudVisible: boolean;
  fullscreen: boolean;
  setMode: (mode: VizMode) => void;
  setTheme: (theme: VizTheme) => void;
  setSensitivity: (value: number) => void;
  setSource: (source: AudioSource) => void;
  setPlaying: (playing: boolean) => void;
  setFileMeta: (fileName: string | null, duration: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setError: (error: string | null) => void;
  setDragging: (dragging: boolean) => void;
  setHudVisible: (hudVisible: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  resetPlayback: () => void;
};

const PREFS_KEY = "aether-prefs";

export function loadPrefs(): Partial<Pick<VizState, "mode" | "theme" | "sensitivity" | "volume">> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      mode: parsed.mode as VizState["mode"] | undefined,
      theme: parsed.theme as VizState["theme"] | undefined,
      sensitivity: typeof parsed.sensitivity === "number" ? parsed.sensitivity : undefined,
      volume: typeof parsed.volume === "number" ? parsed.volume : undefined,
    };
  } catch {
    return {};
  }
}

export function savePrefs(state: Pick<VizState, "mode" | "theme" | "sensitivity" | "volume">) {
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        mode: state.mode,
        theme: state.theme,
        sensitivity: state.sensitivity,
        volume: state.volume,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export const useVizStore = create<VizState>((set) => ({
  mode: "radial",
  theme: "ice",
  sensitivity: 1,
  source: "idle",
  playing: false,
  fileName: null,
  duration: 0,
  currentTime: 0,
  volume: 0.85,
  muted: false,
  error: null,
  dragging: false,
  hudVisible: true,
  fullscreen: false,
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => set({ theme }),
  setSensitivity: (sensitivity) => set({ sensitivity }),
  setSource: (source) => set({ source, error: null }),
  setPlaying: (playing) => set({ playing }),
  setFileMeta: (fileName, duration) => set({ fileName, duration }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setVolume: (volume) => set({ volume, muted: volume === 0 ? true : false }),
  setMuted: (muted) => set({ muted }),
  setError: (error) => set({ error }),
  setDragging: (dragging) => set({ dragging }),
  setHudVisible: (hudVisible) => set({ hudVisible }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  resetPlayback: () =>
    set({
      source: "idle",
      playing: false,
      fileName: null,
      duration: 0,
      currentTime: 0,
    }),
}));
