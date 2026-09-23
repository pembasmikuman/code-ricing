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
  if (!merged) return;
  try {
    await workbench.update("colorCustomizations", merged, vscode.ConfigurationTarget.Global);
  } catch (err) {
    vscode.window.showWarningMessage(`Wallpaper Theme: could not save colors: ${err.message}`);
  }
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
