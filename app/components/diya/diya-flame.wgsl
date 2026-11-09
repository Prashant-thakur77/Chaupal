// Living diya flame: a procedural flame on a transparent surface.
// Flame space: origin at the wick, y up, 1 unit = a resting flame's height.
// Output is premultiplied; the canvas is composited with `screen` so the
// glow warms the clay lamp and the night around it.

struct Params {
  resolution: vec2f,
  wick: vec2f,
  unit: f32,
  time: f32,
  height: f32,
  width: f32,
  lean: f32,
  turbulence: f32,
  flickerSpeed: f32,
  core: f32,
  glow: f32,
  glowRadius: f32,
  ripple: f32,
  swirl: f32,
  sparks: f32,
}
@group(0) @binding(0) var<uniform> params: Params;

const TAU = 6.28318530718;
const SAFFRON_DEEP = vec3f(0.78, 0.24, 0.05);
const SAFFRON = vec3f(0.96, 0.46, 0.11);
const MARIGOLD = vec3f(0.949, 0.663, 0.231);
const WARM_YELLOW = vec3f(1.0, 0.86, 0.53);
const WHITE_YELLOW = vec3f(1.0, 0.975, 0.9);
const EMBER = vec3f(1.0, 0.76, 0.38);

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

fn valueNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 4; i++) {
    v += a * valueNoise(q);
    q = q * 2.03 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Warm temperature ramp: transparent → saffron → marigold → white-yellow core.
fn ramp(h: f32) -> vec3f {
  let x = clamp(h, 0.0, 1.0);
  if (x < 0.25) {
    return mix(mix(SAFFRON_DEEP, SAFFRON, 0.55), SAFFRON, x / 0.25);
  }
  if (x < 0.52) {
    return mix(SAFFRON, MARIGOLD, (x - 0.25) / 0.27);
  }
  if (x < 0.78) {
    return mix(MARIGOLD, WARM_YELLOW, (x - 0.52) / 0.26);
  }
  return mix(WARM_YELLOW, WHITE_YELLOW, (x - 0.78) / 0.22);
}

// Radius of a teardrop flame at height y: round belly, long pointed tip.
fn profile(y: f32, height: f32, halfWidth: f32) -> f32 {
  let belly = 0.24 * height;
  let bottom = -0.07 * height;
  if (y < bottom) {
    return 0.0;
  }
  if (y < belly) {
    let b = (belly - y) / (belly - bottom);
    return halfWidth * sqrt(max(0.0, 1.0 - b * b));
  }
  let s = clamp((y - belly) / (height - belly), 0.0, 1.0);
  return halfWidth * pow(1.0 - s, 1.3) * (1.0 + 0.3 * s * (1.0 - s));
}

@fragment fn fs_main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / params.resolution;
  let aspect = params.resolution.x / max(params.resolution.y, 1.0);
  let p = vec2f((uv.x - params.wick.x) * aspect, params.wick.y - uv.y) / params.unit;
  let px = 1.0 / max(params.unit * params.resolution.y, 1.0);

  let t = params.time;
  let ft = t * params.flickerSpeed;
  let H = max(params.height, 0.2);
  let W = 0.23 * params.width;
  let q = clamp(p.y / H, 0.0, 1.25);

  // The whole flame bends toward its lean, more toward the tip.
  let wander = (valueNoise(vec2f(ft * 0.85, 3.1)) - 0.5) * 0.22 * params.turbulence;
  let bend = (params.lean + wander) * H * q * q;
  var x = p.x - bend;

  // Turbulence rising through the flame, strongest near the tip.
  let rising = fbm(vec2f(p.x * 3.4, p.y * 2.3 - ft * 2.9));
  x += (rising - 0.5) * 0.15 * params.turbulence * pow(q, 1.4) * H;
  // Receiving: ripples travel up the body of the flame.
  x += sin(p.y * 15.0 - t * 6.4) * 0.028 * params.ripple * smoothstep(0.05, 0.35, q);
  // Tongues: the tip stretches and tears with fast noise.
  let tongue = fbm(vec2f(p.x * 5.2 + 7.0, p.y * 3.2 - ft * 4.1));
  let y = p.y + (tongue - 0.5) * 0.15 * params.turbulence * q * H;

  let r = profile(y, H, W);
  let ax = abs(x);
  // Edge softness scales with the local radius so the tip never thins to a line.
  let soft = 0.01 + 0.12 * r + px * 1.5;
  let body = (1.0 - smoothstep(r - soft, r + soft, ax)) * smoothstep(0.0, 0.018, r);
  let nd = clamp(ax / max(r, 0.0001), 0.0, 1.0);

  // Heat: hottest in the lower middle, cooling toward the edges and tip.
  let vertical = mix(1.0, 0.42, smoothstep(0.18, 1.0, y / H));
  var heat = (1.0 - nd * nd) * vertical;
  // Inner core: a smaller teardrop seated on the wick.
  let rc = profile(y + 0.015 * H, H * 0.6, W * 0.46);
  let coreMask = (1.0 - smoothstep(rc * 0.45, rc + soft * 0.6, ax)) * smoothstep(0.0, 0.015, rc);
  heat = clamp(heat * 0.88 * params.core + coreMask * 0.5 * params.core, 0.0, 1.0);

  var flameColor = ramp(heat);
  // A faint blue skirt at the base where the oil vapour burns cleanly.
  let blue = (1.0 - smoothstep(0.0, 0.14 * H, y)) * smoothstep(0.6, 0.95, nd) * smoothstep(-0.07 * H, 0.0, y);
  flameColor = mix(flameColor, vec3f(0.36, 0.46, 0.98), blue * 0.28);
  var flameAlpha = body * (0.62 + 0.38 * heat);
  flameAlpha *= 1.0 - smoothstep(0.72, 1.08, y / H) * 0.55;
  flameAlpha = clamp(flameAlpha * mix(0.9, 1.0, params.core), 0.0, 1.0);

  // Glow: a warm halo that reaches the clay and the dark around it.
  let gc = vec2f(bend * 0.4, H * 0.36);
  let gd = length((p - gc) * vec2f(1.0, 0.86)) / max(params.glowRadius, 0.3);
  var g = params.glow * (0.42 * exp(-gd * gd * 4.2) + 0.2 / (1.0 + gd * gd * 7.0));
  g *= 1.0 + (valueNoise(vec2f(ft * 6.0, 0.5)) - 0.5) * 0.2 * params.turbulence;
  // Receiving: soft rings of light spreading outward.
  let ringWave = pow(max(0.0, sin(gd * 11.0 - t * 3.0)), 10.0);
  g += params.ripple * ringWave * smoothstep(0.22, 0.5, gd) * exp(-gd * 1.2) * 0.42;
  // Less light falls on the outside of the bowl below the lip.
  g *= mix(0.5, 1.0, smoothstep(-0.55, 0.12, p.y));
  let edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
  g *= 1.0 - smoothstep(0.62, 1.0, edge);
  let glowAlpha = clamp(g, 0.0, 0.85);
  let glowColor = mix(MARIGOLD, SAFFRON_DEEP, smoothstep(0.1, 1.3, gd));

  // Creating: embers circulate around the flame; celebrate: sparks rise.
  var ember = 0.0;
  if (params.swirl > 0.001) {
    for (var i = 0; i < 7; i++) {
      let fi = f32(i);
      let a = t * (1.05 + 0.11 * fi) + fi * 0.8976;
      let rx = 0.36 + 0.05 * sin(t * 0.7 + fi * 1.7);
      let centre = vec2f(0.0, H * (0.42 + 0.05 * sin(t * 0.9 + fi)));
      let pos = centre + vec2f(cos(a) * rx, sin(a) * 0.11 + 0.06 * sin(a * 2.0 + fi));
      let front = 0.45 + 0.55 * (0.5 - 0.5 * sin(a));
      let d = p - pos;
      ember += params.swirl * front * 0.00042 / (dot(d, d) + 0.00028);
    }
  }
  if (params.sparks > 0.001) {
    for (var j = 0; j < 6; j++) {
      let fj = f32(j);
      let life = fract(t * 0.62 + fj * 0.173);
      let sway = sin(fj * 7.3 + t * 1.6) * 0.12 * life;
      let pos = vec2f(bend + sway, H * 0.82 + life * 0.75);
      let fade = (1.0 - life) * smoothstep(0.0, 0.12, life);
      let d = p - pos;
      ember += params.sparks * fade * 0.00022 / (dot(d, d) + 0.00012);
    }
  }
  let emberAlpha = clamp(ember, 0.0, 1.0);

  // Composite (premultiplied): embers over flame over glow.
  var rgb = glowColor * glowAlpha;
  var a = glowAlpha;
  rgb = flameColor * flameAlpha + rgb * (1.0 - flameAlpha);
  a = flameAlpha + a * (1.0 - flameAlpha);
  rgb = EMBER * emberAlpha + rgb * (1.0 - emberAlpha);
  a = emberAlpha + a * (1.0 - emberAlpha);

  // Dither the long glow gradient so it never bands.
  let dither = (hash21(position.xy + fract(t)) - 0.5) / 255.0;
  rgb = clamp(rgb + dither, vec3f(0.0), vec3f(a));
  return vec4f(rgb, a);
}
