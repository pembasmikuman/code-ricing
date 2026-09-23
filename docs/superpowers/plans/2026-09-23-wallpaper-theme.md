# Wallpaper Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor the VS Code (Code - OSS) UI live whenever the KDE wallpaper changes, using matugen's palette.

**Architecture:** A systemd path unit notices KDE's desktop config changing, asks Plasma for the wallpaper, and runs matugen. matugen renders a VS Code color JSON file. A tiny extension watches that file and merges it into `workbench.colorCustomizations`.

**Tech Stack:** Plain JavaScript VS Code extension (CommonJS, no deps), `bun test`, `bunx @vscode/vsce`, matugen 4.2, bash, systemd user units, `qdbus6`.

**Spec:** `docs/superpowers/specs/2026-09-23-wallpaper-theme-design.md`

## Global Constraints

- JS tooling: `bun` / `bunx` only. Never `node`, `npm`, `npx`.
- Extension has zero runtime dependencies and no build step.
- VS Code binary is `code-oss` (version 1.138.0); `engines.vscode` is `^1.90.0`.
- Colors file default: `~/.cache/matugen/vscode.json`. Setting name: `wallpaperTheme.colorsFile`.
- UI colors only. Never write `editor.tokenColorCustomizations`.
- matugen must always be called with `-m dark --prefer saturation` (without `--prefer` it hangs waiting for input when there is no terminal).
- New config files live as real files in this repo; `~/.config` gets symlinks pointing into the repo (not the other way around; git only stores a symlink's path).
- Functions that are not obvious get a docstring.
- Prose in docs/commits: no em dashes, plain words.

## Review Focus

1. matugen writes the colors file while the extension is reading it (half-written JSON): expect no broken colors and at most one warning, then a correct apply once the write finishes. Covered by the debounce in Task 2 and `parseColors` rejecting bad JSON in Task 1.
2. The user already has hand-added keys or theme-scoped blocks (`"[Default Dark Modern]": {...}`) in `workbench.colorCustomizations`: expect them untouched. Test in Task 1.
3. The file changes but its colors are identical (Plasma rewrote config for an unrelated reason, matugen re-ran): expect no write to `settings.json`. Test in Task 1.
4. Wallpaper path containing spaces (`file:///home/x/My%20Walls/a.jpg`): expect matugen gets `/home/x/My Walls/a.jpg`. Check in Task 4.
5. The colors file has the wrong shape (an array, or non-string values): expect a warning, not garbage in settings. Test in Task 1.

---

## File Map

- Create `wallpaper-theme/merge.js`: pure functions `parseColors(text)` and `mergeColors(current, incoming)`. No `vscode` import, so bun can test it.
- Create `wallpaper-theme/merge.test.js`: bun tests for the above.
- Create `wallpaper-theme/extension.js`: VS Code glue (read file, watch, write setting).
- Create `wallpaper-theme/package.json`: extension manifest.
- Create `wallpaper-theme/.vscodeignore`: keep tests out of the `.vsix`.
- Create `matugen/vscode.json`: matugen template. Symlinked from `~/.config/matugen/templates/vscode.json`.
- Modify `~/.config/matugen/config.toml`: add `[templates.vscode]`.
- Create `kde/kde-wallpaper-sync.sh`, `kde/wallpaper-sync.path`, `kde/wallpaper-sync.service`.
- Modify `README.md`: short section on the new pieces.

---

### Task 1: Merge and parse logic

**Files:**
- Create: `wallpaper-theme/merge.js`
- Test: `wallpaper-theme/merge.test.js`

**Interfaces:**
- Produces: `parseColors(text: string): Record<string,string>` (throws `Error` on bad input); `mergeColors(current: object, incoming: Record<string,string>): object | null` (returns `null` when nothing would change). Exported via `module.exports = { parseColors, mergeColors }`.

- [ ] **Step 1: Write the failing tests**

`wallpaper-theme/merge.test.js`:

```js
const { test, expect } = require("bun:test");
const { parseColors, mergeColors } = require("./merge");

test("parseColors accepts an object of strings", () => {
  expect(parseColors('{"editor.background":"#0f1416"}')).toEqual({ "editor.background": "#0f1416" });
});

test("parseColors rejects half-written JSON", () => {
  expect(() => parseColors('{"editor.background":"#0f')).toThrow();
});

test("parseColors rejects arrays and non-string values", () => {
  expect(() => parseColors("[]")).toThrow("object");
  expect(() => parseColors('{"editor.background":5}')).toThrow("editor.background");
});

test("mergeColors keeps hand-added and theme-scoped keys, file keys win", () => {
  const scoped = { "editor.background": "#111111" };
  const current = { "editor.background": "#000000", "my.custom": "#abcdef", "[Default Dark Modern]": scoped };
  const merged = mergeColors(current, { "editor.background": "#0f1416" });
  expect(merged).toEqual({ "editor.background": "#0f1416", "my.custom": "#abcdef", "[Default Dark Modern]": scoped });
});

test("mergeColors returns null when nothing changes", () => {
  const current = { "editor.background": "#0f1416", "my.custom": "#abcdef" };
  expect(mergeColors(current, { "editor.background": "#0f1416" })).toBeNull();
});

test("mergeColors works with no existing customizations", () => {
  expect(mergeColors({}, { focusBorder: "#88ccee" })).toEqual({ focusBorder: "#88ccee" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wallpaper-theme && bun test`
Expected: FAIL, `Cannot find module './merge'`.

- [ ] **Step 3: Write the implementation**

`wallpaper-theme/merge.js`:

```js
/**
 * Parse the matugen colors file. Throws if it is not a flat object of
 * color strings, which also catches a file that is only half written.
 */
function parseColors(text) {
  const data = JSON.parse(text);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected a JSON object");
  }
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") throw new Error(`${key} is not a string`);
  }
  return data;
}

/**
 * Lay the wallpaper colors over the user's existing colorCustomizations.
 * Keys the user added by hand are kept; keys from the file win.
 * Returns null when the result is identical, so the caller can skip the write.
 */
function mergeColors(current, incoming) {
  const merged = { ...current, ...incoming };
  const changed = Object.keys(incoming).some((key) => current[key] !== incoming[key]);
  return changed ? merged : null;
}

module.exports = { parseColors, mergeColors };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wallpaper-theme && bun test`
Expected: 6 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add wallpaper-theme/merge.js wallpaper-theme/merge.test.js
git commit -m "Add color parse and merge logic for wallpaper-theme extension

Kept free of the vscode module so it can be tested with bun. Merge keeps
hand-added color overrides and reports when nothing changed so we skip
needless settings.json writes."
```

---

### Task 2: Extension glue, package, install

**Files:**
- Create: `wallpaper-theme/package.json`, `wallpaper-theme/extension.js`, `wallpaper-theme/.vscodeignore`

**Interfaces:**
- Consumes: `parseColors`, `mergeColors` from `./merge` (Task 1).
- Produces: installed extension `pembasmikuman.wallpaper-theme` that applies `wallpaperTheme.colorsFile` into `workbench.colorCustomizations`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "wallpaper-theme",
  "displayName": "Wallpaper Theme",
  "description": "Recolors the VS Code UI from a matugen wallpaper palette.",
  "version": "0.1.0",
  "publisher": "pembasmikuman",
  "license": "MIT",
  "engines": { "vscode": "^1.90.0" },
  "main": "./extension.js",
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "configuration": {
      "title": "Wallpaper Theme",
      "properties": {
        "wallpaperTheme.colorsFile": {
          "type": "string",
          "default": "~/.cache/matugen/vscode.json",
          "description": "JSON file of VS Code UI colors written by matugen. Watched for changes."
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write `.vscodeignore`**

```
merge.test.js
```

- [ ] **Step 3: Write `extension.js`**

```js
const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseColors, mergeColors } = require("./merge");

