#!/usr/bin/env python3
"""List failing sessions of an official iteration with failed assertions, tool calls and replies."""
import glob, json, os, sys
it = sys.argv[1]
root = f"/home/prashant/projects/Chaupal/evals/iterations/{it}"
raw = sorted(glob.glob(f"/home/prashant/projects/Chaupal/evals/.raw/{it}-*"))[-1]
for case in sorted(os.listdir(f"{root}/cases")):
    for rep in sorted(os.listdir(f"{root}/cases/{case}")):
        g = json.load(open(f"{root}/cases/{case}/{rep}/grading.json"))
        if g["passed"]: continue
        print(f"===== {case}/{rep}")
        for a in g["assertionResults"]:
            if not a["passed"]: print("  FAIL", a["id"], a["observation"][:200], json.dumps(a.get("details", ""), ensure_ascii=False)[:160])
        for e in json.load(open(f"{raw}/private/{case}/{rep}/tool-trace.json")):
            print("   call", e["tool"], "ok" if e["success"] else "FAIL " + str(e["errorCode"]), json.dumps(e["input"], ensure_ascii=False)[:120])
        for e in json.load(open(f"{raw}/private/{case}/{rep}/transcript.json")):
            if e["role"] == "assistant" or e["kind"] != "initial": print("  ", e["role"][:4], e["kind"][:6], e["text"].replace("\n", " ")[:240])
        print("   fixture", [f["action"] for f in g["fixtureTrace"]], "timeout" if not g["executionCompleted"] else "")
