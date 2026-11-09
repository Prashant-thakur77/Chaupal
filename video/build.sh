#!/usr/bin/env bash
# Rebuilds the Chaupal film from the repo's own files. Nothing is typed by hand: numbers come from facts.py,
# timing from the voice, product shots from capture_film.mjs.
#
#   video/build.sh                   numbers, voice, timeline, film.json, sound, picture, final files, checks
#   video/build.sh --capture [ids]   first re-record product shots from the deployed app (hero,sulekh,rangoli,guard)
#   video/build.sh --draft           half-size picture only (out/draft.mp4)
#   video/build.sh --no-render       stop before the picture (check words, timing, sound)
# Machine limits: Remotion runs at --concurrency=2; never capture and render at the same time.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
WORK=/home/prashant/projects/.chaupal-work/film
PY="${FILM_PY:-$HOME/.pyenv/versions/3.10.13/bin/python}"
export TMPDIR="$WORK/tmp"
mkdir -p "$TMPDIR" "$WORK/out" "$WORK/audio" "$WORK/narration"
cd "$ROOT"

CAPTURE="" ; DRAFT="" ; NORENDER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --capture) CAPTURE="hero,sulekh,rangoli,guard"; if [ $# -gt 1 ] && [ "${2#--}" = "$2" ]; then CAPTURE="$2"; shift; fi ;;
    --draft) DRAFT=1 ;;
    --no-render) NORENDER=1 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
step() { printf '\n== %s\n' "$*"; }

if [ -n "$CAPTURE" ]; then step "capture: $CAPTURE"; node video/capture_film.mjs --only "$CAPTURE"; fi

step "numbers and words"
python3 video/facts.py
python3 video/narration.py

step "voice (cached: only changed lines are voiced)"
"$PY" video/tools/tts_takes.py video/narration.json --seeds 3 --out video/narration/takes > "$WORK/narration/tts.log" 2>&1 || { tail -5 "$WORK/narration/tts.log"; exit 1; }
grep -E 'below|flag' "$WORK/narration/tts.log" || true

step "footage"
python3 video/make_footage.py

step "timeline and captions"
python3 video/make_film.py --skeleton
"$PY" video/tools/vo_timeline.py video/narration.json video/narration/takes --film video/film/film.json --out video/narration | tail -1
"$PY" video/tools/captions.py video/narration/vo_full.wav video/narration/script.txt --out video/film/public/captions | tail -1
cp video/film/public/captions/film.srt "$WORK/out/film.srt"

step "the film as data"
python3 video/make_film.py
python3 video/demo_script.py

step "sound"
"$PY" video/make_audio.py
(cd "$WORK/audio" && "$PY" "$HERE/tools/mix.py" "$HERE/mix.json")

[ -n "$NORENDER" ] && { echo "stopped before the picture, as asked"; exit 0; }

step "picture"
cd video/film
if [ -n "$DRAFT" ]; then
  npx remotion render src/index.ts Film out/draft-pic.mp4 --scale=0.5 --crf=24 --concurrency=2 --log=error --pixel-format=yuv420p --color-space=bt709
  ffmpeg -y -v error -i out/draft-pic.mp4 -i "$WORK/audio/master.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart out/draft.mp4
  echo "draft: $WORK/out/draft.mp4"; exit 0
fi
cd "$HERE" && ./render_chunks.sh 600 && cd film
npx remotion still src/index.ts Thumbnail out/thumbnail.png --log=error
cd "$ROOT"

step "final files"
ffmpeg -y -v error -i "$WORK/out/film-pic.mp4" -i "$WORK/audio/master.wav" -map 0:v -map 1:a -c:v copy -af "volume=-0.35dB" -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$WORK/out/chaupal-film.part.mp4"
mv "$WORK/out/chaupal-film.part.mp4" "$WORK/out/chaupal-film-1080p.mp4"
ffmpeg -y -v error -i "$WORK/out/chaupal-film-1080p.mp4" -vf "scale=-2:720:flags=lanczos,format=yuv420p" -c:v libx264 -crf 27 -preset slow -c:a aac -b:a 128k -movflags +faststart "$WORK/out/chaupal-film-720p.part.mp4"
mv "$WORK/out/chaupal-film-720p.part.mp4" "$WORK/out/chaupal-film-720p.mp4"

step "checks"
mkdir -p "$WORK/out/qa"
"$PY" video/tools/qa_video.py "$WORK/out/chaupal-film-1080p.mp4" --scenes video/film/film.json --vo video/narration/vo_full.wav --sheet "$WORK/out/qa" | tee "$WORK/out/qa/report.txt" || true
ls -la "$WORK/out"