let watcher;
let timer;

/** Absolute path of the colors file, with a leading ~ expanded. */
function colorsFile() {
  const setting = vscode.workspace.getConfiguration("wallpaperTheme").get("colorsFile");
  return setting.replace(/^~(?=$|\/)/, os.homedir());
}

/** Read the colors file and merge it into the user's colorCustomizations. */
async function apply() {
  const file = colorsFile();
  let incoming;
  try {
    incoming = parseColors(fs.readFileSync(file, "utf8"));
  } catch (err) {
    vscode.window.showWarningMessage(`Wallpaper Theme: could not read ${file}: ${err.message}`);
    return;
  }
  const workbench = vscode.workspace.getConfiguration("workbench");
  const current = workbench.inspect("colorCustomizations").globalValue ?? {};
  const merged = mergeColors(current, incoming);
  if (merged) await workbench.update("colorCustomizations", merged, vscode.ConfigurationTarget.Global);
}

/** Wait for matugen to finish writing before reading; it can fire several events per write. */
function applySoon() {
  clearTimeout(timer);
  timer = setTimeout(apply, 300);
}

/** (Re)start watching the colors file. */
function watch() {
  watcher?.dispose();
  const file = colorsFile();
  watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(path.dirname(file)), path.basename(file)),
  );
  watcher.onDidChange(applySoon);
  watcher.onDidCreate(applySoon);
}

