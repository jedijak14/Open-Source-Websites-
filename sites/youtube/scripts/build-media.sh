#!/usr/bin/env bash
# Regenerates the demo media for the OpenTube clone.
#
# Requires: ffmpeg on PATH (with libx264 + the `gradients` filter).
# Source photography for the thumbnails lives in assets/thumbs/*.jpg; this
# script normalises those to 1280x720, derives a few alternate crops, and
# synthesises short ambient MP4 clips so the player works fully offline.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FF="${FFMPEG:-ffmpeg}"
THUMBS="$ROOT/assets/thumbs"
VIDEO="$ROOT/assets/video"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$VIDEO"

# ---------------------------------------------------------------- thumbnails
# 1280x720 JPEGs at ~q:v 3, plus alternate crops used by secondary videos.
normalize() {
  local src="$1" out="$2" crop="${3:-1280:720:0:0}"
  "$FF" -hide_banner -loglevel error -y -i "$src" \
    -vf "crop=${crop},scale=1280:720:flags=lanczos,eq=contrast=1.02:saturation=1.04" \
    -q:v 3 "$out"
}

declare -A BASE=(
  [build-compiler]=build-compiler.jpg
  [synth-restore]=synth-restore.jpg
  [kyoto-dusk]=kyoto-dusk.jpg
  [deep-sea]=deep-sea.jpg
  [sourdough]=sourdough.jpg
  [lofi-room]=lofi-room.jpg
  [marathon]=marathon.jpg
  [speedrun-crt]=speedrun-crt.jpg
  [rocket-launch]=rocket-launch.jpg
  [keyboard-build]=keyboard-build.jpg
)

for key in "${!BASE[@]}"; do
  src="$WORK/${BASE[$key]}"
  # normalise the generated art to a clean 16:9 frame first
  "$FF" -hide_banner -loglevel error -y -i "$THUMBS/${BASE[$key]}" \
    -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720" \
    -q:v 3 "$src"
  cp "$src" "$THUMBS/$key.jpg"
done

# alternate framings (different crop + grade) so reused thumbnails still read
# as distinct shots
alt() { # name src crop eq
  "$FF" -hide_banner -loglevel error -y -i "$WORK/$2" \
    -vf "crop=$3,scale=1280:720:flags=lanczos,eq=$4" -q:v 3 "$THUMBS/$1.jpg"
}
alt build-compiler-b build-compiler.jpg 1050:591:180:90 "contrast=1.05:saturation=1.12:brightness=0.01"
alt synth-restore-b  synth-restore.jpg  1000:563:250:120 "contrast=1.04:saturation=0.92:gamma=1.03"
alt kyoto-dusk-b     kyoto-dusk.jpg     1020:574:120:80 "contrast=1.03:saturation=1.1"
alt deep-sea-b       deep-sea.jpg       980:551:300:60 "contrast=1.08:saturation=1.18"
alt sourdough-b      sourdough.jpg      1040:585:120:70 "contrast=1.03:saturation=1.02:brightness=0.02"
alt marathon-b       marathon.jpg       1080:608:200:60 "contrast=1.05:saturation=1.06"
alt speedrun-crt-b   speedrun-crt.jpg   1000:563:200:100 "contrast=1.06:saturation=1.14"
alt rocket-launch-b  rocket-launch.jpg  1010:568:230:80 "contrast=1.04:saturation=1.08"

# ---------------------------------------------------------------- clips
# id | duration (s) | gradient palette | chord
make_clip() {
  local id="$1" dur="$2" c0="$3" c1="$4" c2="$5" c3="$6" f1="$7" f2="$8" f3="$9"
  local fade_start=$(( dur - 2 ))
  "$FF" -hide_banner -loglevel error -y \
    -f lavfi -i "gradients=s=1280x720:c0=${c0}:c1=${c1}:c2=${c2}:c3=${c3}:x0=0:y0=0:x1=1280:y1=720:n=4:speed=0.012:d=${dur}:r=24" \
    -f lavfi -i "sine=frequency=${f1}:sample_rate=44100:duration=${dur}" \
    -f lavfi -i "sine=frequency=${f2}:sample_rate=44100:duration=${dur}" \
    -f lavfi -i "sine=frequency=${f3}:sample_rate=44100:duration=${dur}" \
    -filter_complex "[0:v]vignette=PI/4.5,fps=24,format=yuv420p[v];[1:a][2:a][3:a]amix=inputs=3:duration=shortest,volume=0.10,afade=t=in:d=1.5,afade=t=out:st=${fade_start}:d=2[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 33 -g 48 \
    -movflags +faststart -c:a aac -b:a 56k -ac 1 "$VIDEO/$id.mp4"
  echo "built $id.mp4"
}

make_clip code     96  0x0a1a3c 0x1f4fff 0x7b2ff7 0x05060a 196 246.94 293.66 &
make_clip amber    143 0x1a0e05 0xff8a00 0xffc46b 0x120800 174.61 220 261.63 &
make_clip teal     74  0x04121a 0x0e6b6b 0x39d0c0 0x020708 130.81 196 246.94 &
make_clip indigo   188 0x050a1f 0x1e2b7a 0x6f5cff 0x02030a 110 164.81 220 &
make_clip rose     121 0x1a0a14 0x8a2a5a 0xff7a9c 0x0b0509 146.83 220 293.66 &
make_clip street   64  0x1a0806 0xb52a10 0xffa23a 0x0d0403 98 146.83 196 &
wait

echo "media written to $THUMBS and $VIDEO"
