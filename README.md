# Code Ricing

My personal VS Code (Code - OSS) setup: `settings.json`, custom CSS, and a script for the [vscode-custom-css](https://github.com/be5invis/vscode-custom-css) extension. These files are symlinked from `~/.config/Code - OSS/User/` so this repo always reflects the live config.

## Contents

- `settings.json` - editor settings, keybinding-adjacent preferences, formatter/associations config
- `custom-vscode.css` - custom UI styling
- `vscode-script.js` - custom UI script

## Setup

Since the files here are symlinks pointing at `~/.config/Code - OSS/User/`, cloning this repo alone won't apply the config elsewhere. On a new machine, either:

- Clone this repo, then symlink each file from `~/.config/Code - OSS/User/` back to the cloned copies, or
- Copy the files directly into `~/.config/Code - OSS/User/`.

## Wallpaper theme

VS Code UI colors follow the desktop wallpaper.

- `wallpaper-theme/` - VS Code extension. Watches `~/.cache/matugen/vscode.json` and merges it into `workbench.colorCustomizations`. Build with `bunx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license`, install with `code-oss --install-extension wallpaper-theme-0.1.0.vsix`.
- `matugen/vscode.json` - matugen template (symlinked from `~/.config/matugen/templates/`, plus a `[templates.vscode]` entry in `~/.config/matugen/config.toml`).
- `kde/` - KDE trigger. Script goes in `~/.local/bin` (symlink), units go in `~/.config/systemd/user/`, then `systemctl --user enable --now wallpaper-sync.path`. On another desktop, replace this with anything that runs `matugen image <wallpaper> -m dark --prefer saturation`.