function activate(context) {
  watch();
  apply();
  context.subscriptions.push(
    { dispose: () => watcher?.dispose() },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("wallpaperTheme.colorsFile")) {
        watch();
        apply();
      }
    }),
  );
}

function deactivate() {
  clearTimeout(timer);
}

module.exports = { activate, deactivate };
```

- [ ] **Step 4: Package and install**

Run:
```bash
cd wallpaper-theme
bunx @vscode/vsce package --allow-missing-repository --skip-license
code-oss --install-extension wallpaper-theme-0.1.0.vsix
```
Expected: `wallpaper-theme-0.1.0.vsix` created (if vsce asks about a missing README, answer `y`); install prints `successfully installed`.

Add `*.vsix` to a root `.gitignore`:
```bash
echo '*.vsix' >> ../.gitignore
```

- [ ] **Step 5: Manual check with a hand-written colors file**

```bash
mkdir -p ~/.cache/matugen
cp ~/.config/"Code - OSS"/User/settings.json ~/.cache/matugen/settings.backup.json
echo '{"editor.background":"#3a0000","sideBar.background":"#003a00"}' > ~/.cache/matugen/vscode.json
```
Reload the VS Code window once (the extension is new). Expected: editor turns dark red, sidebar dark green, and `settings.json` now ends with a `"workbench.colorCustomizations"` block, with every other line unchanged:
```bash
diff ~/.cache/matugen/settings.backup.json ~/.config/"Code - OSS"/User/settings.json
```
Then change the file without reloading:
```bash
echo '{"editor.background":"#00003a","sideBar.background":"#003a00"}' > ~/.cache/matugen/vscode.json
```
Expected: editor turns dark blue within about a second, no reload.
Then break it: `echo '{"editor.bac' > ~/.cache/matugen/vscode.json`. Expected: one warning toast, colors stay blue.

- [ ] **Step 6: Commit**

```bash
git add wallpaper-theme/package.json wallpaper-theme/extension.js wallpaper-theme/.vscodeignore .gitignore
git commit -m "Add wallpaper-theme VS Code extension

