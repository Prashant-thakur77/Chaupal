// Fired-clay squares, drawn as a full-canvas effect. The canvas overhangs the
// board by a square on every side; outside the board it stays transparent so
// captured discs can be thrown over the frame.

struct Params {
  boardOrigin: vec2f,
  squarePx: f32,
  dpr: f32,
  squareDark: vec4f,
  squareLight: vec4f,
  lastMove: vec4f,
  selected: vec4f,
  check: vec4f,
  lastFrom: vec2f,
  lastTo: vec2f,
  selectedSquare: vec2f,
  checkSquare: vec2f,
}

@group(0) @binding(0) var<uniform> params: Params;

fn hash2(point: vec2f) -> f32 {
  return fract(sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise2(point: vec2f) -> f32 {
  let cell = floor(point);
  let local = fract(point);
  let smoothLocal = local * local * (vec2f(3.0) - 2.0 * local);
  let a = hash2(cell);
  let b = hash2(cell + vec2f(1.0, 0.0));
  let c = hash2(cell + vec2f(0.0, 1.0));
  let d = hash2(cell + vec2f(1.0, 1.0));
  return mix(mix(a, b, smoothLocal.x), mix(c, d, smoothLocal.x), smoothLocal.y);
}

fn isSquare(cell: vec2f, square: vec2f) -> f32 {
  if (square.x < 0.0) {
    return 0.0;
  }
  return select(0.0, 1.0, all(cell == square));
}

@fragment fn fs_main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let boardPx = params.squarePx * 8.0;
  let local = position.xy - params.boardOrigin;
  // Coverage of the board edge, anti-aliased against the transparent overhang.
  let edge = min(min(local.x, local.y), min(boardPx - local.x, boardPx - local.y));
  let coverage = clamp(edge + 0.5, 0.0, 1.0);
  if (coverage <= 0.0) {
    return vec4f(0.0);
  }

  let u = clamp(local / params.squarePx, vec2f(0.0), vec2f(7.9999));
  let cell = floor(u);
  let parity = (i32(cell.x) + i32(cell.y)) % 2;
  var color = select(params.squareLight.rgb, params.squareDark.rgb, parity == 1);

  // Clay: broad mottling plus a fine fired grain, in CSS pixels so the
  // texture keeps its scale on every screen.
  let cssPx = position.xy / params.dpr;
  let mottle = noise2(u * 2.6 + vec2f(3.1, 7.7)) - 0.5;
  let grain = noise2(cssPx * 0.55) * 0.6 + noise2(cssPx * 1.3 + 11.0) * 0.4;
  let fired = vec3f(0.32, 0.16, 0.08);
  color *= 1.0 + mottle * 0.06;
  color *= mix(vec3f(1.0), fired, 0.3 * 0.55 * grain);

  let last = max(isSquare(cell, params.lastFrom), isSquare(cell, params.lastTo));
  color = mix(color, params.lastMove.rgb, last * 0.52);
  color = mix(color, params.selected.rgb, isSquare(cell, params.selectedSquare) * 0.62);

  if (params.checkSquare.x >= 0.0) {
    let toCheck = length(u - (params.checkSquare + vec2f(0.5))) * 2.0;
    let glow = mix(0.85, 0.35, smoothstep(0.3, 0.72, toCheck)) *
      (1.0 - smoothstep(0.72, 1.0, toCheck));
    color = mix(color, params.check.rgb, glow);
  }

  // Edge vignette, matching the DOM board's radial shade.
  let fromCentre = length((u / 8.0 - vec2f(0.5, 0.45)) / 1.3);
  let vignette = clamp((fromCentre - 0.62) / 0.38, 0.0, 1.0) * 0.2 * 0.55;
  color *= mix(vec3f(1.0), vec3f(0.157, 0.055, 0.016), vignette);

  // A hairline where the squares meet the frame.
  let frameLine = 1.0 - smoothstep(0.0, 1.2 * params.dpr, edge);
  color = mix(color, vec3f(0.1, 0.043, 0.02), frameLine * 0.45);

  return vec4f(color * coverage, coverage);
}
