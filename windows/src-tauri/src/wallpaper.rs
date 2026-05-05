//! IDesktopWallpaper COM bindings.
//!
//! Reference:
//! https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-idesktopwallpaper

#![cfg(windows)]

use anyhow::{anyhow, Context, Result};
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_LOCAL_SERVER, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::{
    DesktopWallpaper, IDesktopWallpaper, DESKTOP_WALLPAPER_POSITION, DWPOS_CENTER, DWPOS_FILL,
    DWPOS_FIT, DWPOS_SPAN, DWPOS_STRETCH, DWPOS_TILE,
};

/// RAII guard for COM initialization on the calling thread.
struct ComInit;

impl ComInit {
    fn new() -> Result<Self> {
        unsafe {
            let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            if hr.is_err() && hr.0 != -2147417850 /* RPC_E_CHANGED_MODE */ {
                return Err(anyhow!("CoInitializeEx failed: 0x{:08X}", hr.0));
            }
        }
        Ok(Self)
    }
}

impl Drop for ComInit {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

fn create_wallpaper() -> Result<IDesktopWallpaper> {
    unsafe {
        CoCreateInstance::<_, IDesktopWallpaper>(&DesktopWallpaper, None, CLSCTX_LOCAL_SERVER)
            .context("CoCreateInstance(IDesktopWallpaper) failed")
    }
}

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

#[allow(dead_code)]
fn pwstr_to_string(ptr: PWSTR) -> String {
    if ptr.0.is_null() {
        return String::new();
    }
    unsafe {
        let mut len = 0usize;
        while *ptr.0.add(len) != 0 {
            len += 1;
        }
        let slice = std::slice::from_raw_parts(ptr.0, len);
        String::from_utf16_lossy(slice)
    }
}

/// Set the same wallpaper on every monitor.
pub fn set_wallpaper_all(path: &str) -> Result<()> {
    let _com = ComInit::new()?;
    let dw = create_wallpaper()?;
    let wide = to_wide(path);
    unsafe {
        dw.SetWallpaper(PCWSTR::null(), PCWSTR(wide.as_ptr()))
            .context("SetWallpaper failed")?;
    }
    Ok(())
}

/// Set wallpaper for a single monitor (by index).
pub fn set_wallpaper_for_monitor(index: u32, path: &str) -> Result<()> {
    let _com = ComInit::new()?;
    let dw = create_wallpaper()?;
    let monitor_id = unsafe {
        dw.GetMonitorDevicePathAt(index)
            .context("GetMonitorDevicePathAt failed")?
    };
    let wide = to_wide(path);
    unsafe {
        dw.SetWallpaper(monitor_id, PCWSTR(wide.as_ptr()))
            .context("SetWallpaper (per-monitor) failed")?;
        // Free the BSTR-like buffer returned by GetMonitorDevicePathAt
        windows::Win32::System::Com::CoTaskMemFree(Some(monitor_id.0 as _));
    }
    Ok(())
}

/// Number of connected monitors as reported by IDesktopWallpaper.
pub fn monitor_count() -> Result<u32> {
    let _com = ComInit::new()?;
    let dw = create_wallpaper()?;
    let count = unsafe { dw.GetMonitorDevicePathCount().context("GetMonitorDevicePathCount failed")? };
    Ok(count)
}

/// Set the global wallpaper position. Accepts: fill, fit, stretch, tile, center, span.
pub fn set_position(mode: &str) -> Result<()> {
    let _com = ComInit::new()?;
    let dw = create_wallpaper()?;
    let pos: DESKTOP_WALLPAPER_POSITION = match mode.to_ascii_lowercase().as_str() {
        "fill" => DWPOS_FILL,
        "fit" => DWPOS_FIT,
        "stretch" => DWPOS_STRETCH,
        "tile" => DWPOS_TILE,
        "center" => DWPOS_CENTER,
        "span" => DWPOS_SPAN,
        other => return Err(anyhow!("unknown position mode: {other}")),
    };
    unsafe { dw.SetPosition(pos).context("SetPosition failed")? };
    Ok(())
}

/// Apply the same image to the Windows lock screen via the WinRT
/// `Windows.System.UserProfile.LockScreen` API.
pub fn set_lock_screen(path: &str) -> Result<()> {
    use windows::core::HSTRING;
    use windows::Storage::StorageFile;
    use windows::System::UserProfile::LockScreen;

    // WinRT async still needs COM initialised on the calling thread.
    let _com = ComInit::new()?;
    let h = HSTRING::from(path);
    let file = StorageFile::GetFileFromPathAsync(&h)
        .context("StorageFile::GetFileFromPathAsync failed")?
        .get()
        .context("StorageFile::GetFileFromPathAsync.get failed")?;
    LockScreen::SetImageFileAsync(&file)
        .context("LockScreen::SetImageFileAsync failed")?
        .get()
        .context("LockScreen::SetImageFileAsync.get failed")?;
    Ok(())
}