Watches the matugen colors file and merges it into
workbench.colorCustomizations so the UI recolors live without a reload."
```

---

### Task 3: matugen template

**Files:**
- Create: `matugen/vscode.json`
- Modify: `~/.config/matugen/config.toml` (append), symlink `~/.config/matugen/templates/vscode.json`

**Interfaces:**
- Produces: matugen writes `~/.cache/matugen/vscode.json` (flat object of VS Code color key to hex string), consumed by the extension from Task 2.

- [ ] **Step 1: Write the template**

`matugen/vscode.json` (appended two hex digits are alpha):

```json
{
  "foreground": "{{colors.on_surface.default.hex}}",
  "descriptionForeground": "{{colors.on_surface_variant.default.hex}}",
  "focusBorder": "{{colors.primary.default.hex}}",
  "widget.border": "{{colors.outline_variant.default.hex}}",
  "selection.background": "{{colors.primary.default.hex}}55",
  "textLink.foreground": "{{colors.tertiary.default.hex}}",
  "textLink.activeForeground": "{{colors.tertiary.default.hex}}",

  "editor.background": "{{colors.surface.default.hex}}",
  "editor.foreground": "{{colors.on_surface.default.hex}}",
  "editorCursor.foreground": "{{colors.primary.default.hex}}",
  "editorLineNumber.foreground": "{{colors.outline.default.hex}}",
  "editorLineNumber.activeForeground": "{{colors.on_surface.default.hex}}",
  "editor.selectionBackground": "{{colors.primary.default.hex}}40",
  "editor.inactiveSelectionBackground": "{{colors.primary.default.hex}}20",
  "editor.findMatchBackground": "{{colors.tertiary.default.hex}}55",
  "editor.findMatchHighlightBackground": "{{colors.tertiary.default.hex}}30",
  "editorWidget.background": "{{colors.surface_container.default.hex}}",
  "editorWidget.border": "{{colors.outline_variant.default.hex}}",
  "editorSuggestWidget.background": "{{colors.surface_container.default.hex}}",
  "editorSuggestWidget.selectedBackground": "{{colors.secondary_container.default.hex}}",
  "editorHoverWidget.background": "{{colors.surface_container.default.hex}}",
  "editorGroup.border": "{{colors.outline_variant.default.hex}}",
  "editorGroupHeader.tabsBackground": "{{colors.surface_container_low.default.hex}}",

  "tab.activeBackground": "{{colors.surface.default.hex}}",
  "tab.activeForeground": "{{colors.on_surface.default.hex}}",
  "tab.activeBorderTop": "{{colors.primary.default.hex}}",
  "tab.inactiveBackground": "{{colors.surface_container_high.default.hex}}",
  "tab.inactiveForeground": "{{colors.on_surface_variant.default.hex}}",
  "tab.border": "{{colors.surface_container_low.default.hex}}",

  "titleBar.activeBackground": "{{colors.surface_container_low.default.hex}}",
  "titleBar.activeForeground": "{{colors.on_surface.default.hex}}",
  "titleBar.inactiveBackground": "{{colors.surface_container_low.default.hex}}",
  "titleBar.inactiveForeground": "{{colors.on_surface_variant.default.hex}}",
  "menu.background": "{{colors.surface_container.default.hex}}",
  "menu.foreground": "{{colors.on_surface.default.hex}}",
  "menu.selectionBackground": "{{colors.secondary_container.default.hex}}",
  "menu.selectionForeground": "{{colors.on_secondary_container.default.hex}}",

  "activityBar.background": "{{colors.surface_container_low.default.hex}}",
  "activityBar.foreground": "{{colors.primary.default.hex}}",
  "activityBar.inactiveForeground": "{{colors.on_surface_variant.default.hex}}",
  "activityBar.activeBorder": "{{colors.primary.default.hex}}",
  "activityBarTop.foreground": "{{colors.primary.default.hex}}",
  "activityBarTop.inactiveForeground": "{{colors.on_surface_variant.default.hex}}",
  "activityBarTop.activeBorder": "{{colors.primary.default.hex}}",
  "activityBarBadge.background": "{{colors.primary.default.hex}}",
  "activityBarBadge.foreground": "{{colors.on_primary.default.hex}}",

  "sideBar.background": "{{colors.surface_container_low.default.hex}}",
  "sideBar.foreground": "{{colors.on_surface.default.hex}}",
  "sideBar.border": "{{colors.outline_variant.default.hex}}",
  "sideBarTitle.foreground": "{{colors.on_surface.default.hex}}",
  "sideBarSectionHeader.background": "{{colors.surface_container_low.default.hex}}",
  "sideBarSectionHeader.foreground": "{{colors.on_surface_variant.default.hex}}",

  "list.activeSelectionBackground": "{{colors.secondary_container.default.hex}}",
  "list.activeSelectionForeground": "{{colors.on_secondary_container.default.hex}}",
  "list.inactiveSelectionBackground": "{{colors.surface_container_high.default.hex}}",
  "list.hoverBackground": "{{colors.surface_container.default.hex}}",
  "list.focusOutline": "{{colors.primary.default.hex}}",
  "list.highlightForeground": "{{colors.primary.default.hex}}",
  "quickInput.background": "{{colors.surface_container.default.hex}}",
  "quickInputList.focusBackground": "{{colors.secondary_container.default.hex}}",
  "quickInputList.focusForeground": "{{colors.on_secondary_container.default.hex}}",

  "input.background": "{{colors.surface_container_high.default.hex}}",
  "input.foreground": "{{colors.on_surface.default.hex}}",
  "input.border": "{{colors.outline_variant.default.hex}}",
  "input.placeholderForeground": "{{colors.on_surface_variant.default.hex}}",
  "dropdown.background": "{{colors.surface_container_high.default.hex}}",
  "dropdown.border": "{{colors.outline_variant.default.hex}}",
  "button.background": "{{colors.primary.default.hex}}",
  "button.foreground": "{{colors.on_primary.default.hex}}",
  "button.hoverBackground": "{{colors.primary_fixed_dim.default.hex}}",
  "button.secondaryBackground": "{{colors.secondary_container.default.hex}}",
  "button.secondaryForeground": "{{colors.on_secondary_container.default.hex}}",
  "badge.background": "{{colors.primary.default.hex}}",
  "badge.foreground": "{{colors.on_primary.default.hex}}",
  "progressBar.background": "{{colors.primary.default.hex}}",

  "panel.background": "{{colors.surface_container_low.default.hex}}",
  "panel.border": "{{colors.outline_variant.default.hex}}",
  "panelTitle.activeForeground": "{{colors.on_surface.default.hex}}",
  "panelTitle.activeBorder": "{{colors.primary.default.hex}}",
  "panelTitle.inactiveForeground": "{{colors.on_surface_variant.default.hex}}",
  "terminal.background": "{{colors.surface_container_low.default.hex}}",
  "terminal.foreground": "{{colors.on_surface.default.hex}}",
  "terminalCursor.foreground": "{{colors.primary.default.hex}}",
  "statusBar.background": "{{colors.surface_container_low.default.hex}}",
  "statusBar.foreground": "{{colors.on_surface_variant.default.hex}}",
  "notifications.background": "{{colors.surface_container.default.hex}}",
  "notifications.foreground": "{{colors.on_surface.default.hex}}",

  "scrollbarSlider.background": "{{colors.outline_variant.default.hex}}80",
  "scrollbarSlider.hoverBackground": "{{colors.outline.default.hex}}80",
  "scrollbarSlider.activeBackground": "{{colors.primary.default.hex}}80"
}
```

- [ ] **Step 2: Hook it into matugen**

```bash
ln -s "$HOME/Projects/Code Ricing/matugen/vscode.json" ~/.config/matugen/templates/vscode.json
cat >> ~/.config/matugen/config.toml <<'EOF'

