import { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/visualizer/engine";
import { renderFrame } from "@/lib/visualizer/draw";
import { loadPrefs, savePrefs, useVizStore } from "@/lib/visualizer/store";
import { Hud } from "./hud";

export function VisualizerStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.mode || prefs.theme || prefs.sensitivity || prefs.volume !== undefined) {
      useVizStore.setState({
        ...(prefs.mode ? { mode: prefs.mode } : {}),
        ...(prefs.theme ? { theme: prefs.theme } : {}),
        ...(typeof prefs.sensitivity === "number" ? { sensitivity: prefs.sensitivity } : {}),
        ...(typeof prefs.volume === "number" ? { volume: prefs.volume } : {}),
      });
    }
    return useVizStore.subscribe((s) => {
      savePrefs({
        mode: s.mode,
        theme: s.theme,
        sensitivity: s.sensitivity,
        volume: s.volume,
      });
    });
  }, []);

  useEffect(() => {
    const audio = new AudioEngine();
    setEngine(audio);
    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {
        audio.dispose();
        setEngine(null);
      };
    }

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return { width: rect.width, height: rect.height, dpr };
    };

    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const { width, height, dpr } = resize();
      const state = useVizStore.getState();
      const frame = audio.getFrame(dt, state.sensitivity);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderFrame(ctx, frame, audio.getPeaks(), state.mode, state.theme, width, height, dt);

      if (state.source === "file" && audio.element) {
        const el = audio.element;
        if (Math.abs(el.currentTime - state.currentTime) > 0.05) {
          useVizStore.getState().setCurrentTime(el.currentTime);
        }
        if (el.duration && el.duration !== state.duration) {
          useVizStore.getState().setFileMeta(state.fileName, el.duration);
        }
        if (el.paused === state.playing) {
          useVizStore.getState().setPlaying(!el.paused);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.visibilityState === "visible") audio.resumeContext();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      audio.dispose();
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const bumpHud = () => {
      useVizStore.getState().setHudVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (useVizStore.getState().source === "idle") return;
      hideTimer.current = setTimeout(() => {
        useVizStore.getState().setHudVisible(false);
      }, 2600);
    };

    const onFs = () => {
      useVizStore.getState().setFullscreen(Boolean(document.fullscreenElement));
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      useVizStore.getState().setDragging(true);
      bumpHud();
    };
    const onDragLeave = () => useVizStore.getState().setDragging(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      useVizStore.getState().setDragging(false);
      const files = e.dataTransfer?.files;
      if (!engine || !files?.length) return;
      const file = files[0];
      if (!file) return;
      engine.unlock();
      void engine.loadFile(file).then(async () => {
        const s = useVizStore.getState();
        engine.setVolume(s.volume, s.muted);
        await engine.play();
        s.setSource("file");
        s.setPlaying(true);
        s.setFileMeta(file.name, engine.element?.duration || 0);
      });
    };

    bumpHud();
    node.addEventListener("pointermove", bumpHud);
    node.addEventListener("pointerdown", bumpHud);
    node.addEventListener("touchstart", bumpHud, { passive: true });
    document.addEventListener("fullscreenchange", onFs);
    node.addEventListener("dragover", onDragOver);
    node.addEventListener("dragleave", onDragLeave);
    node.addEventListener("drop", onDrop);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      node.removeEventListener("pointermove", bumpHud);
      node.removeEventListener("pointerdown", bumpHud);
      node.removeEventListener("touchstart", bumpHud);
      document.removeEventListener("fullscreenchange", onFs);
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("dragleave", onDragLeave);
      node.removeEventListener("drop", onDrop);
    };
  }, [engine]);

  return (
    <div ref={stageRef} className="relative min-h-dvh overflow-hidden bg-bg text-fg select-none">
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-hidden />
      <Hud engine={engine} stageRef={stageRef} />
    </div>
  );
}
