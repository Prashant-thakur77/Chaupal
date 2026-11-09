import type { DiyaLayout } from "./diya-geometry";
import { createDiyaLoop, type DiyaRenderer } from "./diya-loop";
import type { FlameFrame } from "./diya-motion";

interface RendererOptions {
  canvas: HTMLCanvasElement;
  vitality: number;
  behavior: number;
  onLight?: (light: number) => void;
  layout: () => DiyaLayout;
}

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 3; i += 1) {
    v += a * noise(x, y);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return v / 0.875;
}

/** Same teardrop as the shader: round belly, long pointed tip. */
function profile(y: number, height: number, halfWidth: number) {
  const belly = 0.24 * height;
  const bottom = -0.07 * height;
  if (y <= bottom) return 0;
  if (y < belly) {
    const b = (belly - y) / (belly - bottom);
    return halfWidth * Math.sqrt(Math.max(0, 1 - b * b));
  }
  const s = Math.min(1, Math.max(0, (y - belly) / (height - belly)));
  return halfWidth * Math.pow(1 - s, 1.3) * (1 + 0.3 * s * (1 - s));
}

const SAMPLES = 34;

/**
 * Canvas2D flame for browsers without WebGPU (many phones, headless runs).
 * It draws the same body language from the same FlameFrame with layered,
 * noise-shaped teardrops and gradient light instead of a per-pixel shader.
 */
