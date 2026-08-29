import { THEMES } from "./themes";
import type { Rgb, ThemePalette, VizFrame, VizMode, VizTheme } from "./types";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  r: number;
  color: Rgb;
};

const particles: Particle[] = [];
const MAX_PARTICLES = 110;
let rotation = 0;
let orbitA = 0;
let orbitB = 0;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function rgb(c: Rgb, a = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function colorAt(theme: ThemePalette, t: number): [number, number, number] {
  const x = clamp(t, 0, 1);
  if (x < 0.5) return lerpRgb(theme.low, theme.mid, x * 2);
  return lerpRgb(theme.mid, theme.high, (x - 0.5) * 2);
}

function spawn(x: number, y: number, vx: number, vy: number, color: Rgb) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push({
    x,
    y,
    vx,
    vy,
    life: 0,
    ttl: 0.45 + Math.random() * 0.55,
    r: 0.8 + Math.random() * 1.8,
    color,
  });
}

function stepParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (!p) continue;
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 28 * dt;
    if (p.life >= p.ttl) particles.splice(i, 1);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of particles) {
    const t = 1 - p.life / p.ttl;
    ctx.beginPath();
    ctx.fillStyle = rgb(p.color, t * 0.7);
    ctx.arc(p.x, p.y, p.r * (0.5 + t), 0, Math.PI * 2);
    ctx.fill();
  }
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemePalette, energy: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, rgb(theme.low, 0.03 + energy * 0.08));
  g.addColorStop(0.55, rgb(theme.bg, 0));
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function roundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (h === 0 || w === 0) return;
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  frame: VizFrame,
  peaks: Float32Array,
  theme: ThemePalette,
  w: number,
  h: number,
) {
  const n = frame.bands.length;
  const marginX = w * 0.08;
  const usable = w - marginX * 2;
  const gap = Math.max(2, usable / n / 6);
  const barW = Math.max(2, usable / n - gap);
  const base = h * 0.62;
  const maxH = h * 0.42;

  for (let i = 0; i < n; i++) {
    const v = frame.bands[i] ?? 0;
    const x = marginX + i * (barW + gap);
    const bh = Math.max(2, v * maxH);
    const c = colorAt(theme, i / (n - 1));
    const grad = ctx.createLinearGradient(0, base - bh, 0, base);
    grad.addColorStop(0, rgb(theme.high, 0.95));
    grad.addColorStop(0.45, rgb(c, 0.95));
    grad.addColorStop(1, rgb(theme.low, 0.55));
    ctx.fillStyle = grad;
    roundedBar(ctx, x, base - bh, barW, bh, Math.min(4, barW / 2));

    ctx.fillStyle = rgb(c, 0.18);
    roundedBar(ctx, x, base + 4, barW, bh * 0.38, Math.min(4, barW / 2));

    const peak = peaks[i] ?? v;
    if (peak > 0.04) {
      ctx.fillStyle = rgb(theme.high, 0.85);
      ctx.fillRect(x, base - peak * maxH - 3, barW, 2);
    }

    if (v > 0.82 && Math.random() > 0.72) {
      spawn(x + barW / 2, base - bh, (Math.random() - 0.5) * 28, -40 - Math.random() * 50, c);
    }
  }

  ctx.fillStyle = rgb(theme.high, 0.12 + frame.bass * 0.18);
  ctx.fillRect(marginX, base + 1, usable, 1);
}

