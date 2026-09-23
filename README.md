# Code Ricing

My personal VS Code (Code - OSS) setup: `settings.json`, custom CSS, and a script for the [vscode-custom-css](https://github.com/be5invis/vscode-custom-css) extension. The real files live in this repo, and `~/.config/Code - OSS/User/` has symlinks pointing here, so edits in VS Code land in the repo.

## Contents

- `settings.json` - editor settings, keybinding-adjacent preferences, formatter/associations config
- `custom-vscode.css` - custom UI styling
- `vscode-script.js` - custom UI script

## Setup

On a new machine, clone this repo and symlink each file into place:

```bash
for f in settings.json custom-vscode.css vscode-script.js; do
  ln -sf "$PWD/$f" "$HOME/.config/Code - OSS/User/$f"
done
```

`settings.json` includes the generated `workbench.colorCustomizations` block, so it changes whenever the wallpaper does.

## Wallpaper theme

VS Code UI colors follow the desktop wallpaper.

- `wallpaper-theme/` - VS Code extension. Watches `~/.cache/matugen/vscode.json` and merges it into `workbench.colorCustomizations`. Build with `bunx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license`, install with `code-oss --install-extension wallpaper-theme-0.1.0.vsix`.
- `matugen/vscode.json` - matugen template (symlinked from `~/.config/matugen/templates/`, plus a `[templates.vscode]` entry in `~/.config/matugen/config.toml`).
- `kde/` - KDE trigger. Script goes in `~/.local/bin` (symlink), units go in `~/.config/systemd/user/`, then `systemctl --user enable --now wallpaper-sync.path`. On another desktop, replace this with anything that runs `matugen image <wallpaper> -m dark --prefer saturation`.

The extension only adds or updates colors, it never removes them. If you drop a key from the template (or uninstall the extension), delete the leftover keys from `workbench.colorCustomizations` by hand. After editing the template, run `rm ~/.cache/matugen/last-wallpaper && kde-wallpaper-sync.sh` to regenerate without changing the wallpaper.
