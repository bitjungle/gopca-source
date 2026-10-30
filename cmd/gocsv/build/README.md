# build/

Packaging assets and the Wails v3 Taskfiles for GoCSV.

- `config.yml` — project metadata and `wails3 dev` settings. `Info*.plist`,
  `windows/info.json` and `windows/wails.exe.manifest` are rendered from it by
  `wails3 task common:update:build-assets`; edit `config.yml`, not them.
- `Taskfile.yml`, `darwin/`, `linux/`, `windows/` — build tasks, trimmed from the
  `wails3 init` defaults. Run `wails3 task --list` from the app directory.
- `darwin/icons.icns`, `windows/icon.ico`, `linux/*.png`, `appicon.png` — icons,
  produced by `scripts/generate-icons.sh` and committed; the Taskfiles do not
  regenerate them.
- `linux/gocsv.desktop` — the desktop entry bundled into the AppImage.
- `bin/` — build output (gitignored).
