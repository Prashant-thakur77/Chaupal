// After `NITRO_PRESET=cloudflare_module pnpm build`: give the Worker the
// pre-compiled WebAssembly it needs (HarfBuzz for Sulekh shaping, resvg for
// family-update pictures; Workers cannot compile wasm at runtime), a small
// entry that hands those modules to the engines, and Chaupal's name and domain.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, ".output", "server");
const domain = process.env.CHAUPAL_DOMAIN || "chaupal.prashantthakur.dev";

mkdirSync(join(out, "wasm"), { recursive: true });
copyFileSync(join(root, "node_modules/harfbuzzjs/dist/harfbuzz.wasm"), join(out, "wasm/harfbuzz.wasm"));
copyFileSync(join(root, "node_modules/@resvg/resvg-wasm/index_bg.wasm"), join(out, "wasm/resvg.wasm"));

writeFileSync(
  join(out, "chaupal-entry.mjs"),
  `import harfbuzz from "./wasm/harfbuzz.wasm";
import resvg from "./wasm/resvg.wasm";
globalThis.__CHAUPAL_HB_WASM__ = harfbuzz;
globalThis.__CHAUPAL_RESVG_WASM__ = resvg;
export * from "./worker.mjs";
export { default } from "./worker.mjs";
`,
);

// The generated worker.mjs imports one framework module by package name,
// which an unbundled Worker cannot resolve. It is self-contained and keeps
// its state on a global Symbol.for key, so a vendored copy shares it.
mkdirSync(join(out, "_vendor"), { recursive: true });
copyFileSync(
  join(root, "node_modules/@agent-native/core/dist/db/request-pool-context.js"),
  join(out, "_vendor/request-pool-context.mjs"),
);
const workerPath = join(out, "worker.mjs");
writeFileSync(
  workerPath,
  readFileSync(workerPath, "utf8").replace(
    '"@agent-native/core/db/request-pool-context"',
    '"./_vendor/request-pool-context.mjs"',
  ),
);

const cfgPath = join(out, "wrangler.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
cfg.name = "chaupal";
cfg.main = "chaupal-entry.mjs";
if (!(cfg.rules ?? []).some((r) => r.type === "CompiledWasm")) {
  cfg.rules = [...(cfg.rules ?? []), { type: "CompiledWasm", globs: ["**/*.wasm"] }];
}
cfg.routes = [{ pattern: domain, custom_domain: true }];
cfg.vars = {
  ...(cfg.vars ?? {}),
  CHAUPAL_PUBLIC_URL: `https://${domain}`,
  BETTER_AUTH_URL: `https://${domain}`,
  AGENT_ENGINE: "anthropic",
  AGENT_MODEL: "claude-sonnet-5-5",
};
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log(`[chaupal] Worker entry, wasm modules and ${domain} added`);
