#!/bin/bash
# grid.sh : the 15 films in a 5x3 grid (1920x1080), each labelled; silent (each film has its own soundtrack).
ROOT=${MG_ROOT:?set MG_ROOT to your mg-styles-15 clone}
F=$ROOT/demos/40-attention-styles/out/films
FONT=$ROOT/assets/fonts/latin/inter/Inter-VF.ttf
cp $ROOT/demos/30-attention-line/out/video.mp4 $F/02-line-art.mp4
ORDER="01-flat-vector:Flat Vector 02-line-art:Line Art 03-isometric:Isometric 04-3d-render:3D Render 05-cel-boil:Cel Boil 06-collage:Collage 07-liquid:Liquid 08-morph:Shape Morph 09-bauhaus:Bauhaus 10-synthwave:Synthwave 12-aurora-glass:Aurora Glass 18-hanazi:Variety Captions 19-paperclip:Sticker Explainer 20-pixel:Pixel Art 22-hud:HUD"
IN=(); FILT=""; k=0
IFS=$'\n'; for pair in $(echo "$ORDER" | sed 's/ \([0-9][0-9]-\)/\n\1/g'); do
  slug=${pair%%:*}; name=${pair#*:}
  IN+=(-i "$F/$slug.mp4")
  FILT+="[$k:v]scale=384:216,drawbox=x=0:y=180:w=384:h=36:color=black@0.55:t=fill,drawtext=fontfile=$FONT:text='$name':fontcolor=white:fontsize=20:x=10:y=188[v$k];"
  k=$((k+1))
done; unset IFS
LAYOUT=""; for r in 0 1 2; do for c in 0 1 2 3 4; do LAYOUT+="$((c*384))_$((r*216))|"; done; done
STACK=""; for i in $(seq 0 14); do STACK+="[v$i]"; done
ffmpeg -v error -y "${IN[@]}" -filter_complex "${FILT}${STACK}xstack=inputs=15:layout=${LAYOUT%|}[out]" -map "[out]" -c:v libx264 -crf 18 -pix_fmt yuv420p -r 30 -t 10 $F/all-15-styles-grid.mp4 && echo "grid → $F/all-15-styles-grid.mp4"
