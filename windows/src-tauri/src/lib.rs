//! Random Wallpaper for Windows — Tauri 2 backend.
//!
//! Provides:
//! - `set_wallpaper` / `set_wallpaper_per_monitor` via the IDesktopWallpaper COM API
//! - `get_monitor_count` / `get_monitor_paths`
//! - `set_wallpaper_position` (Fill, Fit, Stretch, Tile, Center, Span)
//! - System tray with menu (Request New, Settings, Pause/Resume, Quit)
//! - Autostart through `tauri-plugin-autostart`
//!
//! All adapter / source / scheduling logic lives in the TypeScript frontend,
//! which is kept loaded in a hidden window so it can react to tray events
//! and timer ticks emitted from this backend.

mod tray;
mod wallpaper;

use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;

#[tauri::command]
fn set_wallpaper(path: String) -> Result<(), String> {
    wallpaper::set_wallpaper_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_wallpaper_per_monitor(monitor_index: u32, path: String) -> Result<(), String> {
    wallpaper::set_wallpaper_for_monitor(monitor_index, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_monitor_count() -> Result<u32, String> {
    wallpaper::monitor_count().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_wallpaper_position(mode: String) -> Result<(), String> {
    wallpaper::set_position(&mode).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_lock_screen(path: String) -> Result<(), String> {
    wallpaper::set_lock_screen(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn hide_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    Ok(())
}

/// Open an arbitrary local path (file or folder) in Explorer.
/// Bypasses the `shell` plugin's URL-only scope validator.
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW = 0x08000000 — avoid a transient console flash.
        std::process::Command::new("explorer.exe")
            .raw_arg(format!("\"{}\"", path))
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        return Err("open_path is Windows-only".into());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            // Build the system tray.
            tray::setup_tray(app.handle())?;

            // The main window is created hidden. Show it on first launch only when
            // the user has not opted into "start minimized" (when --minimized arg present
            // we keep the window hidden; otherwise show it so the user can configure).
            let started_minimized = std::env::args().any(|a| a == "--minimized");
            if !started_minimized {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                }
            }

            // Intercept window close: hide instead of exit.
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |e| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                        let _ = win_clone.hide();
                        api.prevent_close();
                    }
                });
            }

            // Notify the frontend that the backend is up. The frontend is
            // responsible for "fetch on startup" and timer logic.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = handle.emit("backend-ready", ());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_wallpaper,
            set_wallpaper_per_monitor,
            get_monitor_count,
            set_wallpaper_position,
            set_lock_screen,
            show_settings_window,
            hide_settings_window,
            open_path,
            tray::set_tray_labels,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
