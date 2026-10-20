//! "Open .md files with Plume": checks and sets the default application for Markdown files.
//!
//! - macOS: LaunchServices (`LSSetDefaultRoleHandlerForContentType`), applied at once.
//! - Linux: `xdg-mime default <desktop file> text/markdown`, applied at once.
//! - Windows: apps may not change file defaults themselves (Windows 8 and later). Plume opens the
//!   system "How do you want to open this file?" dialog, where the user ticks "Always".

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultAppStatus {
    /// Plume is the default app for .md files (None: unknown on this platform)
    is_default: Option<bool>,
    /// "direct": applied at once; "dialog": the system asks the user
    method: &'static str,
}

#[tauri::command]
pub fn md_default_status(app: tauri::AppHandle) -> DefaultAppStatus {
    imp::status(&app)
}

#[tauri::command]
pub fn make_md_default(app: tauri::AppHandle) -> Result<(), String> {
    imp::make_default(&app)
}

#[cfg(target_os = "macos")]
mod imp {
    use super::DefaultAppStatus;
    use core_foundation::base::TCFType;
    use core_foundation::string::{CFString, CFStringRef};

    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn LSSetDefaultRoleHandlerForContentType(
            content_type: CFStringRef,
            role: u32,
            bundle_id: CFStringRef,
        ) -> i32;
        fn LSCopyDefaultRoleHandlerForContentType(
            content_type: CFStringRef,
            role: u32,
        ) -> CFStringRef;
    }

    const ROLES_ALL: u32 = 0xFFFF_FFFF;
    const ROLE_VIEWER: u32 = 0x2;
    /// Markdown's system type, plus the generic one some apps export
    const TYPES: [&str; 2] = ["net.daringfireball.markdown", "public.markdown"];

    fn bundle_id(app: &tauri::AppHandle) -> String {
        app.config().identifier.clone()
    }

    pub fn status(app: &tauri::AppHandle) -> DefaultAppStatus {
        let ours = bundle_id(app).to_lowercase();
        let ty = CFString::new(TYPES[0]);
        let current = unsafe {
            LSCopyDefaultRoleHandlerForContentType(ty.as_concrete_TypeRef(), ROLE_VIEWER)
        };
        let is_default = if current.is_null() {
            false
        } else {
            let handler = unsafe { CFString::wrap_under_create_rule(current) };
            handler.to_string().to_lowercase() == ours
        };
        DefaultAppStatus {
            is_default: Some(is_default),
            method: "direct",
        }
    }

    pub fn make_default(app: &tauri::AppHandle) -> Result<(), String> {
        let id = CFString::new(&bundle_id(app));
        let mut last = 0;
        for t in TYPES {
            let ty = CFString::new(t);
            let res = unsafe {
                LSSetDefaultRoleHandlerForContentType(
                    ty.as_concrete_TypeRef(),
                    ROLES_ALL,
                    id.as_concrete_TypeRef(),
                )
            };
            if t == TYPES[0] {
                last = res;
            }
        }
        if last == 0 {
            Ok(())
        } else {
            Err(format!("macOS refused the change (error {last})."))
        }
    }
}

#[cfg(target_os = "linux")]
mod imp {
    use super::DefaultAppStatus;
    use std::process::Command;

    /// Desktop entry installed by the .deb/.rpm packages (AppImage integrations use their own name)
    fn desktop_file() -> String {
        std::env::var("PLUME_DESKTOP_FILE").unwrap_or_else(|_| "Plume.desktop".into())
    }

    pub fn status(_app: &tauri::AppHandle) -> DefaultAppStatus {
        let out = Command::new("xdg-mime")
            .args(["query", "default", "text/markdown"])
            .output();
        let is_default = out.ok().filter(|o| o.status.success()).map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .eq_ignore_ascii_case(&desktop_file())
        });
        DefaultAppStatus {
            is_default,
            method: "direct",
        }
    }

    pub fn make_default(_app: &tauri::AppHandle) -> Result<(), String> {
        let file = desktop_file();
        let ok = Command::new("xdg-mime")
            .args(["default", &file, "text/markdown", "text/x-markdown"])
            .status()
            .map_err(|e| format!("xdg-mime is not available: {e}"))?
            .success();
        if ok {
            Ok(())
        } else {
            Err("xdg-mime could not change the default application.".into())
        }
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use super::DefaultAppStatus;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    pub fn status(_app: &tauri::AppHandle) -> DefaultAppStatus {
        // The user's choice lives in a hashed registry key Windows does not let apps read reliably
        let out = Command::new("reg")
            .args([
                r"query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoice",
                "/v",
                "ProgId",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        let is_default = out.ok().filter(|o| o.status.success()).map(|o| {
            let text = String::from_utf8_lossy(&o.stdout).to_lowercase();
            text.contains("plume")
        });
        DefaultAppStatus {
            is_default: Some(is_default.unwrap_or(false)),
            method: "dialog",
        }
    }

    pub fn make_default(_app: &tauri::AppHandle) -> Result<(), String> {
        // The "Open with" dialog needs a file of that type: use a small sample in the temp folder
        let sample = std::env::temp_dir().join("Plume.md");
        if !sample.exists() {
            std::fs::write(&sample, "# Plume\n").map_err(|e| e.to_string())?;
        }
        // OpenAs_RunDLL takes the rest of the command line as the path, unquoted
        Command::new("rundll32.exe")
            .raw_arg(format!("shell32.dll,OpenAs_RunDLL {}", sample.display()))
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
mod imp {
    use super::DefaultAppStatus;

    pub fn status(_app: &tauri::AppHandle) -> DefaultAppStatus {
        DefaultAppStatus {
            is_default: None,
            method: "direct",
        }
    }

    pub fn make_default(_app: &tauri::AppHandle) -> Result<(), String> {
        Err("Not supported on this system.".into())
    }
}
