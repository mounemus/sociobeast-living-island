#!/usr/bin/env bash
# Makes the game's models light to download. Run it after adding or regenerating a .glb.
#   1. textures down to 1024 px, re-encoded          (scripts/shrink-models.py, needs Python + Pillow)
#   2. geometry compressed with Draco                 (gltf-transform through npx, needs Node)
# A generated model goes from about 7 MB to about 0.6 MB. Files already compressed are skipped.
# The page reads them with THREE.DRACOLoader (see loader() in web/assets/creature.js).
#
#   bash scripts/shrink-models.sh                       every model of web/assets/models
#   bash scripts/shrink-models.sh web/assets/models/city-bloom.glb
set -e
cd "$(dirname "$0")/.."
files=("$@"); [ ${#files[@]} -eq 0 ] && files=(web/assets/models/*.glb)
python scripts/shrink-models.py --write "${files[@]}"
work=$(mktemp -d)   # gltf-transform writes here first: the original is replaced only by a file that was written whole
for f in "${files[@]}"; do
  if python -c "import json,struct,sys; d=open(sys.argv[1],'rb').read(); n=struct.unpack_from('<I',d,12)[0]; sys.exit(0 if 'KHR_draco_mesh_compression' in json.loads(d[20:20+n]).get('extensionsUsed',[]) else 1)" "$f"; then continue; fi
  out="$work/$(basename "$f")"
  npx --yes @gltf-transform/cli@4 draco "$f" "$out" > /dev/null
  cp "$out" "$f"; echo "draco: $(basename "$f") $(du -k "$f" | cut -f1) KB"
done
echo "done"
