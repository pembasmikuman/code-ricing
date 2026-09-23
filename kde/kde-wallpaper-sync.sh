#!/usr/bin/env bash
# Runs matugen on the current KDE wallpaper (screen 0).
# Started by wallpaper-sync.service whenever Plasma rewrites its desktop config.
set -euo pipefail

last_file="$HOME/.cache/matugen/last-wallpaper"

url=$(qdbus6 org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript '
  var d = desktops().filter(function (d) { return d.screen === 0; })[0] || desktops()[0];
  d.currentConfigGroup = ["Wallpaper", "org.kde.image", "General"];
  print(d.readConfig("Image"));')

# file:///home/x/My%20Walls/a.jpg -> /home/x/My Walls/a.jpg
path=${url#file://}
path=$(printf '%b' "${path//%/\\x}")

if [[ ! -f $path ]]; then
  echo "no image wallpaper found (got: '$url'), skipping" >&2
  exit 0
fi

# Plasma rewrites this config for many reasons; only rerun when the image changed.
if [[ -f $last_file && $(<"$last_file") == "$path" ]]; then
  exit 0
fi

matugen image "$path" -m dark --prefer saturation
mkdir -p "${last_file%/*}"
printf '%s' "$path" > "$last_file"
