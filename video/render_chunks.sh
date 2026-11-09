#!/usr/bin/env bash
# Renders the film picture as JPEG frames in chunks (resumable, low memory), then encodes once with ffmpeg at the
# master settings. TMPDIR points at the work disk: Remotion's temp files in /tmp (a small RAM disk) broke the encoder.
#   video/render_chunks.sh [chunk_frames]     -> /home/prashant/projects/.chaupal-work/film/out/film-pic.mp4
set -uo pipefail
cd "$(dirname "$0")/film"
export TMPDIR=/home/prashant/projects/.chaupal-work/film/tmp
OUT=/home/prashant/projects/.chaupal-work/film/out
FR=/home/prashant/projects/.chaupal-work/film/frames
mkdir -p "$FR" "$TMPDIR"
N=${1:-600}
TOTAL=$(python3 -c "import json;d=json.load(open('film.json'));print(sum(round(s['duration']*d['fps']) for s in d['scenes']))")
# Remotion names a sequence by absolute frame with a width that depends on the range, so each chunk renders into its
# own folder and is renamed to frame-NNNNN.jpeg in one folder for the encode.
normalise() { for f in "$1"/element-*.jpeg; do [ -e "$f" ] || continue; k=$(basename "$f" .jpeg); k=$((10#${k#element-})); mv "$f" "$(printf "%s/frame-%05d.jpeg" "$FR" $k)"; done; }
normalise "$FR"  # frames left by an earlier run
for ((a=0; a<TOTAL; a+=N)); do
  b=$((a+N-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  last=$(printf "%s/frame-%05d.jpeg" "$FR" $b)
  for try in 1 2 3; do
    [ -s "$last" ] && break
    echo "chunk $a-$b (try $try)"
    rm -rf "$FR/tmp_chunk"; mkdir -p "$FR/tmp_chunk"
    npx remotion render src/index.ts Film "$FR/tmp_chunk" --sequence --frames=$a-$b --image-format=jpeg --jpeg-quality=95 --concurrency=2 --log=error
    normalise "$FR/tmp_chunk"
  done
  [ -s "$last" ] || { echo "chunk $a failed"; exit 1; }
done
n=$(ls "$FR"/frame-*.jpeg | wc -l); echo "frames: $n of $TOTAL"
ffmpeg -y -v error -framerate 30 -i "$FR/frame-%05d.jpeg" -vf "scale=1920:1080:in_color_matrix=bt601:out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709" \
  -c:v libx264 -crf 16 -preset slow -tune film -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart "$OUT/film-pic.part.mp4" \
  && mv "$OUT/film-pic.part.mp4" "$OUT/film-pic.mp4" && echo "joined -> $OUT/film-pic.mp4 ($n frames)"
