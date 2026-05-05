# RandomWallpaper for Windows

Windows port of the [RandomWallpaperGnome3](https://github.com/ifl0w/RandomWallpaperGnome3)
GNOME Shell extension, rebuilt as a [Tauri 2](https://tauri.app/) desktop
application: Rust backend driving the Windows `IDesktopWallpaper` COM API,
TypeScript frontend hosting the original adapters.

## Features

* Tray-resident application; settings window is hidden by default.
* Adapters: Wallhaven, Reddit, Unsplash, Generic JSON, Static URL, Local Folder.
* Per-monitor wallpapers (`IDesktopWallpaper::SetWallpaper`).
* Scaling modes: Fill / Fit / Stretch / Tile / Center / Span.
* Auto-fetch timer with surpassed-interval handling.
* Save-for-later, blocklist, post-apply PowerShell command.
* Optional autostart with `--minimized` flag.

## Prerequisites

* Windows 10/11 x64.
* Rust (stable, **MSVC** toolchain) — [rustup](https://rustup.rs/).
* Node.js 20+ and npm.
* Visual Studio Build Tools 2022 with the **Desktop development with C++** workload
  (required by the Rust MSVC linker; Tauri docs:
  <https://tauri.app/start/prerequisites/>).
* WebView2 runtime (preinstalled on Windows 11; available via Microsoft on Windows 10).

### Toolchain setup

The Tauri build requires the **MSVC** Rust toolchain (not GNU/MinGW). After
installing Visual Studio Build Tools 2022 with the C++ workload:

```powershell
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc
rustc -vV   # host should read: x86_64-pc-windows-msvc
```

If `rustc -vV` reports `host: x86_64-pc-windows-gnu`, builds will fail with
errors like `error calling dlltool 'dlltool.exe': program not found`. Switch
to the MSVC toolchain as shown above.

## Quick start

```powershell
cd windows
npm install
pnpm run tauri:dev      # development run
./build.ps1            # release bundle (NSIS + MSI)
./install.ps1          # build, then launch the produced installer
```

The release bundle is emitted under `src-tauri/target/release/bundle/`
(`nsis/RandomWallpaper_*.exe` and `msi/RandomWallpaper_*.msi`).

## Project layout

```
windows/
├─ src/                 TypeScript frontend (UI + adapters + controller)
│  ├─ adapter/          Wallpaper sources
│  └─ ui/               Tabs, forms
├─ src-tauri/           Rust backend
│  ├─ src/wallpaper.rs  IDesktopWallpaper COM bridge
│  ├─ src/tray.rs       Tray icon + menu
│  └─ src/lib.rs        Tauri builder, commands, plugins
├─ build.ps1            One-shot build script
└─ install.ps1          Build + run installer
```

## Settings storage

State is persisted via the Tauri Store plugin in
`%APPDATA%\space.iflow.randomwallpaper\random-wallpaper.json` under the key
`state`, structured as `{ general, sources, history }`.

The cached wallpaper images live in `%LOCALAPPDATA%\space.iflow.randomwallpaper\wallpapers\`.

## Tray menu

* **Request New Wallpaper** — fetch + apply now.
* **Pause / Resume Auto-Fetch** — toggle the JS-side timer.
* **Open Wallpaper Folder** — open the cache directory.
* **Settings** — show the main window.
* **Quit** — exit.

A left-click on the tray icon shows the settings window.

## Notes & limitations

* HydraPaper / Superpaper are not used; per-monitor support is provided
  natively by `IDesktopWallpaper`.
* Adapters issue HTTP requests through `tauri-plugin-http`, bypassing the
  WebView's CORS policy.
* The `--minimized` CLI flag keeps the settings window hidden at startup.

## License

GPL-3.0, inherited from upstream.
