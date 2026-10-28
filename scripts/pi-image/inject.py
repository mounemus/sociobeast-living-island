"""Inject SocioBeast into a PRISTINE Raspberry Pi OS image: files go on the FAT32 boot partition (no ext4 writing needed),
firstrun.sh installs everything offline at first boot via the kernel cmdline systemd.run hook.
Always start from a freshly decompressed image: pyfatfs cannot safely overwrite or delete existing files."""
import struct, sys, os
from pyfatfs.PyFatFS import PyFatFS

img = sys.argv[1]
with open(img, 'rb') as f:
    mbr = f.read(512)
assert mbr[510:512] == b'\x55\xaa', 'not an MBR image'
parts = []
for i in range(4):
    e = mbr[446 + i * 16: 446 + (i + 1) * 16]
    ptype, lba, n = e[4], struct.unpack('<I', e[8:12])[0], struct.unpack('<I', e[12:16])[0]
    if n: parts.append((ptype, lba * 512, n * 512))
boot = [p for p in parts if p[0] in (0x0b, 0x0c)][0]
print('partitions:', [(hex(t), off, size // 1024 // 1024, 'MiB') for t, off, size in parts])
print('boot FAT32 at offset', boot[1], 'size', boot[2] // 1024 // 1024, 'MiB')

fs = PyFatFS(img, offset=boot[1], read_only=False)
for name in ('/firstrun.sh', '/sociobeast.tar.gz'):
    assert not fs.exists(name), name + ' already exists: start again from a pristine image'
cmd = fs.readtext('/cmdline.txt').strip()
assert 'systemd.run=' not in cmd, 'cmdline already has a systemd.run hook: start again from a pristine image'
print('cmdline:', cmd)
hook = ' systemd.run=/boot/firmware/firstrun.sh systemd.run_success_action=reboot systemd.unit=kernel-command-line.target'
fs.writetext('/cmdline.txt', cmd + hook + '\n')
script = open('firstrun.sh', 'rb').read().replace(b'\r\n', b'\n')
with fs.openbin('/firstrun.sh', 'w') as dst:
    dst.write(script)
tgz = 'sociobeast.tar.gz'; size = os.path.getsize(tgz)
print('copying', tgz, size // 1024 // 1024, 'MiB ...')
with open(tgz, 'rb') as src, fs.openbin('/sociobeast.tar.gz', 'w') as dst:
    while True:
        chunk = src.read(4 * 1024 * 1024)
        if not chunk: break
        dst.write(chunk)
fs.close()

# verify by re-opening read-only
fs = PyFatFS(img, offset=boot[1], read_only=True)
got = fs.readbytes('/firstrun.sh'); ok1 = got == script
tsize = fs.getinfo('/sociobeast.tar.gz', namespaces=['details']).size; ok2 = tsize == size
# spot-check the tarball bytes at both ends
with fs.openbin('/sociobeast.tar.gz', 'r') as f, open(tgz, 'rb') as g:
    head_ok = f.read(1 << 20) == g.read(1 << 20)
    f.seek(size - (1 << 20)); g.seek(size - (1 << 20)); tail_ok = f.read() == g.read()
ok3 = 'systemd.run=/boot/firmware/firstrun.sh' in fs.readtext('/cmdline.txt')
fs.close()
print(f'verify: firstrun {len(got)}B match={ok1} | tarball {tsize}B match={ok2} head={head_ok} tail={tail_ok} | cmdline hook={ok3}')
if not (ok1 and ok2 and head_ok and tail_ok and ok3):
    print('VERIFY FAILED'); sys.exit(1)
print('done')
