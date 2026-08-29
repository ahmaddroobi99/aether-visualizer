import { useEffect, useRef } from "react";
import {
  Activity,
  AudioLines,
  BarChart3,
  Circle,
  Gauge,
  Maximize2,
  Mic,
  Minimize2,
  Orbit,
  Pause,
  Play,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/cn";
import { THEME_LIST } from "@/lib/visualizer/themes";
import { VIZ_MODES, type VizMode } from "@/lib/visualizer/types";
import { useVizStore } from "@/lib/visualizer/store";
import type { AudioEngine } from "@/lib/visualizer/engine";

const MODE_META: Record<VizMode, { label: string; icon: typeof BarChart3 }> = {
  bars: { label: "Bars", icon: BarChart3 },
  mirror: { label: "Mirror", icon: Activity },
  radial: { label: "Radial", icon: Circle },
  orbit: { label: "Orbit", icon: Orbit },
  wave: { label: "Wave", icon: AudioLines },
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function displayName(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

type HudProps = {
  engine: AudioEngine | null;
  stageRef: React.RefObject<HTMLDivElement | null>;
};

export function Hud({ engine, stageRef }: HudProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const mode = useVizStore((s) => s.mode);
  const theme = useVizStore((s) => s.theme);
  const sensitivity = useVizStore((s) => s.sensitivity);
  const source = useVizStore((s) => s.source);
  const playing = useVizStore((s) => s.playing);
  const fileName = useVizStore((s) => s.fileName);
  const duration = useVizStore((s) => s.duration);
  const currentTime = useVizStore((s) => s.currentTime);
  const volume = useVizStore((s) => s.volume);
  const muted = useVizStore((s) => s.muted);
  const error = useVizStore((s) => s.error);
  const dragging = useVizStore((s) => s.dragging);
  const hudVisible = useVizStore((s) => s.hudVisible);
  const fullscreen = useVizStore((s) => s.fullscreen);
  const idle = source === "idle";
  const showChrome = idle || hudVisible;

  async function onMic() {
    if (!engine) return;
    engine.unlock();
    try {
      await engine.startMic();
      const s = useVizStore.getState();
      s.setSource("mic");
      s.setPlaying(true);
      s.setFileMeta(null, 0);
    } catch {
      useVizStore
        .getState()
        .setError("Microphone access was blocked. Upload a track instead.");
    }
  }

  async function onFiles(files: FileList | File[] | null) {
    if (!engine || !files || files.length === 0) return;
    const file = Array.from(files).find((f) => f.type.startsWith("audio/")) ?? files[0];
    if (!file) return;
    engine.unlock();
    try {
      await engine.loadFile(file);
      engine.setVolume(volume, muted);
      await engine.play();
      const s = useVizStore.getState();
      s.setSource("file");
      s.setPlaying(true);
      s.setFileMeta(file.name, engine.element?.duration || 0);
      s.setError(null);
    } catch {
      useVizStore.getState().setError("Could not read that audio file.");
    }
  }

  async function togglePlay() {
    if (!engine || source !== "file") return;
    engine.unlock();
    if (playing) {
      engine.pause();
      useVizStore.getState().setPlaying(false);
    } else {
      await engine.play();
      useVizStore.getState().setPlaying(true);
    }
  }

  function toggleFullscreen() {
    const node = stageRef.current;
    if (!node) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void node.requestFullscreen();
  }

  function onSeek(value: number) {
    if (!engine || source !== "file") return;
    engine.seek(value);
    useVizStore.getState().setCurrentTime(value);
  }

  function onVolume(value: number) {
    useVizStore.getState().setVolume(value);
    useVizStore.getState().setMuted(value === 0);
    engine?.setVolume(value, value === 0);
  }

  function toggleMute() {
    const next = !muted;
    useVizStore.getState().setMuted(next);
    engine?.setVolume(volume, next);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const s = useVizStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        if (!engine || s.source !== "file") return;
        engine.unlock();
        if (s.playing) {
          engine.pause();
          s.setPlaying(false);
        } else {
          void engine.play().then(() => s.setPlaying(true));
        }
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        const next = !s.muted;
        s.setMuted(next);
        engine?.setVolume(s.volume, next);
      } else if (e.key >= "1" && e.key <= "5") {
        const next = VIZ_MODES[Number(e.key) - 1];
        if (next) s.setMode(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          void onFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      <header
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-4 sm:px-6 sm:pt-5",
          "transition-[opacity,transform] duration-fast ease-smooth",
          showChrome ? "opacity-100" : "opacity-0 -translate-y-1",
        )}
      >
        <div className="pointer-events-auto">
          <p className="text-xs font-medium tracking-mark text-fg uppercase">Aether</p>
          <p className="mt-0.5 text-xs text-subtle">Visualizer</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="pointer-events-auto"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={toggleFullscreen}
        >
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </header>

      {idle ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-5">
          <div className="flex max-w-md flex-col items-center text-center">
            <h1 className="stagger-in font-sans text-4xl font-medium tracking-display text-balance text-fg sm:text-5xl">
              Aether
            </h1>
            <p className="stagger-in mt-3 max-w-sm text-sm leading-relaxed text-pretty text-muted">
              Sound, made visible. Feed a microphone or a track — bars, rings, and waves follow the music.
            </p>
            <div className="stagger-in pointer-events-auto mt-7 flex w-full max-w-xs flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
              <Button variant="primary" className="w-full sm:w-auto" onClick={() => void onMic()}>
                <Mic className="size-4" />
                Microphone
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload track
              </Button>
            </div>
            <p className="stagger-in mt-5 text-xs text-subtle">Drop an audio file anywhere</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          role="status"
          className="absolute top-16 left-1/2 z-20 max-w-md -translate-x-1/2 rounded-xl bg-surface px-3 py-2 text-center text-sm text-danger shadow-[var(--shadow-dock)]"
        >
          {error}
        </p>
      ) : null}

      {dragging ? (
        <div className="absolute inset-3 z-30 grid place-items-center rounded-2xl border border-dashed border-fg/25 bg-bg/70">
          <p className="text-sm font-medium text-fg">Drop to visualize</p>
        </div>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 px-3 dock-pad sm:px-5",
          "transition-[opacity,transform] duration-fast ease-smooth",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0 translate-y-2",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl bg-surface/85 p-3 shadow-[var(--shadow-dock)] backdrop-blur-md sm:p-3.5">
          {source === "file" ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="primary"
                size="icon-sm"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => void togglePlay()}
              >
                {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{fileName ? displayName(fileName) : "Untitled"}</p>
                <div className="flex items-center gap-3">
                  <Slider
                    className="h-8"
                    min={0}
                    max={Math.max(duration, 0.01)}
                    step={0.05}
                    value={currentTime}
                    onValueChange={onSeek}
                    aria-label="Seek"
                  />
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="relative hidden size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg sm:flex"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={toggleMute}
              >
                {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <Slider
                className="hidden h-8 w-24 sm:flex"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onValueChange={onVolume}
                aria-label="Volume"
              />
            </div>
          ) : source === "mic" ? (
            <div className="flex items-center justify-between gap-2">
              <p className="truncate px-1 text-sm text-muted">Listening to microphone</p>
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              role="tablist"
              aria-label="Visualization mode"
              className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-bg p-1"
            >
              {VIZ_MODES.map((id) => {
                const meta = MODE_META[id];
                const Icon = meta.icon;
                const active = mode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => useVizStore.getState().setMode(id)}
                    className={cn(
                      "flex h-9 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium",
                      "transition-[background-color,color,opacity] duration-quick ease-out",
                      active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="hidden md:inline">{meta.label}</span>
                    <span className="sr-only md:hidden">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 sm:shrink-0">
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color theme">
                {THEME_LIST.map((item) => {
                  const active = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={item.label}
                      title={item.label}
                      onClick={() => useVizStore.getState().setTheme(item.id)}
                      className={cn(
                        "size-6 rounded-full shadow-[var(--shadow-border)]",
                        "transition-[scale,box-shadow] duration-quick ease-out",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        item.swatch,
                        active ? "scale-110 shadow-[var(--shadow-border-hover)]" : "hover:scale-105",
                      )}
                    />
                  );
                })}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:w-40 sm:flex-none">
                <Gauge className="size-3.5 shrink-0 text-subtle" aria-hidden />
                <Slider
                  className="h-9"
                  min={0.3}
                  max={2.4}
                  step={0.05}
                  value={sensitivity}
                  onValueChange={(v) => useVizStore.getState().setSensitivity(v)}
                  aria-label="Sensitivity"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