[templates.vscode]
input_path  = "~/.config/matugen/templates/vscode.json"
output_path = "~/.cache/matugen/vscode.json"
EOF
```

- [ ] **Step 3: Run matugen and check the output**

```bash
matugen image ~/Pictures/Wallpaper/wallhaven-zp523j.jpg -m dark --prefer saturation
bun -e 'const j = JSON.parse(await Bun.file(process.env.HOME + "/.cache/matugen/vscode.json").text()); const bad = Object.entries(j).filter(([k, v]) => !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)); console.log(Object.keys(j).length, "keys,", bad.length, "bad", bad)'
```
Expected: `0 bad []`, and the key count matches `grep -c "{{" matugen/vscode.json`, kitty recolors too, and VS Code recolors live to the wallpaper palette within about a second.

- [ ] **Step 4: Commit**

```bash
git add matugen/vscode.json
git commit -m "Add matugen template that maps wallpaper colors to VS Code UI colors

Real file lives in the repo so git backs it up; ~/.config/matugen points
to it with a symlink."
```

---

### Task 4: KDE wallpaper trigger

**Files:**
- Create: `kde/kde-wallpaper-sync.sh`, `kde/wallpaper-sync.path`, `kde/wallpaper-sync.service`

**Interfaces:**
- Consumes: matugen config from Task 3.
- Produces: `wallpaper-sync.path` enabled for the user; runs matugen whenever the KDE wallpaper changes.

- [ ] **Step 1: Write the script**

`kde/kde-wallpaper-sync.sh`:

```bash
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
```

- [ ] **Step 2: Check the URL decoding on a path with a space**

```bash
url='file:///home/x/My%20Walls/a.jpg'; path=${url#file://}; printf '%b\n' "${path//%/\\x}"
```
Expected: `/home/x/My Walls/a.jpg`

- [ ] **Step 3: Write the systemd units**

`kde/wallpaper-sync.path`:

```ini
[Unit]
Description=Watch KDE desktop config for wallpaper changes

[Path]
PathChanged=%h/.config/plasma-org.kde.plasma.desktop-appletsrc

[Install]
WantedBy=default.target
```

`kde/wallpaper-sync.service`:

```ini
[Unit]
Description=Regenerate matugen colors from the KDE wallpaper

[Service]
Type=oneshot
ExecStart=%h/.local/bin/kde-wallpaper-sync.sh
```

- [ ] **Step 4: Install and enable**

```bash
chmod +x kde/kde-wallpaper-sync.sh
mkdir -p ~/.local/bin ~/.config/systemd/user
ln -sf "$HOME/Projects/Code Ricing/kde/kde-wallpaper-sync.sh" ~/.local/bin/kde-wallpaper-sync.sh
install -m644 kde/wallpaper-sync.path kde/wallpaper-sync.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now wallpaper-sync.path
systemctl --user status wallpaper-sync.path --no-pager
```
Expected: `active (waiting)`.

- [ ] **Step 5: Run the script once by hand**

```bash
rm -f ~/.cache/matugen/last-wallpaper
~/.local/bin/kde-wallpaper-sync.sh && cat ~/.cache/matugen/last-wallpaper; echo
~/.local/bin/kde-wallpaper-sync.sh; echo "second run exit $?"
```
Expected: first run prints matugen output and the wallpaper path; second run prints nothing but `second run exit 0` (skipped, same wallpaper).

- [ ] **Step 6: End-to-end check**

Change the wallpaper in KDE (right click desktop, Configure Desktop and Wallpaper). Then:
```bash
journalctl --user -u wallpaper-sync.service -n 20 --no-pager
```
Expected: a fresh run with matugen output; VS Code and kitty recolor within a couple of seconds. Change some other desktop setting (for example a widget position) and confirm the journal shows a run that did not call matugen.

- [ ] **Step 7: Commit**

```bash
git add kde/
git commit -m "Add KDE trigger that reruns matugen when the wallpaper changes

A systemd path unit watches Plasma's desktop config, the script asks
Plasma for the current wallpaper and skips when it has not changed."
```

---

### Task 5: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a section**

```markdown
## Wallpaper theme

VS Code UI colors follow the desktop wallpaper.

- `wallpaper-theme/` - VS Code extension. Watches `~/.cache/matugen/vscode.json` and merges it into `workbench.colorCustomizations`. Build with `bunx @vscode/vsce package --allow-missing-repository --skip-license`, install with `code-oss --install-extension wallpaper-theme-0.1.0.vsix`.
- `matugen/vscode.json` - matugen template (symlinked from `~/.config/matugen/templates/`, plus a `[templates.vscode]` entry in `~/.config/matugen/config.toml`).
- `kde/` - KDE trigger. Script goes in `~/.local/bin` (symlink), units go in `~/.config/systemd/user/`, then `systemctl --user enable --now wallpaper-sync.path`. On another desktop, replace this with anything that runs `matugen image <wallpaper> -m dark --prefer saturation`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document the wallpaper theme setup in the README"
```
