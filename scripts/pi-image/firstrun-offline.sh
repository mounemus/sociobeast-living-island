#!/bin/bash
# SocioBeast image — first boot (offline): creates the user, enables SSH, sets the hostname, installs Node and the app
# from /boot/firmware/sociobeast.tar.gz, registers the service, then reboots. Nothing to type: plug Ethernet, power on.
set +e
BOOT=/boot/firmware; [ -d "$BOOT" ] || BOOT=/boot
USER_NAME=sociobeast; USER_PASS=sociobeast
WIFI_SSID=""; WIFI_PASS=""; WIFI_COUNTRY="CA"   # fill in for a Wi-Fi dongle / built-in Wi-Fi; empty = Ethernet only
echo sociobeast > /etc/hostname
sed -i 's/127\.0\.1\.1.*/127.0.1.1\tsociobeast/' /etc/hosts
if [ -x /usr/lib/raspberrypi-sys-mods/imager_custom ]; then /usr/lib/raspberrypi-sys-mods/imager_custom enable_ssh; else systemctl enable ssh; fi
if ! id "$USER_NAME" >/dev/null 2>&1; then useradd -m -s /bin/bash -G sudo,video,audio,netdev "$USER_NAME"; echo "$USER_NAME:$USER_PASS" | chpasswd; echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/010_sociobeast; fi
rm -f /etc/ssh/sshd_not_to_be_run
# Wi-Fi (USB dongle or built-in): NetworkManager keyfile, plus the Imager helper when it exists
if [ -n "$WIFI_SSID" ]; then
  mkdir -p /etc/NetworkManager/system-connections
  cat > "/etc/NetworkManager/system-connections/$WIFI_SSID.nmconnection" <<EOF
[connection]
id=$WIFI_SSID
type=wifi
autoconnect=true
autoconnect-priority=10

[wifi]
mode=infrastructure
ssid=$WIFI_SSID

[wifi-security]
key-mgmt=wpa-psk
psk=$WIFI_PASS

[ipv4]
method=auto

[ipv6]
method=auto
EOF
  chmod 600 "/etc/NetworkManager/system-connections/$WIFI_SSID.nmconnection"
  [ -x /usr/lib/raspberrypi-sys-mods/imager_custom ] && /usr/lib/raspberrypi-sys-mods/imager_custom set_wlan "$WIFI_SSID" "$WIFI_PASS" "$WIFI_COUNTRY"
  command -v raspi-config >/dev/null && raspi-config nonint do_wifi_country "$WIFI_COUNTRY"
  rfkill unblock wifi 2>/dev/null
fi
# app + node (both were shipped on the boot partition)
tar -xzf "$BOOT/sociobeast.tar.gz" -C /home/$USER_NAME
mkdir -p /usr/local && tar -xJf /home/$USER_NAME/sociobeast/node-armv7l.tar.xz -C /usr/local --strip-components=1
rm -f /home/$USER_NAME/sociobeast/node-armv7l.tar.xz
chown -R $USER_NAME:$USER_NAME /home/$USER_NAME/sociobeast
cat > /etc/systemd/system/sociobeast.service <<EOF
[Unit]
Description=SocioBeast home server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=/home/$USER_NAME/sociobeast/server
ExecStart=/usr/local/bin/node /home/$USER_NAME/sociobeast/server/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl enable sociobeast.service
systemctl enable avahi-daemon 2>/dev/null
rm -f "$BOOT/sociobeast.tar.gz" "$BOOT/firstrun.sh"
sed -i 's| systemd.run=[^ ]*||g; s| systemd.run_success_action=[^ ]*||g; s| systemd.unit=kernel-command-line.target||g' "$BOOT/cmdline.txt"
exit 0
