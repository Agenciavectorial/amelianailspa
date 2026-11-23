#!/usr/bin/env bash
# Graba y arma todos los videos (borradores con --borrador). Uso: bash dev/video/todo.sh [--borrador]
set -e
cd "$(dirname "$0")/../.."
B="$1"
node dev/video/grabar.mjs erika && node dev/video/armar.mjs erika $B
for c in Leidy Karla Julieth Daily; do
  node dev/video/grabar.mjs chicas --chica $c && node dev/video/armar.mjs chicas --chica $c $B
done
node dev/video/grabar.mjs pagina && node dev/video/armar.mjs pagina $B && node dev/video/armar.mjs pagina --horizontal $B
node dev/video/publicar.mjs
