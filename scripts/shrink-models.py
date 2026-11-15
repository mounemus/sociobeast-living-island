#!/usr/bin/env python3
"""Shrinks the textures embedded in the game's .glb models (web/assets/models), in place.

The generated models carry 2K-4K textures that make up most of each file. This resizes every embedded image so its
longest side is at most MAX pixels and re-encodes it (JPEG when it has no transparency, PNG otherwise). Geometry,
skeleton and animations are copied byte for byte. A file that would not get smaller is left alone.

    python scripts/shrink-models.py                 report only, changes nothing
    python scripts/shrink-models.py --write         rewrite the files
    python scripts/shrink-models.py --write --max 1024 web/assets/models/city-*.glb

Needs Pillow. Run it again after adding models; already small files are skipped.
"""
import argparse, glob, io, json, os, struct, sys
from PIL import Image

def read_glb(path):
    with open(path, 'rb') as f: data = f.read()
    magic, version, length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and version == 2, 'not a glTF 2 binary'
    off, chunks = 12, []
    while off < length:
        n, kind = struct.unpack_from('<I4s', data, off); chunks.append((kind, data[off + 8: off + 8 + n])); off += 8 + n
    assert chunks[0][0] == b'JSON', 'first chunk is not JSON'
    return json.loads(chunks[0][1]), (chunks[1][1] if len(chunks) > 1 else b''), len(data)

def shrink_image(raw, limit, quality):
    im = Image.open(io.BytesIO(raw)); im.load()
    alpha = im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getextrema()[3][0] < 255
    if max(im.size) > limit: im = im.resize([max(1, round(s * limit / max(im.size))) for s in im.size], Image.LANCZOS)
    out = io.BytesIO()
    if alpha: im.convert('RGBA').save(out, 'PNG', optimize=True); mime = 'image/png'
    else: im.convert('RGB').save(out, 'JPEG', quality=quality, optimize=True, progressive=True); mime = 'image/jpeg'
    return out.getvalue(), mime, im.size

def shrink(path, limit, quality, write):
    gltf, bin_, before = read_glb(path)
    views = gltf.get('bufferViews', [])
    assert len(gltf.get('buffers', [])) <= 1 and all(v.get('buffer', 0) == 0 for v in views), 'more than one buffer'
    blobs = [bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in views]
    sizes = []
    for img in gltf.get('images', []):
        if 'bufferView' not in img: continue  # an external file: not ours to touch
        raw = blobs[img['bufferView']]
        new, mime, size = shrink_image(raw, limit, quality)
        sizes.append(size)
        if len(new) < len(raw): blobs[img['bufferView']] = new; img['mimeType'] = mime
    out, pos = bytearray(), 0  # rebuild the buffer: every view copied whole, 4-byte aligned
    for v, b in zip(views, blobs):
        out += b'\0' * ((-len(out)) % 4); v['byteOffset'] = len(out); v['byteLength'] = len(b); out += b
    out += b'\0' * ((-len(out)) % 4)
    if gltf.get('buffers'): gltf['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8'); js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + (8 + len(out) if out else 0)
    if write and total < before:
        tmp = path + '.tmp'
        with open(tmp, 'wb') as f:
            f.write(struct.pack('<4sII', b'glTF', 2, total)); f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
            if out: f.write(struct.pack('<I4s', len(out), b'BIN\0')); f.write(out)
        read_glb(tmp)  # it must read back before it replaces the original
        os.replace(tmp, path)
    return before, min(total, before), sizes

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('files', nargs='*'); ap.add_argument('--write', action='store_true')
    ap.add_argument('--max', type=int, default=1024, help='longest side of a texture, in pixels (default 1024)')
    ap.add_argument('--quality', type=int, default=82, help='JPEG quality (default 82)')
    a = ap.parse_args()
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'assets', 'models', '*.glb')
    files = sorted(f for pat in (a.files or [here]) for f in glob.glob(pat))
    tb = ta = 0
    for f in files:
        try: b, n, sizes = shrink(f, a.max, a.quality, a.write)
        except Exception as e: print('SKIPPED %s: %s' % (os.path.basename(f), e)); continue
        tb += b; ta += n
        print('%-26s %6.2f MB -> %5.2f MB   textures %s' % (os.path.basename(f), b / 1048576, n / 1048576, ' '.join('%dx%d' % s for s in sizes) or 'none'))
    print('%d files: %.1f MB -> %.1f MB%s' % (len(files), tb / 1048576, ta / 1048576, '' if a.write else '   (report only, add --write)'))