export function createCanvasFlameRenderer(options: RendererOptions): DiyaRenderer {
  const ctx = options.canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    return {
      ready: Promise.reject(new Error("Canvas2D is not available.")),
      setVitality() {},
      setBehavior() {},
      react() {},
      dispose() {},
    };
  }
  const g = ctx;
  let width = 1;
  let height = 1;
  const left: [number, number][] = Array.from({ length: SAMPLES + 1 }, () => [0, 0]);
  const right: [number, number][] = Array.from({ length: SAMPLES + 1 }, () => [0, 0]);

  const draw = (f: FlameFrame) => {
    const w = width;
    const h = height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);

    const layout = options.layout();
    const unit = layout.unit * h;
    const ox = layout.wick.x * w;
    const oy = layout.wick.y * h;
    const X = (x: number) => ox + x * unit;
    const Y = (y: number) => oy - y * unit;
    const t = f.time;
    const ft = t * f.flickerSpeed;
    const H = Math.max(0.2, f.height);
    const W = 0.21 * f.width;
    const wander = (noise(ft * 0.85, 3.1) - 0.5) * 0.22 * f.turbulence;
    const bendAt = (q: number) => (f.lean + wander) * H * q * q;
    const maxGlow = Math.min(w, h) * 0.5;

    // Halo: the light falling on the clay and the dark around it.
    const flicker = 1 + (noise(ft * 6, 0.5) - 0.5) * 0.2 * f.turbulence;
    const glow = Math.max(0, f.glow * flicker);
    const gx = X(bendAt(0.4) * 0.4);
    const gy = Y(H * 0.36);
    const radius = Math.min(maxGlow * 0.9, unit * 1.45 * f.glowRadius);
    g.save();
    g.translate(gx, gy);
    g.scale(1, 1 / 0.9);
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, radius);
    halo.addColorStop(0, `rgba(242,169,59,${0.5 * glow})`);
    halo.addColorStop(0.18, `rgba(242,158,52,${0.34 * glow})`);
    halo.addColorStop(0.42, `rgba(226,112,32,${0.15 * glow})`);
    halo.addColorStop(0.72, `rgba(199,61,13,${0.05 * glow})`);
    halo.addColorStop(1, "rgba(199,61,13,0)");
    g.fillStyle = halo;
    g.fillRect(-radius, -radius, radius * 2, radius * 2);

    // Receiving: rings of light spreading outward.
    if (f.ripple > 0.01) {
      for (let k = 0; k < 3; k += 1) {
        const phase = (t * 0.34 + k / 3) % 1;
        const r = radius * (0.3 + phase * 0.62);
        const band = radius * 0.07;
        const alpha = f.ripple * 0.18 * Math.sin(phase * Math.PI) * (1 - phase * 0.4);
        const ring = g.createRadialGradient(0, 0, Math.max(0, r - band), 0, 0, r + band);
        ring.addColorStop(0, "rgba(242,169,59,0)");
        ring.addColorStop(0.5, `rgba(246,182,82,${alpha})`);
        ring.addColorStop(1, "rgba(242,169,59,0)");
        g.fillStyle = ring;
        g.beginPath();
        g.arc(0, 0, r + band, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();

    // Less light falls on the outside of the bowl below the lip.
    g.save();
    g.globalCompositeOperation = "destination-out";
    const shade = g.createLinearGradient(0, Y(0.1), 0, Y(-0.6));
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.5)");
    g.fillStyle = shade;
    g.fillRect(0, Y(0.1), w, h - Y(0.1));
    g.restore();

    // Flame contour, sampled bottom to tip with rising turbulence.
    const bottom = -0.07 * H;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const s = i / SAMPLES;
      const y = bottom + (H * 1.02 - bottom) * Math.pow(s, 0.85);
      const q = Math.min(1.25, Math.max(0, y / H));
      const rising = fbm(0.6, y * 2.3 - ft * 2.9) - 0.5;
      const ripple = Math.sin(y * 15 - t * 6.4) * 0.028 * f.ripple * Math.min(1, Math.max(0, (q - 0.05) / 0.3));
      const centre = bendAt(q) + rising * 0.15 * f.turbulence * Math.pow(q, 1.4) * H + ripple;
      const tl = (fbm(-3.1, y * 3.2 - ft * 4.1) - 0.5) * 0.24 * f.turbulence * q * H;
      const tr = (fbm(4.7, y * 3.2 - ft * 4.1 + 2.3) - 0.5) * 0.24 * f.turbulence * q * H;
      const rl = profile(y - tl, H, W);
      const rr = profile(y - tr, H, W);
      left[i][0] = centre - rl;
      left[i][1] = y;
      right[i][0] = centre + rr;
      right[i][1] = y;
    }

    const tracePath = (scaleR: number, scaleH: number, lift = 0) => {
      g.beginPath();
      for (let i = 0; i <= SAMPLES; i += 1) {
        const [lx, ly] = left[i];
        const c = (lx + right[i][0]) / 2;
        const px = c + (lx - c) * scaleR;
        const py = (ly - bottom) * scaleH + bottom + lift;
        if (i === 0) g.moveTo(X(px), Y(py));
        else g.lineTo(X(px), Y(py));
      }
      for (let i = SAMPLES; i >= 0; i -= 1) {
        const [rx, ry] = right[i];
        const c = (left[i][0] + rx) / 2;
        g.lineTo(X(c + (rx - c) * scaleR), Y((ry - bottom) * scaleH + bottom + lift));
      }
      g.closePath();
    };

    const core = Math.max(0.4, f.core);
    const base = Y(bottom);

    // Layers are feathered by drawing each at a few nested scales with low
    // alpha, and added together ("lighter") so the centre heats toward white
    // the way the shader's temperature ramp does.
    const layer = (
      scales: [number, number, number][],
      top: number,
      stops: [number, string][],
    ) => {
      const grad = g.createLinearGradient(0, base, 0, Y(top));
      for (const [offset, color] of stops) grad.addColorStop(offset, color);
      g.fillStyle = grad;
      for (const [sr, sh, alpha] of scales) {
        g.globalAlpha = Math.min(1, alpha);
        tracePath(sr, sh);
        g.fill();
      }
      g.globalAlpha = 1;
    };

    g.save();
    // Veil: a translucent saffron edge that bleeds into the glow.
    g.shadowColor = `rgba(236,104,24,${Math.min(0.7, 0.5 * core)})`;
    g.shadowBlur = unit * 0.14;
    layer(
      [
        [1.38, 1.1, 0.14],
        [1.24, 1.06, 0.17],
        [1.12, 1.03, 0.2],
      ],
      H * 1.05,
      [
        [0, "rgba(240,128,36,0.9)"],
        [0.5, "rgba(232,96,22,0.75)"],
        [1, "rgba(214,70,14,0)"],
      ],
    );
    g.shadowBlur = 0;
    g.globalCompositeOperation = "lighter";
    // Body: saffron to marigold.
    layer(
      [
        [1, 1, 0.24 * core],
        [0.9, 0.97, 0.24 * core],
        [0.8, 0.94, 0.22 * core],
      ],
      H,
      [
        [0, "rgba(246,170,64,1)"],
        [0.45, "rgba(240,134,40,0.9)"],
        [1, "rgba(226,88,20,0)"],
      ],
    );
    // Inner flame: warm yellow.
    layer(
      [
        [0.64, 0.76, 0.25 * core],
        [0.55, 0.72, 0.25 * core],
        [0.46, 0.68, 0.25 * core],
      ],
      H * 0.74,
      [
        [0, "rgba(255,214,128,1)"],
        [0.6, "rgba(250,186,92,0.8)"],
        [1, "rgba(242,150,60,0)"],
      ],
    );
    // Core: white-yellow, seated on the wick.
    layer(
      [
        [0.42, 0.58, 0.42 * core],
        [0.34, 0.54, 0.42 * core],
        [0.26, 0.5, 0.42 * core],
      ],
      H * 0.56,
      [
        [0, "rgba(255,250,236,1)"],
        [0.55, "rgba(255,240,205,0.85)"],
        [1, "rgba(255,226,160,0)"],
      ],
    );
    g.restore();

    // Faint blue skirt where the oil vapour meets the wick.
    g.save();
    g.translate(X(bendAt(0)), Y(0.015 * H));
    g.scale(1, 0.42);
    const skirtR = W * unit * 1.05;
    const skirt = g.createRadialGradient(0, 0, skirtR * 0.45, 0, 0, skirtR);
    skirt.addColorStop(0, "rgba(80,110,250,0)");
    skirt.addColorStop(0.6, "rgba(80,110,250,0.22)");
    skirt.addColorStop(1, "rgba(80,110,250,0)");
    g.fillStyle = skirt;
    g.beginPath();
    g.arc(0, 0, skirtR, 0, Math.PI);
    g.fill();
    g.restore();

    // Creating: circulating embers. Celebrate: rising sparks.
    if (f.swirl > 0.01 || f.sparks > 0.01) {
      g.save();
      g.globalCompositeOperation = "lighter";
      const dot = (x: number, y: number, r: number, alpha: number) => {
        if (alpha <= 0.004) return;
        const px = X(x);
        const py = Y(y);
        const grad = g.createRadialGradient(px, py, 0, px, py, r);
        grad.addColorStop(0, `rgba(255,236,190,${Math.min(1, alpha)})`);
        grad.addColorStop(0.35, `rgba(255,190,90,${Math.min(1, alpha * 0.6)})`);
        grad.addColorStop(1, "rgba(242,120,30,0)");
        g.fillStyle = grad;
        g.fillRect(px - r, py - r, r * 2, r * 2);
      };
      for (let i = 0; i < 7 && f.swirl > 0.01; i += 1) {
        const a = t * (1.05 + 0.11 * i) + i * 0.8976;
        const rx = 0.36 + 0.05 * Math.sin(t * 0.7 + i * 1.7);
        const cy = H * (0.42 + 0.05 * Math.sin(t * 0.9 + i));
        const front = 0.45 + 0.55 * (0.5 - 0.5 * Math.sin(a));
        dot(
          Math.cos(a) * rx,
          cy + Math.sin(a) * 0.11 + 0.06 * Math.sin(a * 2 + i),
          unit * (0.045 + 0.025 * front),
          f.swirl * front * 0.95,
        );
      }
      for (let j = 0; j < 6 && f.sparks > 0.01; j += 1) {
        const life = (t * 0.62 + j * 0.173) % 1;
        const sway = Math.sin(j * 7.3 + t * 1.6) * 0.12 * life;
        const fade = (1 - life) * Math.min(1, life / 0.12);
        dot(bendAt(1) + sway, H * 0.82 + life * 0.75, unit * 0.04, f.sparks * fade);
      }
      g.restore();
    }
  };

  const loop = createDiyaLoop({
    canvas: options.canvas,
    vitality: options.vitality,
    behavior: options.behavior,
    onLight: options.onLight,
    resize(w, h) {
      width = w;
      height = h;
      options.canvas.width = w;
      options.canvas.height = h;
    },
    draw,
  });
  loop.start();

  return {
    ready: Promise.resolve(),
    setVitality: (value) => loop.setVitality(value),
    setBehavior: (value) => loop.setBehavior(value),
    react: (kind) => loop.react(kind),
    dispose: () => loop.dispose(),
  };
}
