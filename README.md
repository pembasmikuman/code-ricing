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
