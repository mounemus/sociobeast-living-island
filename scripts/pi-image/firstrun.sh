#!/bin/bash
# SocioBeast — first-boot setup for a freshly flashed Raspberry Pi OS Lite card (Pi 2 and up, 32-bit or 64-bit).
# Fill WIFI_SSID / WIFI_PASS below (leave empty for Ethernet), copy this file to the boot partition of the SD card
# as  firstrun.sh  (next to cmdline.txt), then add  systemd.run=/boot/firmware/firstrun.sh systemd.run_success_action=reboot systemd.unit=kernel-command-line.target
# at the end of the single line of cmdline.txt (Raspberry Pi Imager does exactly this for its own firstrun.sh).
# On first boot the Pi sets its hostname to "sociobeast", enables SSH, joins the Wi-Fi, installs SocioBeast and reboots.
# Afterwards: http://sociobeast.local:8420/admin  (password beast)   ·   ssh sociobeast@sociobeast.local (password below)
set +e
WIFI_SSID=""
WIFI_PASS=""
WIFI_COUNTRY="CA"
USER_NAME="sociobeast"
USER_PASS="sociobeast"
REPO="https://github.com/mounemus/sociobeast-living-island.git"

echo sociobeast > /etc/hostname
sed -i 's/127\.0\.1\.1.*/127.0.1.1\tsociobeast/' /etc/hosts
if [ -f /usr/lib/raspberrypi-sys-mods/imager_custom ]; then
  /usr/lib/raspberrypi-sys-mods/imager_custom enable_ssh
  [ -n "$WIFI_SSID" ] && /usr/lib/raspberrypi-sys-mods/imager_custom set_wlan "$WIFI_SSID" "$WIFI_PASS" "$WIFI_COUNTRY"
else
  systemctl enable ssh
  if [ -n "$WIFI_SSID" ]; then cat > /etc/wpa_supplicant/wpa_supplicant.conf <<EOF
country=$WIFI_COUNTRY
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
network={ ssid="$WIFI_SSID" psk="$WIFI_PASS" }
EOF
  fi
fi
# user
if ! id "$USER_NAME" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -G sudo,video,audio "$USER_NAME"
  echo "$USER_NAME:$USER_PASS" | chpasswd
  echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/010_sociobeast
fi
# install SocioBeast once the network is up (runs in the background after this script returns, survives the reboot)
cat > /etc/systemd/system/sociobeast-install.service <<EOF
[Unit]
Description=SocioBeast one-time install
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/home/$USER_NAME/sociobeast/server/config.json

[Service]
Type=oneshot
User=$USER_NAME
WorkingDirectory=/home/$USER_NAME
ExecStartPre=/bin/sh -c 'until ping -c1 github.com >/dev/null 2>&1; do sleep 5; done'
ExecStart=/bin/sh -c 'sudo apt-get update && sudo apt-get install -y git curl && git clone $REPO sociobeast && bash sociobeast/scripts/pi-install.sh'
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl enable sociobeast-install.service
rm -f /boot/firstrun.sh /boot/firmware/firstrun.sh
sed -i 's| systemd.run.*||g' /boot/cmdline.txt /boot/firmware/cmdline.txt 2>/dev/null
exit 0
