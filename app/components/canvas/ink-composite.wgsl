// Live-ink compositor for the dark evening stage.
// Reads the same persistent coverage mask that paint.wgsl stamps and writes
// premultiplied ink over a transparent canvas, so the reference and her
// committed strokes stay visible underneath.

struct Uniforms {
  resolution: vec2f,
  mask_size: vec2f,
  ink: vec4f,
  grain_cell: f32,
  chalk: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> mask: array<f32>;

fn mask_texel(t: vec2i) -> f32 {
  let size = vec2i(uniforms.mask_size);
  if (t.x < 0 || t.y < 0 || t.x >= size.x || t.y >= size.y) {
    return 0.0;
  }
  return mask[u32(t.y) * u32(uniforms.mask_size.x) + u32(t.x)];
}

fn mask_at(p: vec2f) -> f32 {
  if (any(p < vec2f(0.0)) || any(p > vec2f(1.0))) {
    return 0.0;
  }
  let texel = p * uniforms.mask_size - vec2f(0.5);
  let base = floor(texel);
  let f = texel - base;
  let b = vec2i(base);
  let c00 = mask_texel(b);
  let c10 = mask_texel(b + vec2i(1, 0));
  let c01 = mask_texel(b + vec2i(0, 1));
  let c11 = mask_texel(b + vec2i(1, 1));
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

fn grain(position: vec2f) -> f32 {
  let cell = floor(position / max(uniforms.grain_cell, 1.0));
  return fract(sin(dot(cell, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
}

@fragment
fn fs_main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / uniforms.resolution;
  let coverage = clamp(mask_at(uv), 0.0, 1.0);
  if (coverage <= 0.0) {
    return vec4f(0.0);
  }
  // Chalk on slate breaks up at the edges; pigment pools in the core.
  let tooth = grain(position.xy) * uniforms.chalk;
  let opacity = clamp(smoothstep(0.02, 0.5, coverage) + tooth * (1.0 - coverage), 0.0, 1.0);
  let pool = smoothstep(0.55, 1.0, coverage) * 0.08;
  let color = clamp(uniforms.ink.rgb * (1.0 + grain(position.xy * 0.5) * 0.06) + vec3f(pool), vec3f(0.0), vec3f(1.0));
  let alpha = opacity * uniforms.ink.a;
  return vec4f(color * alpha, alpha);
}