function drawMirror(
  ctx: CanvasRenderingContext2D,
  frame: VizFrame,
  theme: ThemePalette,
  w: number,
  h: number,
) {
  const n = frame.bands.length;
  const cy = h * 0.5;
  const maxH = h * 0.32;
  const gap = 2;
  const barW = Math.max(2, (w * 0.78) / n - gap);
  const startX = (w - n * (barW + gap)) / 2;

  ctx.fillStyle = rgb(theme.high, 0.1 + frame.energy * 0.2);
  ctx.fillRect(startX, cy - 0.5, n * (barW + gap), 1);

  for (let i = 0; i < n; i++) {
    const v = frame.bands[i] ?? 0;
    const x = startX + i * (barW + gap);
    const bh = Math.max(2, v * maxH);
    const c = colorAt(theme, i / (n - 1));
    const up = ctx.createLinearGradient(0, cy - bh, 0, cy);
    up.addColorStop(0, rgb(theme.high, 0.95));
    up.addColorStop(1, rgb(c, 0.4));
    ctx.fillStyle = up;
    roundedBar(ctx, x, cy - bh, barW, bh, Math.min(3, barW / 2));
    const down = ctx.createLinearGradient(0, cy, 0, cy + bh);
    down.addColorStop(0, rgb(c, 0.4));
    down.addColorStop(1, rgb(theme.low, 0.08));
    ctx.fillStyle = down;
    roundedBar(ctx, x, cy, barW, bh, Math.min(3, barW / 2));

    if (v > 0.84 && Math.random() > 0.75) {
      spawn(x + barW / 2, cy - bh, (Math.random() - 0.5) * 20, -30 - Math.random() * 40, c);
    }
  }
}

function drawRadial(
  ctx: CanvasRenderingContext2D,
  frame: VizFrame,
  theme: ThemePalette,
  w: number,
  h: number,
  dt: number,
) {
  const cx = w / 2;
  const cy = h / 2;
  const n = frame.bands.length;
  const minDim = Math.min(w, h);
  const inner = minDim * (0.14 + frame.bass * 0.04);
  const maxLen = minDim * 0.28;
  rotation += dt * (0.18 + frame.energy * 0.45);

  const orb = ctx.createRadialGradient(cx, cy, inner * 0.1, cx, cy, inner * 1.8);
  orb.addColorStop(0, rgb(theme.high, 0.55 + frame.bass * 0.35));
  orb.addColorStop(0.45, rgb(theme.mid, 0.18 + frame.energy * 0.2));
  orb.addColorStop(1, rgb(theme.low, 0));
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(cx, cy, inner * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = rgb(theme.high, 0.28 + frame.bass * 0.35);
  ctx.lineWidth = 1.5;
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const v = frame.bands[i] ?? 0;
    const a = rotation + (i / n) * Math.PI * 2;
    const len = inner * 0.08 + v * maxLen;
    const x0 = cx + Math.cos(a) * inner;
    const y0 = cy + Math.sin(a) * inner;
    const x1 = cx + Math.cos(a) * (inner + len);
    const y1 = cy + Math.sin(a) * (inner + len);
    const c = colorAt(theme, i / (n - 1));
    ctx.strokeStyle = rgb(c, 0.4 + v * 0.55);
    ctx.lineWidth = Math.max(1.6, (minDim / n) * 1.1);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    const xi = cx + Math.cos(a) * (inner - v * inner * 0.45);
    const yi = cy + Math.sin(a) * (inner - v * inner * 0.45);
    ctx.strokeStyle = rgb(c, 0.18 + v * 0.2);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(xi, yi);
    ctx.stroke();

    if (v > 0.86 && Math.random() > 0.8) {
      spawn(x1, y1, Math.cos(a) * 40, Math.sin(a) * 40, c);
    }
  }
}

