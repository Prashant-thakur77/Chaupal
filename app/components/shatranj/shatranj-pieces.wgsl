// Round Shatranj discs, one instanced quad each. The fragment shader shades a
// glazed disc analytically (dome light, rim, incised ring), casts its shadow,
// and inks the Devanagari label from the glyph atlas on the face.

struct Params {
  canvasSize: vec2f,
  boardOrigin: vec2f,
  squarePx: f32,
  discRatio: f32,
  innerRing: f32,
  rimWidth: f32,
  atlasCellPx: f32,
  atlasColumns: f32,
  ringPx: f32,
  dpr: f32,
  herFace: vec4f,
  herInk: vec4f,
  herRim: vec4f,
  herRing: vec4f,
  otherFace: vec4f,
  otherInk: vec4f,
  otherRim: vec4f,
  otherRing: vec4f,
  shadow: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;
// Two vec4 per disc: (x, y, lift, opacity), (rotation, atlasIndex, her, scale)
@group(0) @binding(1) var<storage, read> discs: array<vec4f, 96>;
@group(0) @binding(2) var glyphAtlas: texture_2d<f32>;
@group(0) @binding(3) var glyphSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) pose: vec4f,
  @location(2) @interpolate(flat) look: vec4f,
  @location(3) @interpolate(flat) radius: f32,
}

@vertex fn vs_main(
  @builtin(vertex_index) vertex: u32,
  @builtin(instance_index) instance: u32,
) -> VertexOut {
  let pose = discs[instance * 2u];
  let look = discs[instance * 2u + 1u];
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let corner = corners[vertex];
  let radius = 0.5 * params.discRatio * params.squarePx * look.w;
  var center = params.boardOrigin + pose.xy * params.squarePx;
  // Resting discs snap so atlas texels land on device pixels: crisp labels.
  if (pose.z < 0.001 && abs(look.x) < 0.0001 && abs(look.w - 1.0) < 0.0001) {
    let half = params.atlasCellPx * 0.5;
    center = floor(center - vec2f(half) + vec2f(0.5)) + vec2f(half);
  }
  let extent = radius * 1.3 + params.squarePx * 0.32 + 2.0;
  let visible = select(0.0, 1.0, pose.w > 0.001);
  let pixel = center + corner * extent * visible;
  var out: VertexOut;
  out.position = vec4f(
    pixel.x / params.canvasSize.x * 2.0 - 1.0,
    1.0 - pixel.y / params.canvasSize.y * 2.0,
    0.0,
    1.0,
  );
  out.local = corner * extent;
  out.pose = pose;
  out.look = look;
  out.radius = radius;
  return out;
}

fn rotate2(value: vec2f, angle: f32) -> vec2f {
  let s = sin(angle);
  let c = cos(angle);
  return vec2f(c * value.x - s * value.y, s * value.x + c * value.y);
}

fn shadowProfile(t: f32) -> f32 {
  if (t < 0.66) {
    return 0.62;
  }
  if (t < 0.84) {
    return mix(0.62, 0.22, (t - 0.66) / 0.18);
  }
  return mix(0.22, 0.0, clamp((t - 0.84) / 0.16, 0.0, 1.0));
}

fn glyphAt(texel: vec2f, cellOrigin: vec2f, atlasSize: vec2f) -> f32 {
  let cell = params.atlasCellPx;
  let inside = all(texel >= vec2f(0.0)) && all(texel <= vec2f(cell));
  let uv = (cellOrigin + clamp(texel, vec2f(0.5), vec2f(cell - 0.5))) / atlasSize;
  let sampleValue = textureSampleLevel(glyphAtlas, glyphSampler, uv, 0.0).a;
  return select(0.0, sampleValue, inside);
}

