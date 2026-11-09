import { useId } from "react";

import { DIYA_LAYOUT_COMPACT, DIYA_LAYOUT_FULL } from "./diya-geometry";

/**
 * The clay lamp under the flame: a terracotta diya, front view, with a
 * pinched spout holding the wick, oil with a marigold glint, a painted chalk
 * dot arc and scallop, clay grain, and a chalk-white rangoli on the floor
 * around its base. Drawn in a 200×200 viewBox with the wick tip at
 * (100, 141); compact diyas crop the viewBox in (see diya-geometry.ts).
 *
 * Two layers: `DiyaLamp` is static (its grain filter never re-rasterises),
 * `DiyaLampLight` holds everything the flame lights and is faded as a whole
 * by the `--diya-light` variable, a compositor-only opacity change.
 */

const RANGOLI = { cx: 100, cy: 168, rx: 72, ry: 15.5 } as const;

function ellipsePoint(cx: number, cy: number, rx: number, ry: number, a: number) {
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as const;
}

function fmt(n: number) {
  return Math.round(n * 100) / 100;
}

// Lotus petals standing on the rangoli ring, foreshortened by the floor's tilt.
const PETALS = Array.from({ length: 18 }, (_, k) => {
  const a = (k / 18) * Math.PI * 2 + Math.PI / 18;
  const { cx, cy, rx, ry } = RANGOLI;
  const [lx, ly] = ellipsePoint(cx, cy, rx, ry, a - 0.105);
  const [rx2, ry2] = ellipsePoint(cx, cy, rx, ry, a + 0.105);
  const [clx, cly] = ellipsePoint(cx, cy, rx + 7.5, ry + 2.6, a - 0.1);
  const [crx, cry] = ellipsePoint(cx, cy, rx + 7.5, ry + 2.6, a + 0.1);
  const [tx, ty] = ellipsePoint(cx, cy, rx + 11.5, ry + 4, a);
  return {
    d: `M${fmt(lx)} ${fmt(ly)} Q${fmt(clx)} ${fmt(cly)} ${fmt(tx)} ${fmt(ty)} Q${fmt(crx)} ${fmt(cry)} ${fmt(rx2)} ${fmt(ry2)}`,
    front: Math.sin(a) > -0.2,
  };
});

const PETAL_DOTS = Array.from({ length: 18 }, (_, k) => {
  const a = (k / 18) * Math.PI * 2;
  const [x, y] = ellipsePoint(RANGOLI.cx, RANGOLI.cy, RANGOLI.rx + 6, RANGOLI.ry + 2.1, a);
  return { x: fmt(x), y: fmt(y) };
});

// Painted on the bowl: an arc of chalk dots over a scalloped chalk line.
const BAND_DOTS = Array.from({ length: 13 }, (_, k) => {
  const a = Math.PI * (0.1 + (0.8 * k) / 12);
  const [x, y] = ellipsePoint(100, 134, 44.5, 10.5, a);
  return { x: fmt(x), y: fmt(y) };
});

const SCALLOP = (() => {
  const count = 12;
  let d = "";
  for (let k = 0; k <= count; k += 1) {
    const a = Math.PI * (0.13 + (0.74 * k) / count);
    const [x, y] = ellipsePoint(100, 134, 39.5, 15.5, a);
    if (k === 0) {
      d += `M${fmt(x)} ${fmt(y)}`;
    } else {
      const am = a - (Math.PI * 0.74) / count / 2;
      const [mx, my] = ellipsePoint(100, 134, 39.5, 19.5, am);
      d += ` Q${fmt(mx)} ${fmt(my)} ${fmt(x)} ${fmt(y)}`;
    }
  }
  return d;
})();

const BOWL =
  "M53 127 C54.5 145.5 73 157.5 100 157.5 C127 157.5 145.5 145.5 147 127 Z";

