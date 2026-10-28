# Make a SocioBeast SD card (no PC needed afterwards)

## Ready-made image (what we ship)

`sociobeast-pi2-<date>.img.xz` = Raspberry Pi OS Lite 32-bit + SocioBeast + Node 20 for ARM, installed offline at first boot.
Flash it with Raspberry Pi Imager ("Use custom image"), answer **No** to customisation, plug Ethernet, power on, wait ~3 min:
`http://sociobeast.local:8420/admin` (password `beast`), SSH user `sociobeast` / `sociobeast`. The Pi 2 has no Wi-Fi.

To rebuild the image on a PC (no Linux tools needed, Python only):
1. Download Raspberry Pi OS Lite 32-bit (`raspios_lite_armhf_latest`) and `node-v20.18.0-linux-armv7l.tar.xz`, decompress the image (7-Zip).
2. Clone the repo without `.git`, add `server/node_modules` (pure JS, install them anywhere) and `server/config.json`, put the Node tarball
   inside as `node-armv7l.tar.xz`, pack as `sociobeast.tar.gz` (~240 MB, must fit the 512 MB boot partition).
3. `pip install pyfatfs setuptools`, copy `firstrun-offline.sh` to `firstrun.sh` next to the tarball, run `python inject.py <image.img>`:
   it writes the tarball, `firstrun.sh` and the `systemd.run=` hook into the FAT32 boot partition. Compress with 7-Zip to `.img.xz`.
Why this works without touching ext4: the kernel cmdline `systemd.run=` hook runs `firstrun.sh` as root at first boot (the same
mechanism Raspberry Pi Imager used for its own customisation); it extracts Node and the app, creates the service and reboots.


What you need: a Raspberry Pi (2, 3, 4 or 5), a micro-SD card of 8 GB or more, [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on any computer, once.

## The 5 steps

1. Open Raspberry Pi Imager, choose your Pi, then **Raspberry Pi OS Lite** (32-bit for a Pi 2, 64-bit for Pi 3 and up).
2. In the settings gear before writing: hostname `sociobeast`, user `sociobeast` with a password, your Wi-Fi, enable SSH. Write the card.
3. When the card is written, re-insert it: a small drive named `bootfs` (or `boot`) appears. Nothing else is needed if you did step 2: the Pi will be reachable as `sociobeast.local`.
4. Put the card in the Pi, power it, wait two minutes, then from any device on the same network:
   ```
   ssh sociobeast@sociobeast.local
   sudo apt-get install -y git && git clone https://github.com/mounemus/sociobeast-living-island.git ~/sociobeast && bash ~/sociobeast/scripts/pi-install.sh
   ```
5. Open `http://sociobeast.local:8420/admin` (password `beast`, change it), enter your TikTok account, press **Connect to TikTok**.

Fully automatic variant (no SSH step): edit `firstrun.sh` in this folder (Wi-Fi name and password), copy it onto the `bootfs` drive and append the `systemd.run=…` snippet from its header to `cmdline.txt`. On first boot the Pi configures itself and installs SocioBeast, then reboots. Check progress with `journalctl -u sociobeast-install -f`.

## Going live without a PC

The Pi runs the show (TikTok bridge, rules, save, admin, voice) but it does not draw the 3D scene. Two ways to put the creature on TikTok:

- **Your phone as the screen.** Open `http://sociobeast.local:8420/?kiosk=1` in the phone's browser (Chrome or Safari), tap once: it goes full screen and keeps the screen awake. In the TikTok app start a LIVE with **screen sharing** (the "Mobile gaming" / screen share LIVE mode): the phone streams its screen, the Pi feeds the beast. Works today with a Pi 2.
- **An autonomous box.** A Raspberry Pi 5 (or any small PC) can render the page itself and push the video to TikTok with `scripts/pi-stream.sh` (Chromium kiosk + ffmpeg → RTMP). You need a TikTok RTMP server URL and stream key (TikTok gives them to accounts allowed to go LIVE from third-party software). A Pi 2, 3 or 4 is too slow for this.

## Update later

```
ssh sociobeast@sociobeast.local 'bash ~/sociobeast/scripts/pi-update.sh'
```
