#!/usr/bin/env python3
"""Print a compact view of one run directory (staging, canary/pilot or iteration)."""
import json, os, sys
run = sys.argv[1]
only = sys.argv[2:] 
raw = os.path.join(run, "raw-api")
if not os.path.isdir(raw):
    st = json.load(open(os.path.join(run, ".run-state.json"))) if os.path.exists(os.path.join(run, ".run-state.json")) else None
    raw = os.path.join(os.path.dirname(os.path.dirname(run)), st["rawRunRoot"]) if st else None
for case in sorted(c for c in os.listdir(os.path.join(run, "cases")) if not c.startswith(".")):
    if only and case not in only: continue
    for rep in sorted(os.listdir(os.path.join(run, "cases", case))):
        base = os.path.join(run, "cases", case, rep)
        print(f"===== {case}/{rep}")
        priv = os.path.join(raw, "private", case, rep) if raw else None
        if priv and os.path.exists(os.path.join(priv, "tool-trace.json")):
            for e in json.load(open(os.path.join(priv, "tool-trace.json"))):
                sc = e.get("structuredContent") or {}
                inter = (sc.get("interaction") or {}).get("targetTestId") if isinstance(sc, dict) else None
                print("  call", e["tool"], "ok" if e["success"] else f"FAIL {e['errorCode']}", round(e["durationMs"]), json.dumps(e["input"], ensure_ascii=False)[:110], inter or "")
            for e in json.load(open(os.path.join(priv, "transcript.json"))):
                print("  ", e["role"][:4], e["kind"][:6], e["text"].replace("\n", " ")[:260])
        g = os.path.join(base, "grading.json")
        if os.path.exists(g):
            g = json.load(open(g))
            for a in g["assertionResults"]:
                print("  ", "PASS" if a["passed"] else "FAIL", a["id"], "" if a["passed"] else a["observation"][:240], json.dumps(a.get("details",""),ensure_ascii=False)[:200] if not a["passed"] else "")
            print("   fixture:", [f["action"] for f in g["fixtureTrace"]])
        t = json.load(open(os.path.join(base, "timing.json")))["agent"]
        print("   tokens", t["usage"]["total"], "wall", round(t["wallTimeMs"]/1000,1), "turns", t["turns"], "timedOut", t["timedOut"])