function useSvgId(prefix: string) {
  const raw = useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export function DiyaLamp({
  compact = false,
  pixelSize = null,
}: {
  compact?: boolean;
  /** Rendered stage size in CSS px, used to keep chalk lines about 1px wide. */
  pixelSize?: number | null;
}) {
  const id = useSvgId("diya");
  const ref = (name: string) => `url(#${id}-${name})`;
  const chalk = "var(--ch-chalk-50, #F7F1E6)";
  const unitsPerPx = pixelSize ? (compact ? 152 : 200) / pixelSize : 0.7;
  const stroke = compact ? Math.min(2.6, 1.15 * unitsPerPx) : 1.05;
  const layout = compact ? DIYA_LAYOUT_COMPACT : DIYA_LAYOUT_FULL;

  return (
    <svg
      className="living-diya__svg"
      viewBox={layout.viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5e2412" />
          <stop offset="0.22" stopColor="#7A3018" />
          <stop offset="0.5" stopColor="#B9532B" />
          <stop offset="0.63" stopColor="#D9733F" />
          <stop offset="0.82" stopColor="#9a3f1e" />
          <stop offset="1" stopColor="#5e2412" />
        </linearGradient>
        <radialGradient id={`${id}-underside`} cx="0.5" cy="1.05" r="0.78">
          <stop offset="0" stopColor="#1A0F08" stopOpacity="0.72" />
          <stop offset="0.6" stopColor="#1A0F08" stopOpacity="0.18" />
          <stop offset="1" stopColor="#1A0F08" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6A2611" />
          <stop offset="0.32" stopColor="#B4552B" />
          <stop offset="0.56" stopColor="#E08550" />
          <stop offset="0.78" stopColor="#B9532B" />
          <stop offset="1" stopColor="#6A2611" />
        </linearGradient>
        <linearGradient id={`${id}-spout`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#D9733F" />
          <stop offset="0.6" stopColor="#B4552B" />
          <stop offset="1" stopColor="#7A3018" />
        </linearGradient>
        <radialGradient id={`${id}-oil`} cx="0.5" cy="0.8" r="0.75">
          <stop offset="0" stopColor="#4a1d08" />
          <stop offset="0.5" stopColor="#240d05" />
          <stop offset="1" stopColor="#120603" />
        </radialGradient>
        {compact ? null : (
          <>
            {/* Clay grain: grey fractal noise, soft-light blended on the bowl. */}
            <filter id={`${id}-clay`} x="0" y="0" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                seed="7"
              />
              <feColorMatrix
                type="matrix"
                values="1.4 0 0 0 -0.2  1.4 0 0 0 -0.2  1.4 0 0 0 -0.2  0 0 0 0 1"
              />
            </filter>
            <clipPath id={`${id}-bowlclip`}>
              <path d={BOWL} />
            </clipPath>
            <filter id={`${id}-soft`} x="-30%" y="-80%" width="160%" height="260%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
          </>
        )}
      </defs>

      {/* Rangoli: chalk lines on the floor around the base. */}
      <g
        fill="none"
        stroke={chalk}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {compact ? (
          <ellipse
            cx={RANGOLI.cx}
            cy={RANGOLI.cy}
            rx={RANGOLI.rx - 8}
            ry={RANGOLI.ry - 2}
            strokeWidth={stroke}
            opacity="0.6"
          />
        ) : (
          <>
            <ellipse
              cx={RANGOLI.cx}
              cy={RANGOLI.cy}
              rx={RANGOLI.rx + 19}
              ry={RANGOLI.ry + 7}
              strokeWidth="1.6"
              strokeDasharray="0.01 5.2"
              opacity="0.62"
            />
            <ellipse
              cx={RANGOLI.cx}
              cy={RANGOLI.cy}
              rx={RANGOLI.rx}
              ry={RANGOLI.ry}
              strokeWidth={stroke}
              opacity="0.82"
            />
            <ellipse
              cx={RANGOLI.cx}
              cy={RANGOLI.cy}
              rx={RANGOLI.rx - 10}
              ry={RANGOLI.ry - 3.3}
              strokeWidth="0.7"
              strokeDasharray="3 2.4"
              opacity="0.5"
            />
            {PETALS.map((petal, k) => (
              <path
                key={k}
                d={petal.d}
                strokeWidth={stroke}
                opacity={petal.front ? 0.85 : 0.55}
              />
            ))}
            {PETAL_DOTS.map((dot, k) => (
              <circle
                key={k}
                cx={dot.x}
                cy={dot.y}
                r="0.95"
                fill={chalk}
                stroke="none"
                opacity="0.75"
              />
            ))}
          </>
        )}
      </g>

      {/* Contact shadow. */}
      <ellipse
        cx="100"
        cy="163"
        rx="36"
        ry="5"
        fill="#07050f"
        opacity="0.75"
        filter={compact ? undefined : ref("soft")}
      />

      {/* Foot ring. */}
      <path d="M79 152 Q79 163.2 100 163.2 Q121 163.2 121 152 Z" fill="#5a2210" />
      <path
        d="M80.5 160.4 Q100 165 119.5 160.4"
        fill="none"
        stroke="#8a3a1c"
        strokeWidth="0.8"
        opacity="0.8"
      />

      {/* Bowl, with clay grain. */}
      <path d={BOWL} fill={ref("body")} />
      {compact ? null : (
        <rect
          x="50"
          y="122"
          width="100"
          height="40"
          filter={ref("clay")}
          clipPath={ref("bowlclip")}
          opacity="0.32"
          style={{ mixBlendMode: "soft-light" }}
        />
      )}
      <path d={BOWL} fill={ref("underside")} />

      {/* Painted chalk dot arc and scallop. */}
      {compact ? null : (
        <g opacity="0.8">
          {BAND_DOTS.map((dot, k) => (
            <circle key={k} cx={dot.x} cy={dot.y} r="1.05" fill={chalk} />
          ))}
          <path
            d={SCALLOP}
            fill="none"
            stroke={chalk}
            strokeWidth="0.85"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>
      )}

      {/* Rim and oil well. */}
      <ellipse cx="100" cy="127" rx="47" ry="10" fill={ref("rim")} />
      <ellipse cx="100" cy="127.6" rx="41" ry="7.3" fill={ref("oil")} />

      {/* Spout: the rim pinched forward to cradle the wick. */}
      <path
        d="M76 133.2 C87 137.4 95 144 100 152 C105 144 113 137.4 124 133.2 C116 132 108 131.6 100 131.6 C92 131.6 84 132 76 133.2 Z"
        fill={ref("spout")}
      />
      <path
        d="M90.5 133.4 C95 136.6 98 141 100 146.5 C102 141 105 136.6 109.5 133.4 C106 134.4 103 134.7 100 134.7 C97 134.7 94 134.4 90.5 133.4 Z"
        fill="#1f0d06"
      />
      <path
        d="M100 130 L100 142"
        stroke="#1a0c06"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Everything the flame lights: floor pool, bowl, rim, oil glint, wick. */
export function DiyaLampLight({ compact = false }: { compact?: boolean }) {
  const id = useSvgId("diyalight");
  const ref = (name: string) => `url(#${id}-${name})`;
  const layout = compact ? DIYA_LAYOUT_COMPACT : DIYA_LAYOUT_FULL;

  return (
    <svg
      className="living-diya__svg"
      viewBox={layout.viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-floor`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F4A93C" stopOpacity="0.36" />
          <stop offset="0.55" stopColor="#D0643A" stopOpacity="0.12" />
          <stop offset="1" stopColor="#D0643A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-bowl`} cx="0.5" cy="0" r="0.75">
          <stop offset="0" stopColor="#F4A93C" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#F28A2E" stopOpacity="0.18" />
          <stop offset="1" stopColor="#F28A2E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-glint`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD58C" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#F4A93C" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F4A93C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx="100"
        cy="166"
        rx={compact ? 70 : 92}
        ry={compact ? 18 : 24}
        fill={ref("floor")}
      />
      <path d={BOWL} fill={ref("bowl")} />
      <path
        d="M57 124.2 Q100 114.5 143 124.2"
        fill="none"
        stroke="#FFC866"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.75"
      />
      <ellipse cx="100" cy="130.6" rx="19" ry="3.4" fill={ref("glint")} />
      <circle cx="100" cy="141.4" r="1.6" fill="#FFC866" />
    </svg>
  );
}
