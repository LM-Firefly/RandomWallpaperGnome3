//! System tray menu, kept intentionally simple. The frontend listens for
//! emitted events and performs the actual logic (request a new wallpaper,
//! pause/resume timer, etc.).

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

/// Shared handles to mutable tray menu items so we can re-label them on
/// locale change without rebuilding the whole menu.
pub struct TrayMenuItems {
    pub request: MenuItem<tauri::Wry>,
    pub pause: MenuItem<tauri::Wry>,
    pub open_folder: MenuItem<tauri::Wry>,
    pub settings: MenuItem<tauri::Wry>,
    pub quit: MenuItem<tauri::Wry>,
}

pub struct TrayState(pub Mutex<TrayMenuItems>);

#[derive(serde::Deserialize)]
pub struct TrayLabels {
    pub request: String,
    pub pause: String,
    pub open_folder: String,
    pub settings: String,
    pub quit: String,
    pub tooltip: Option<String>,
}

#[tauri::command]
pub fn set_tray_labels(app: AppHandle, labels: TrayLabels) -> Result<(), String> {
    let state = app.state::<TrayState>();
    let items = state.0.lock().map_err(|e| e.to_string())?;
    items.request.set_text(&labels.request).map_err(|e| e.to_string())?;
    items.pause.set_text(&labels.pause).map_err(|e| e.to_string())?;
    items
        .open_folder
        .set_text(&labels.open_folder)
        .map_err(|e| e.to_string())?;
    items
        .settings
        .set_text(&labels.settings)
        .map_err(|e| e.to_string())?;
    items.quit.set_text(&labels.quit).map_err(|e| e.to_string())?;
    if let Some(tooltip) = labels.tooltip {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_tooltip(Some(tooltip));
        }
    }
    Ok(())
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let request = MenuItem::with_id(app, "request", "Request New Wallpaper", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause Auto-Fetch", true, None::<&str>)?;
    let open_folder = MenuItem::with_id(app, "open_folder", "Open Save Folder", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&request, &pause, &open_folder, &sep, &settings, &sep, &quit],
    )?;

    app.manage(TrayState(Mutex::new(TrayMenuItems {
        request: request.clone(),
        pause: pause.clone(),
        open_folder: open_folder.clone(),
        settings: settings.clone(),
        quit: quit.clone(),
    })));

    TrayIconBuilder::with_id("main")
        .tooltip("Random Wallpaper")
        .icon(app.default_window_icon().cloned().unwrap_or_else(|| {
            // Fallback transparent icon. Builds without a real one will still work
            // because Tauri provides the bundled app icon.
            tauri::image::Image::new_owned(vec![0u8; 4], 1, 1)
        }))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "request" => {
                let _ = app.emit("tray:request-new-wallpaper", ());
            }
            "pause" => {
                let _ = app.emit("tray:toggle-pause", ());
            }
            "open_folder" => {
                let _ = app.emit("tray:open-folder", ());
            }
            "settings" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