function drawOrbit(
  ctx: CanvasRenderingContext2D,
  frame: VizFrame,
  theme: ThemePalette,
  w: number,
  h: number,
  dt: number,
) {
  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);
  orbitA += dt * (0.22 + frame.bass * 0.5);
  orbitB -= dt * (0.16 + frame.treble * 0.4);

  const coreR = minDim * (0.07 + frame.bass * 0.035);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.4);
  core.addColorStop(0, rgb(theme.high, 0.85));
  core.addColorStop(0.35, rgb(theme.mid, 0.35 + frame.energy * 0.25));
  core.addColorStop(1, rgb(theme.low, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR * 2.4, 0, Math.PI * 2);
  ctx.fill();

  const rings = [
    { r: minDim * 0.18, count: 36, rot: orbitA, slice: [0, 24] as const },
    { r: minDim * 0.28, count: 48, rot: orbitB, slice: [18, 56] as const },
    { r: minDim * 0.38, count: 64, rot: orbitA * 0.55, slice: [40, 96] as const },
  ];

  for (const ring of rings) {
    ctx.beginPath();
    ctx.strokeStyle = rgb(theme.mid, 0.08 + frame.energy * 0.08);
    ctx.lineWidth = 1;
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < ring.count; i++) {
      const bandIndex = ring.slice[0] + Math.floor((i / ring.count) * (ring.slice[1] - ring.slice[0]));
      const v = frame.bands[bandIndex] ?? 0;
      const a = ring.rot + (i / ring.count) * Math.PI * 2;
      const rr = ring.r + (v - 0.35) * minDim * 0.05;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      const c = colorAt(theme, i / ring.count);
      const size = 1.1 + v * 5.2;
      ctx.beginPath();
      ctx.fillStyle = rgb(c, 0.25 + v * 0.7);
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (frame.energy > 0.55) {
    ctx.strokeStyle = rgb(theme.high, (frame.energy - 0.55) * 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const spikes = 12;
    for (let i = 0; i <= spikes; i++) {
      const a = orbitA * 1.4 + (i / spikes) * Math.PI * 2;
      const v = frame.bands[Math.floor((i / spikes) * 40)] ?? 0;
      const r = minDim * (0.12 + v * 0.16);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  frame: VizFrame,
  theme: ThemePalette,
  w: number,
  h: number,
) {
  const cy = h * 0.48;
  const amp = h * 0.22 * (0.55 + frame.energy * 0.7);
  const wave = frame.waveform;
  const n = wave.length;

  const path = (scale: number) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = cy + (wave[i] ?? 0) * amp * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };

  path(1);
  ctx.lineTo(w, cy);
  ctx.lineTo(0, cy);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, cy - amp, 0, cy + amp);
  fill.addColorStop(0, rgb(theme.mid, 0.12 + frame.energy * 0.1));
  fill.addColorStop(0.5, rgb(theme.low, 0.05));
  fill.addColorStop(1, rgb(theme.mid, 0.08));
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  path(1);
  ctx.strokeStyle = rgb(theme.low, 0.18);
  ctx.lineWidth = 10;
  ctx.stroke();
  path(1);
  ctx.strokeStyle = rgb(theme.mid, 0.45);
  ctx.lineWidth = 4;
  ctx.stroke();
  path(1);
  ctx.strokeStyle = rgb(theme.high, 0.95);
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const spectrumY = h * 0.82;
  const nBands = frame.bands.length;
  const barW = w / nBands;
  for (let i = 0; i < nBands; i++) {
    const v = frame.bands[i] ?? 0;
    const c = colorAt(theme, i / (nBands - 1));
    ctx.fillStyle = rgb(c, 0.25 + v * 0.5);
    ctx.fillRect(i * barW, spectrumY - v * h * 0.1, Math.max(1, barW - 1), v * h * 0.1);
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  frame: VizFrame,
  peaks: Float32Array,
  mode: VizMode,
  themeId: VizTheme,
  width: number,
  height: number,
  dt: number,
) {
  const theme = THEMES[themeId];
  const trail = mode === "bars" || mode === "mirror" ? 1 : 0.28;
  if (trail >= 1) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = rgb(theme.bg, 1);
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = rgb(theme.bg, trail);
    ctx.fillRect(0, 0, width, height);
  }

  stepParticles(dt);

  switch (mode) {
    case "bars":
      drawBars(ctx, frame, peaks, theme, width, height);
      break;
    case "mirror":
      drawMirror(ctx, frame, theme, width, height);
      break;
    case "radial":
      drawRadial(ctx, frame, theme, width, height, dt);
      break;
    case "orbit":
      drawOrbit(ctx, frame, theme, width, height, dt);
      break;
    case "wave":
      drawWave(ctx, frame, theme, width, height);
      break;
  }

  drawParticles(ctx);
  vignette(ctx, width, height, theme, frame.energy);
}

export function resetMotion() {
  particles.length = 0;
  rotation = 0;
  orbitA = 0;
  orbitB = 0;
}
