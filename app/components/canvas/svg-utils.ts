/** Helpers for showing provider SVG safely on the stage. */

/** Focus ring shared by every control on the stage (high contrast on dark). */
export const FOCUS_RING =
  "outline-none focus-visible:outline-4 focus-visible:outline-offset-[3px] focus-visible:outline-[#F4EFE6]";

/**
 * Strips anything active from an SVG string before it is inlined: scripts,
 * foreignObject, event-handler attributes and javascript: links. The root
 * element loses its fixed width/height so CSS sizes it.
 */
export function sanitizeSvg(svg: string): string {
  let out = svg
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href\s*=\s*["'])\s*javascript:[^"']*(["'])/gi, "$1#$2");
  out = out.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const cleaned = attrs
      .replace(/\swidth\s*=\s*("[^"]*"|'[^']*')/i, "")
      .replace(/\sheight\s*=\s*("[^"]*"|'[^']*')/i, "")
      .replace(/\spreserveAspectRatio\s*=\s*("[^"]*"|'[^']*')/i, "");
    return `<svg${cleaned} preserveAspectRatio="xMidYMid meet" focusable="false">`;
  });
  return out.trim();
}

/** An SVG as a data: URL (used as a CSS mask, so it can never run anything). */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The viewBox aspect (width / height) of an SVG string, if it has one. */
export function svgAspect(svg: string, fallback: number): number {
  const m = /viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
  if (!m) return fallback;
  const w = Number(m[3]);
  const h = Number(m[4]);
  return w > 0 && h > 0 ? w / h : fallback;
}
