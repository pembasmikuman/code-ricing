# Wallpaper Theme for VS Code: Design

## Goal

When the desktop wallpaper changes, VS Code's UI colors change to match, live, with no window reload.
Works on KDE today; the VS Code side works on any desktop.

## Decisions

- **Colors come from matugen** (already installed, already driving kitty). One palette, so terminal and editor match.
- **UI colors only.** Syntax colors stay with the active theme so code stays readable on any wallpaper.
- **Colors are written to `workbench.colorCustomizations` in the user `settings.json`.** VS Code's settings API edits only that key in place (adds it at the end if missing), so the rest of the file is untouched. Accepted cost: `settings.json` is symlinked into this repo, so wallpaper changes show up as git changes.
- **Only the wallpaper trigger is KDE-specific.** Swapping desktops means swapping one small script.

## Pieces

### 1. matugen template (lives in `~/.config/matugen/`, copy kept in this repo under `matugen/`)

- `templates/vscode.json`: a JSON object of VS Code color keys to matugen colors, same `{{colors.<name>.default.hex}}` syntax as the kitty template. Covers editor, sidebar, activity bar, tabs, title bar, panel/terminal background, lists, inputs, buttons, borders, focus, scrollbar, widgets. Examples:
  - `editor.background` = `surface`, `editor.foreground` = `on_surface`
  - `sideBar.background`, `activityBar.background` = `surface_container_low`
  - `tab.inactiveBackground` = `surface_container_high`, `tab.activeBackground` = `surface`
  - `focusBorder`, `button.background`, `activityBar.activeBorder` = `primary`
  - `widget.border`, `panel.border` = `outline_variant`
- `config.toml` gets a `[templates.vscode]` entry writing to `~/.cache/matugen/vscode.json`.

### 2. VS Code extension (`wallpaper-theme/` in this repo)

- Plain JavaScript, no build step, no runtime dependencies. Files: `package.json`, `extension.js`.
- Activates on startup (`onStartupFinished`).
- Reads the JSON file on activation and whenever it changes (`vscode.workspace.createFileSystemWatcher` on the absolute path).
- Merges the file's colors over the existing `workbench.colorCustomizations` (hand-added keys survive; keys from the file win) and saves with `ConfigurationTarget.Global`.
- Skips the write if nothing changed, to avoid pointless settings.json churn.
- Missing or invalid JSON: shows one warning, leaves current colors alone.
- One setting: `wallpaperTheme.colorsFile` (default `~/.cache/matugen/vscode.json`, `~` expanded).
- Packaged with `bunx @vscode/vsce package`, installed with `code-oss --install-extension`.

### 3. KDE trigger (`kde/` in this repo, installed to `~/.local/bin` and `~/.config/systemd/user/`)

- `wallpaper-sync.path`: systemd path unit, `PathChanged=%h/.config/plasma-org.kde.plasma.desktop-appletsrc`.
- `wallpaper-sync.service`: oneshot that runs `kde-wallpaper-sync.sh`.
- `kde-wallpaper-sync.sh`: asks Plasma for screen 0's wallpaper via `qdbus6 org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript`, strips `file://` and decodes `%XX`, then runs `matugen image <path>`. Skips if the path is the same as last run (Plasma rewrites that config file for many reasons, not just wallpaper changes). Last path is kept in `~/.cache/matugen/last-wallpaper`.

## Flow

wallpaper changed in KDE, then Plasma rewrites its config file, then the systemd path unit fires, then the script runs matugen, which writes kitty colors and `vscode.json`, then the extension sees the file change and updates `workbench.colorCustomizations`, then VS Code repaints.

## Out of scope (for now)

- Syntax colors.
- Hardcoded colors in `custom-vscode.css` (for example `#2a2b38`, `#bc9abc`). Revisit after seeing what looks wrong.
- Multiple monitors with different wallpapers (screen 0 wins).
- Light mode (matugen default dark scheme).
- Non-KDE triggers.

## Testing

- Extension: a small `bun test` for the pure merge function (existing keys kept, file keys win, no-change detection). Then manual: edit `~/.cache/matugen/vscode.json` by hand, watch VS Code recolor.
- Trigger: change the wallpaper in KDE, confirm `journalctl --user -u wallpaper-sync` shows matugen ran and VS Code + kitty recolor.
