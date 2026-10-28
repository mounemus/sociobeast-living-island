"""Inject SocioBeast into a Raspberry Pi OS image: files go on the FAT32 boot partition (no ext4 writing needed),
firstrun.sh installs everything offline at first boot via the kernel cmdline systemd.run hook."""
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
try:
    cmd = fs.readtext('/cmdline.txt').strip()
    print('cmdline:', cmd)
    hook = ' systemd.run=/boot/firmware/firstrun.sh systemd.run_success_action=reboot systemd.unit=kernel-command-line.target'
    if 'systemd.run=' not in cmd:
        fs.writetext('/cmdline.txt', cmd + hook + '\n')
    with open('firstrun.sh', 'rb') as f:
        fs.writebytes('/firstrun.sh', f.read().replace(b'\r\n', b'\n'))
    tgz = 'sociobeast.tar.gz'
    size = os.path.getsize(tgz)
    print('copying', tgz, size // 1024 // 1024, 'MiB …')
    with open(tgz, 'rb') as src, fs.openbin('/sociobeast.tar.gz', 'w') as dst:
        while True:
            chunk = src.read(4 * 1024 * 1024)
            if not chunk: break
            dst.write(chunk)
    print('boot files:', fs.listdir('/'))
    print('cmdline now:', fs.readtext('/cmdline.txt').strip())
finally:
    fs.close()
print('done')
