#!/usr/bin/env python3
"""Every number the film shows or says, read from the repo at build time. Nothing is typed by hand except the three
sourced public statistics, which carry their source next to them (EVIDENCE.md has the quotes).

  python3 video/facts.py            -> video/data/facts.json (+ prints what is still pending)

Sources:
  eval      evals/results/summary.json (status "ready"; built by scripts/build-results.mjs from
            evals/iterations/iteration-*/benchmark.json + manifest.json)
  sync      evals/measure/sync-latency.deployed.json, else evals/measure/sync-latency.json (elder -> family p50/p95)
  ocr       evals/render-accuracy/results.json (exact match, shaped vs unshaped text; never "image model")
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "data" / "facts.json"

# Public statistics, verified 2026-11-09 (EVIDENCE.md / .chaupal-work/research/evidence.md).
PUBLIC = {
    "elderShare2022": {"value": 10.5, "unit": "%", "source": "UNFPA India Ageing Report 2023"},
    "elderShare2050": {"value": 20.8, "unit": "%", "source": "UNFPA India Ageing Report 2023"},
    "livingAlone": {"value": 5.7, "unit": "%", "source": "LASI Wave 1 (2017-18), Table 5.3"},
    "digitalConfusing": {"value": 66, "unit": "%", "source": "HelpAge India, June 2025 (10-city survey)"},
}


def read(p):
    p = ROOT / p
    return json.loads(p.read_text()) if p.exists() else None


def fmt_s(ms):
    return round(ms / 1000, 2)


def main():
    pending = []
    facts = {"public": PUBLIC}

    s = read("evals/results/summary.json")
    if s and s.get("status") == "ready":
        c, k = s["control"], s["candidate"]
        facts["eval"] = {
            "ready": True,
            "cases": s.get("cases"), "reps": s.get("repetitions"), "model": s.get("model"),
            "A": {"passed": c["passed"], "runs": c["runs"], "rate": c["rate"], "tokens": c["tokens"], "seconds": c["seconds"], "label": c["label"]},
            "B": {"passed": k["passed"], "runs": k["runs"], "rate": k["rate"], "tokens": k["tokens"], "seconds": k["seconds"], "label": k["label"]},
            "better": k["passed"] > c["passed"],
            "failures": s.get("failures") or [],
            "source": "evals/results/summary.json (" + str(c.get("iteration")) + " vs " + str(k.get("iteration")) + ")",
        }
    else:
        facts["eval"] = {"ready": False, "source": "evals/results/summary.json is pending"}
        pending.append("eval (evals/results/summary.json status != ready)")

    # family sync: the end-to-end time from her move request to the other screen, measured on the DEPLOYED app
    sync = None
    d = read("evals/measure/sync-latency.deployed.json")
    if d:
        a = d.get("all") or {}
        p50 = a.get("fromRequestP50Ms", d.get("fromRequestP50Ms"))
        p95 = a.get("fromRequestP95Ms", d.get("fromRequestP95Ms"))
        if p50 is not None:
            sync = {"p50": fmt_s(p50), "p95": fmt_s(p95), "moves": a.get("moves", d.get("n")), "where": "deployed",
                    "what": "from the move request to the other screen", "source": "evals/measure/sync-latency.deployed.json", "measuredAt": d.get("measuredAt")}
    if not sync:
        d = read("evals/measure/sync-latency.json")
        if d:
            e = d.get("elderToFamily") or d.get("all") or d
            sync = {"p50": fmt_s(e.get("p50Ms")), "p95": fmt_s(e.get("p95Ms")), "moves": e.get("moves"), "where": "local",
                    "source": "evals/measure/sync-latency.json", "measuredAt": d.get("measuredAt")}
    facts["sync"] = sync or {"ready": False}
    if not sync:
        pending.append("sync latency")
    elif sync["where"] != "deployed":
        pending.append("sync latency is the local measurement (no sync-latency.deployed.json yet)")

    ra = read("evals/render-accuracy/results.json")
    if ra:
        t = ra["totals"]
        per = {x["script"]: x["arms"] for x in ra["summary"]}
        facts["ocr"] = {
            "n": t["shaped"]["n"],
            "shaped": t["shaped"]["exact"], "unshaped": t["unshaped"]["exact"],
            "shapedPlain": t["shaped-plain"]["exact"], "unshapedPlain": t["unshaped-plain"]["exact"],
            "cerShaped": t["shaped"]["meanCer"], "cerUnshaped": t["unshaped"]["meanCer"],
            "urduShaped": per.get("urdu", {}).get("shaped", {}).get("exact"),
            "urduN": per.get("urdu", {}).get("shaped", {}).get("n"),
            "measuredAt": ra.get("measuredAt"),
            "source": "evals/render-accuracy/results.json",
        }
    else:
        pending.append("render accuracy")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    facts["pending"] = pending
    OUT.write_text(json.dumps(facts, indent=1, ensure_ascii=False) + "\n")
    print("facts ->", OUT)
    for p in pending:
        print("  PENDING:", p)


if __name__ == "__main__":
    main()
