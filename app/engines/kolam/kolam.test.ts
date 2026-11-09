import { describe, expect, it } from "vitest";

import {
  applyFills,
  canonicalZone,
  describeDesign,
  generateDesign,
  minLoops,
  parseFillPhrase,
  presetParams,
  resolveColour,
  resolveZone,
  suggestDesigns,
  validateDesign,
  FESTIVALS,
  type Design,
  type PulliSymmetry,
} from "./index";
import { parsePath } from "./geometry";

const check = (d: Design, id: string) => d.validation.checks.find((c) => c.id === id);

function regionLines(svg: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = svg.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/data-region-id="([^"]+)"/);
    if (!m) continue;
    // the dots region is a <g> spanning several lines
    if (lines[i].startsWith("<g ")) {
      let j = i;
      while (lines[j] !== "</g>") j++;
      out.set(m[1], lines.slice(i, j + 1).join("\n"));
    } else out.set(m[1], lines[i]);
  }
  return out;
}

describe("pulli kolam", () => {
  it("5×5 4-fold is valid, closed, symmetric, one line", () => {
    const d = generateDesign({ kind: "pulli", grid: 5, symmetry: "4-fold" });
    expect(d.validation.valid).toBe(true);
    expect(check(d, "curves-closed")?.ok).toBe(true);
    expect(check(d, "symmetry-geometry")?.ok).toBe(true);
    expect(check(d, "symmetry-mirrors")?.ok).toBe(true);
    expect(check(d, "dots-enclosed")?.ok).toBe(true);
    expect(d.meta.loopCount).toBe(1);
    expect(d.loops).toHaveLength(1);
    expect(d.dots).toHaveLength(25);
    expect(d.svg).toMatch(/^<svg [^>]*data-kind="pulli" data-grid="5" data-symmetry="4-fold" data-loop-count="1" data-valid="true">/);
    expect((d.svg.match(/data-dot="/g) ?? []).length).toBe(25);
    expect((d.svg.match(/data-loop="/g) ?? []).length).toBe(1);
    // every loop path is closed: ends where it starts
    for (const r of d.regions.filter((x) => x.role === "line")) {
      for (const sp of parsePath(r.d)) {
        expect(sp.closed).toBe(true);
        const a = sp.cubics[0].p0;
        const b = sp.cubics[sp.cubics.length - 1].p3;
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(0.01);
      }
    }
  });

  it("every grid 3..9 and symmetry is valid and reaches the fewest loops", () => {
    for (let grid = 3; grid <= 9; grid++)
      for (const symmetry of ["2-fold", "4-fold", "8-fold"] as PulliSymmetry[]) {
        const d = generateDesign({ kind: "pulli", grid, symmetry });
        const failed = d.validation.checks.filter((c) => !c.ok && c.severity === "error");
        expect(failed, `${grid}×${grid} ${symmetry}`).toEqual([]);
        expect(d.meta.loopCount).toBe(minLoops(grid, symmetry));
      }
  });

  it("odd grids with rotational symmetry make a single line", () => {
    for (const grid of [3, 5, 7, 9])
      for (const symmetry of ["2-fold", "4-fold"] as PulliSymmetry[])
        expect(generateDesign({ kind: "pulli", grid, symmetry }).meta.loopCount).toBe(1);
  });

  it("is deterministic for params + seed, and the seed varies the design", () => {
    const a = generateDesign({ kind: "pulli", grid: 7, symmetry: "4-fold", seed: 3 });
    const b = generateDesign({ kind: "pulli", grid: 7, symmetry: "4-fold", seed: 3 });
    const c = generateDesign({ kind: "pulli", grid: 7, symmetry: "4-fold", seed: 4 });
    expect(a.svg).toBe(b.svg);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(c.svg).not.toBe(a.svg);
    expect(c.validation.valid).toBe(true);
  });

  it("zones: center cell, rings, outer ring", () => {
    const d = generateDesign({ kind: "pulli", grid: 5, symmetry: "4-fold" });
    expect(resolveZone(d, "center")).toEqual(["cell-2-2"]);
    expect(resolveZone(d, "ring-1")).toHaveLength(8);
    expect(resolveZone(d, "bahar")).toHaveLength(16);
    expect(resolveZone(d, "loop")).toEqual(["loop-1"]);
    expect(resolveZone(d, "bindu")).toEqual(["dots"]);
  });

  it("rejects out-of-range params", () => {
    expect(() => generateDesign({ kind: "pulli", grid: 10, symmetry: "4-fold" })).toThrow(RangeError);
    expect(() => generateDesign({ kind: "pulli", grid: 2, symmetry: "4-fold" })).toThrow(RangeError);
  });
});

describe("rangoli", () => {
  const params = { kind: "rangoli", template: "radial", rings: 4, motifs: ["diya", "lotus", "geometric"], petals: 8 } as const;

  it("has unique region ids and is valid", () => {
    const d = generateDesign({ ...params, motifs: [...params.motifs] });
    const ids = d.regions.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(d.validation.valid).toBe(true);
    expect(check(d, "symmetry-geometry")?.ok).toBe(true);
    // svg ids match
    const svgIds = [...d.svg.matchAll(/ id="r-([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(svgIds).size).toBe(svgIds.length);
    expect(svgIds.length).toBe(ids.length);
    // uncoloured by default
    expect(d.regions.every((r) => r.fill === "none")).toBe(true);
  });

  it("every ring/petal combination is valid", () => {
    for (let rings = 2; rings <= 5; rings++)
      for (const petals of [6, 9, 12, 16]) {
        const d = generateDesign({ kind: "rangoli", template: "radial", rings, petals, motifs: ["lotus", "peacock-feather", "mango-leaf"] });
        expect(d.validation.valid, `${rings} rings ${petals} petals`).toBe(true);
      }
  });

  it("applyFills changes exactly the targeted regions", () => {
    const d = generateDesign({ ...params, motifs: [...params.motifs] });
    const parsed = parseFillPhrase("beech mein peela, bahar laal");
    const res = applyFills(
      d,
      parsed.fills.map((f) => ({ zone: f.zone, colour: f.colour })),
    );
    const expected = [...resolveZone(d, "center"), ...resolveZone(d, "outer")].sort();
    expect(res.changed.slice().sort()).toEqual(expected);
    expect(resolveZone(d, "center")).toEqual(["center"]);
    expect(res.unresolved).toEqual([]);
    for (const r of res.design.regions) {
      const before = d.regions.find((x) => x.id === r.id)!;
      if (r.id === "center") expect(r.fill).toBe("peela");
      else if (expected.includes(r.id)) expect(r.fill).toBe("laal");
      else expect(r.fill).toBe(before.fill);
      expect(r.d).toBe(before.d);
    }
    // svg: only the changed region lines differ
    const a = regionLines(d.svg);
    const b = regionLines(res.svg);
    const differing = [...a.keys()].filter((k) => a.get(k) !== b.get(k)).sort();
    expect(differing).toEqual(expected);
    expect(res.svg.split("\n").length).toBe(d.svg.split("\n").length);
    expect(res.svg).toContain(`data-region-id="center" data-zone="center" data-zones="center medallion" data-fill="peela" fill="#F7C948"`);
    // input untouched
    expect(d.regions.every((r) => r.fill === "none")).toBe(true);
  });

  it("applyFills by region id, clears with none, reports unknowns", () => {
    const d = generateDesign({ ...params, motifs: [...params.motifs] });
    const one = applyFills(d, [{ regionId: "ring-1-petal-3", colour: "गुलाबी" }]);
    expect(one.changed).toEqual(["ring-1-petal-3"]);
    expect(one.design.regions.find((r) => r.id === "ring-1-petal-3")?.fill).toBe("gulabi");
    const cleared = applyFills(one.design, [{ regionId: "ring-1-petal-3", colour: "none" }]);
    expect(cleared.changed).toEqual(["ring-1-petal-3"]);
    expect(cleared.svg).toBe(d.svg);
    const bad = applyFills(d, [{ zone: "ring-9", colour: "laal" }, { regionId: "nope", colour: "laal" }, { zone: "center", colour: "golden" }]);
    expect(bad.changed).toEqual([]);
    expect(bad.unresolved).toHaveLength(3);
    expect(bad.svg).toBe(d.svg);
  });

  it("presets are secular parameter bundles and validate", () => {
    for (const f of FESTIVALS) {
      const d = generateDesign(presetParams(f));
      expect(d.validation.valid, f).toBe(true);
      const params = d.params;
      if (params.kind === "rangoli")
        for (const m of params.motifs) expect(["lotus", "diya", "peacock-feather", "mango-leaf", "geometric"]).toContain(m);
    }
    const diwali = presetParams("diwali");
    expect(diwali.kind).toBe("rangoli");
    if (diwali.kind === "rangoli") expect(diwali.motifs).toContain("diya");
    expect(presetParams("onam").kind).toBe("pookalam");
  });
});

describe("pookalam", () => {
  it("has the requested number of rings, each split into segments", () => {
    for (let rings = 3; rings <= 7; rings++) {
      const d = generateDesign({ kind: "pookalam", rings });
      expect(d.validation.valid, `${rings} rings`).toBe(true);
      expect(d.meta.ringCount).toBe(rings);
      for (let k = 1; k <= rings; k++) {
        const segs = resolveZone(d, `ring-${k}`);
        expect(segs.length).toBeGreaterThanOrEqual(8);
        expect(segs.length % 8).toBe(0);
      }
      expect(resolveZone(d, `ring-${rings + 1}`)).toEqual([]);
      expect(resolveZone(d, "outer")).toEqual(resolveZone(d, `ring-${rings}`));
      expect(d.svg).toContain(`data-rings="${rings}"`);
    }
  });

  it("palette prefills, and a phrase recolours", () => {
    const d = generateDesign(presetParams("onam"));
    expect(d.regions.every((r) => r.fill !== "none")).toBe(true);
    const res = applyFills(d, parseFillPhrase("बीच में पीला और बाहर लाल").fills);
    expect(res.design.regions.filter((r) => r.zones.includes("outer")).every((r) => r.fill === "laal")).toBe(true);
  });
});

describe("parseFillPhrase", () => {
  it("beech mein peela, bahar laal", () => {
    const r = parseFillPhrase("beech mein peela, bahar laal");
    expect(r.fills.map(({ zone, colour }) => ({ zone, colour }))).toEqual([
      { zone: "center", colour: "peela" },
      { zone: "outer", colour: "laal" },
    ]);
    expect(r.unresolved).toEqual([]);
  });

  it("Devanagari, Tamil, Punjabi, English", () => {
    const pairs = (t: string) => parseFillPhrase(t).fills.map((f) => `${f.zone}:${f.colour}`);
    expect(pairs("बीच में पीला और बाहर लाल")).toEqual(["center:peela", "outer:laal"]);
    expect(pairs("andar wala hara")).toEqual(["center:hara"]);
    expect(pairs("நடுவில் மஞ்சள்")).toEqual(["center:peela"]);
    expect(pairs("நடுவில் மஞ்சள், வெளியே சிவப்பு")).toEqual(["center:peela", "outer:laal"]);
    expect(pairs("ਵਿਚਕਾਰ ਪੀਲਾ ਤੇ ਬਾਹਰ ਲਾਲ")).toEqual(["center:peela", "outer:laal"]);
    expect(pairs("make the middle yellow and the outside red")).toEqual(["center:peela", "outer:laal"]);
    expect(pairs("सफ़ेद किनारा")).toEqual(["border:safed"]);
    expect(pairs("doosra ghera neela, kinare kesariya")).toEqual(["ring-2:neela", "border:kesariya"]);
    expect(pairs("ring 3 gulabi")).toEqual(["ring-3:gulabi"]);
    expect(pairs("teesri pankhudi jamuni")).toEqual(["petal-3:jamuni"]);
    expect(pairs("beech peela bahar laal")).toEqual(["center:peela", "outer:laal"]);
    expect(pairs("beech aur kinara dono hara")).toEqual(["center:hara", "border:hara"]);
  });

  it("never guesses: unresolved parts come back explicitly", () => {
    const r = parseFillPhrase("beech mein, laal, golden wala bahar");
    expect(r.fills).toEqual([]);
    expect(r.unresolved.map((u) => u.reason)).toEqual(["colour-missing", "zone-missing", "colour-missing"]);
    expect(r.unresolved[2].unknownWords).toEqual(["golden"]);
    const amb = parseFillPhrase("ghera laal");
    expect(amb.fills).toEqual([]);
    expect(amb.unresolved[0].reason).toBe("ambiguous");
  });

  it("canonical zones and colours", () => {
    expect(canonicalZone("beech")).toBe("center");
    expect(canonicalZone("kinara")).toBe("border");
    expect(canonicalZone("bahar")).toBe("outer");
    expect(canonicalZone("ring-2")).toBe("ring-2");
    expect(canonicalZone("दूसरा घेरा")).toBe("ring-2");
    expect(canonicalZone("something")).toBeUndefined();
    expect(resolveColour("लाल")).toBe("laal");
    expect(resolveColour("Orange")).toBe("kesariya");
    expect(resolveColour("ਚਿੱਟਾ")).toBe("safed");
  });
});

describe("describe / suggest / validate", () => {
  it("alt text", () => {
    const d = generateDesign({ kind: "pulli", grid: 5, symmetry: "4-fold" });
    expect(d.altHi).toBe("5×5 बिंदुओं का पुल्ली कोलम, एक ही रेखा, 4-गुना समरूपता");
    expect(d.altEn).toBe("5×5 pulli kolam, single line, 4-fold symmetry");
    expect(describeDesign(d).en).toBe(d.altEn);
    expect(d.svg).toContain(`<title>${d.altEn}</title>`);
  });

  it("suggestions are valid params with labels", () => {
    for (const ctx of [{}, { small: true }, { festival: "diwali" }, { festival: "pongal", small: true }]) {
      const s = suggestDesigns(ctx);
      expect(s.length).toBeGreaterThanOrEqual(2);
      expect(s.length).toBeLessThanOrEqual(3);
      for (const x of s) {
        expect(x.labelHi.length).toBeGreaterThan(0);
        expect(x.labelEn.length).toBeGreaterThan(0);
        expect(generateDesign(x.params).validation.valid).toBe(true);
      }
    }
    // no festival → no preset palette baked in
    expect(suggestDesigns().every((s) => !("palette" in s.params) || s.params.palette === undefined)).toBe(true);
  });

  it("validation catches broken designs", () => {
    const d = generateDesign({ kind: "rangoli", template: "radial", rings: 3, motifs: ["lotus"], petals: 8 });
    const dup = { ...d, regions: [...d.regions, d.regions[0]] };
    expect(validateDesign(dup).checks.find((c) => c.id === "region-ids-unique")?.ok).toBe(false);
    const open = { ...d, regions: d.regions.map((r, i) => (i === 0 ? { ...r, d: r.d.replace(/Z/g, "") } : r)) };
    expect(validateDesign(open).checks.find((c) => c.id === "curves-closed")?.ok).toBe(false);
    const badColour = { ...d, regions: d.regions.map((r, i) => (i === 0 ? { ...r, fill: "golden" as never } : r)) };
    expect(validateDesign(badColour).checks.find((c) => c.id === "palette-known")?.ok).toBe(false);
    // break symmetry: move one petal
    const moved = {
      ...d,
      regions: d.regions.map((r) => (r.id === "ring-1-petal-1" ? { ...r, d: r.d.replace(/(\d+\.?\d*) /, (m, n) => `${Number(n) + 9} `) } : r)),
    };
    expect(validateDesign(moved).checks.find((c) => c.id === "symmetry-geometry")?.ok).toBe(false);
    const p = generateDesign({ kind: "pulli", grid: 5, symmetry: "4-fold" });
    const asym = { ...p, meta: { ...p.meta, mirrors: [...(p.meta.mirrors ?? []), "2,1"].filter((v, i, a) => a.indexOf(v) === i) } };
    if (!(p.meta.mirrors ?? []).includes("2,1")) expect(validateDesign(asym).checks.find((c) => c.id === "symmetry-mirrors")?.ok).toBe(false);
  });
});