@fragment fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let lift = in.pose.z;
  let opacity = in.pose.w;
  let rotation = in.look.x;
  let atlasIndex = u32(in.look.y + 0.5);
  let her = in.look.z;
  let scale = in.look.w;
  let radius = in.radius;
  let p = in.local;
  let sq = params.squarePx;

  // --- cast shadow (same offsets and blob as the DOM renderer) ---
  let shadowOffset = vec2f(0.035 + lift * 0.11, 0.06 + lift * 0.17) * sq;
  let shadowScale = 1.0 + lift * 0.3;
  let shadowRadius = radius * 1.14 * shadowScale;
  let shadowT = length(p - shadowOffset) / shadowRadius;
  let shadowAlpha = shadowProfile(shadowT) * (1.0 - lift * 0.35) * opacity *
    select(0.0, 1.0, shadowT < 1.0);

  // --- disc face ---
  let distance = length(p);
  let discAlpha = clamp(radius - distance + 0.5, 0.0, 1.0) * opacity;
  let n = p / radius;
  let r = length(n);

  let face = mix(params.otherFace.rgb, params.herFace.rgb, her);
  let ink = mix(params.otherInk.rgb, params.herInk.rgb, her);
  let rim = mix(params.otherRim.rgb, params.herRim.rgb, her);
  let ring = mix(params.otherRing.rgb, params.herRing.rgb, her);

  let faceHi = mix(face, vec3f(1.0), 0.38);
  let faceLo = mix(face, vec3f(0.0), 0.2);
  let lightT = length(n * 0.5 + vec2f(0.5) - vec2f(0.34, 0.28)) / 0.977;
  var color = select(
    mix(face, faceLo, clamp((lightT - 0.46) / 0.54, 0.0, 1.0)),
    mix(faceHi, face, lightT / 0.46),
    lightT < 0.46,
  );

  // Glaze: a highlight along the inner top edge, shade along the bottom.
  let edgeBand = smoothstep(0.62, 0.97, r);
  let topLight = edgeBand * clamp(-n.y * 1.4, 0.0, 1.0);
  let bottomShade = edgeBand * clamp(n.y * 1.4, 0.0, 1.0);
  color = mix(color, vec3f(1.0), topLight * mix(0.22, 0.42, her));
  color = mix(color, vec3f(0.0), bottomShade * mix(0.34, 0.26, her));

  // Incised inner ring.
  let ringOuter = params.innerRing * radius;
  let ringWidth = max(params.ringPx, 1.0 * params.dpr);
  let ringCover = clamp(ringOuter - distance + 0.5, 0.0, 1.0) *
    clamp(distance - (ringOuter - ringWidth) + 0.5, 0.0, 1.0);
  color = mix(color, ring, ringCover * 0.62);

  // Label from the atlas, inked per side, with a one-pixel emboss.
  let atlasSize = vec2f(textureDimensions(glyphAtlas));
  let cellOrigin = vec2f(
    f32(atlasIndex % u32(params.atlasColumns)),
    f32(atlasIndex / u32(params.atlasColumns)),
  ) * params.atlasCellPx;
  let texel = rotate2(p, -rotation) / scale + vec2f(params.atlasCellPx * 0.5);
  let glyph = glyphAt(texel, cellOrigin, atlasSize);
  let emboss = glyphAt(texel - vec2f(0.0, params.dpr), cellOrigin, atlasSize);
  let embossMask = max(emboss - glyph, 0.0);
  color = mix(color, mix(vec3f(0.0), vec3f(1.0), her), embossMask * mix(0.45, 0.35, her));
  color = mix(color, ink, glyph);

  // Rim band on top of everything.
  let rimWidthPx = params.rimWidth * radius;
  let rimCover = clamp(distance - (radius - rimWidthPx) + 0.5, 0.0, 1.0);
  color = mix(color, rim, rimCover);

  // Disc over its own shadow, premultiplied.
  let shadowColor = params.shadow.rgb;
  let alpha = discAlpha + shadowAlpha * (1.0 - discAlpha);
  let rgb = color * discAlpha + shadowColor * shadowAlpha * (1.0 - discAlpha);
  return vec4f(rgb, alpha);
}
