#!/bin/bash
# stills.sh <slug> [times] : 9 stills of one style tiled into out/<slug>-sheet.png
ROOT=${MG_ROOT:?set MG_ROOT to your mg-styles-15 clone}
D=$ROOT/demos/40-attention-styles
SLUG=$1; TIMES=${2:-0.4,1.6,2.6,3.6,4.3,5.4,6.2,7.9,9.5}
cd $ROOT && rm -rf $D/out/stills-$SLUG && MG_GPU_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader --no-sandbox" MG_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome timeout 300 node harness/render.mjs demos/40-attention-styles --query style=$SLUG --stills $TIMES 2>&1 | grep -iE "error|exception" | head -5
mv $D/out/stills $D/out/stills-$SLUG 2>/dev/null
ffmpeg -v error -y -pattern_type glob -i "$D/out/stills-$SLUG/t*.png" -vf "scale=640:-1,tile=3x3:padding=4:color=gray" $D/out/$SLUG-sheet.png && echo "sheet $D/out/$SLUG-sheet.png"
