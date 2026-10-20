use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, Manager, RunEvent, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

mod default_app;
mod menu;

/// Files waiting for a window whose page has not loaded yet, keyed by window label.
#[derive(Default)]
pub(crate) struct Pending {
    pub(crate) files: Mutex<HashMap<String, Vec<String>>>,
    /// A menu command to run once the window is ready ("open" from the macOS menu with no window)
    pub(crate) actions: Mutex<HashMap<String, String>>,
    /// Windows whose page called `window_ready`: they receive new files as events
    ready: Mutex<Vec<String>>,
}

static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(0);
/// Set when the user asked to quit: closing the last window then exits on macOS too
static QUITTING: AtomicBool = AtomicBool::new(false);

const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

#[derive(Serialize)]
struct Startup {
    files: Vec<String>,
    action: Option<String>,
    /// System language: the webview reports the app bundle's language, not the user's
    locale: String,
}

#[derive(Serialize)]
struct FileData {
    path: String,
    content: String,
}

/// Called once by each page when it is ready: returns the files it should open.
#[tauri::command]
fn window_ready(window: WebviewWindow, state: State<Pending>) -> Startup {
    let label = window.label().to_string();
    let mut ready = state.ready.lock().unwrap();
    if !ready.contains(&label) {
        ready.push(label.clone());
    }
    Startup {
        files: state
            .files
            .lock()
            .unwrap()
            .remove(&label)
            .unwrap_or_default(),
        action: state.actions.lock().unwrap().remove(&label),
        locale: sys_locale::get_locale().unwrap_or_else(|| "en".into()),
    }
}

#[tauri::command]
fn read_file(app: AppHandle, path: String) -> Result<FileData, String> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        return Err("This is a folder, not a file.".into());
    }
    if meta.len() > MAX_FILE_SIZE {
        return Err("This file is too large to open (more than 50 MB).".into());
    }
    let bytes = fs::read(&p).map_err(|e| e.to_string())?;
    let mut content = String::from_utf8(bytes)
        .map_err(|_| "This file is not a text file (or not UTF-8 encoded).".to_string())?;
    if content.starts_with('\u{feff}') {
        content.remove(0);
    }
    allow_images_next_to(&app, &p);
    Ok(FileData { path, content })
}

/// Writes through a temporary file then renames it, so a crash never leaves a half-written document.
#[tauri::command]
fn write_file(app: AppHandle, path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let dir = p.parent().ok_or("Invalid path")?;
    let name = p.file_name().ok_or("Invalid path")?.to_string_lossy();
    let tmp = dir.join(format!(".{name}.plume-tmp"));
    let result = (|| -> std::io::Result<()> {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(content.as_bytes())?;
        f.sync_all()?;
        // Keep the permissions of the file being replaced
        if let Ok(meta) = fs::metadata(&p) {
            let _ = fs::set_permissions(&tmp, meta.permissions());
        }
        fs::rename(&tmp, &p)
    })();
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp);
        return Err(e.to_string());
    }
    allow_images_next_to(&app, &p);
    Ok(())
}

/// Writes an exported file (HTML) in place, no temporary file needed.
#[tauri::command]
fn export_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

/// Images added to a saved document are copied into an "images" folder next to it, so the
/// document and its pictures can be moved or shared together. Returns the new file's path.
#[tauri::command]
fn copy_image(app: AppHandle, source: String, doc_path: String) -> Result<String, String> {
    let src = PathBuf::from(&source);
    let doc_dir = Path::new(&doc_path).parent().ok_or("Invalid path")?;
    // Already next to the document: link it where it is
    if src.starts_with(doc_dir) {
        return Ok(source);
    }
    let name = src
        .file_name()
        .ok_or("Invalid image")?
        .to_string_lossy()
        .into_owned();
    let dest = unique_path(&doc_dir.join("images"), &name)?;
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    allow_images_next_to(&app, Path::new(&doc_path));
    Ok(dest.to_string_lossy().into_owned())
}

/// Pasted pictures (screenshots) are written to the "images" folder next to the document.
#[tauri::command]
fn save_image(
    app: AppHandle,
    doc_path: String,
    name: String,
    data: String,
) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| e.to_string())?;
    let doc_dir = Path::new(&doc_path).parent().ok_or("Invalid path")?;
    let dest = unique_path(&doc_dir.join("images"), &name)?;
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    allow_images_next_to(&app, Path::new(&doc_path));
    Ok(dest.to_string_lossy().into_owned())
}

fn unique_path(dir: &Path, name: &str) -> Result<PathBuf, String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let clean: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '-'
            }
        })
        .collect();
    let path = Path::new(&clean);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "image".into());
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let mut candidate = dir.join(format!("{stem}{ext}"));
    let mut n = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{stem}-{n}{ext}"));
        n += 1;
    }
    Ok(candidate)
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn open_window(app: AppHandle, path: Option<String>) -> Result<(), String> {
    create_window(&app, path.into_iter().collect())
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn print_page(window: WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[tauri::command]
fn cancel_quit() {
    QUITTING.store(false, Ordering::SeqCst);
}

/// The preview shows images stored next to the document through the asset protocol.
/// Its scope starts empty: each opened or saved document grants its own folder.
fn allow_images_next_to(app: &AppHandle, file: &Path) {
    if let Some(dir) = file.parent() {
        let _ = app.asset_protocol_scope().allow_directory(dir, true);
    }
}

pub(crate) fn create_window(app: &AppHandle, files: Vec<String>) -> tauri::Result<WebviewWindow> {
    let label = format!("doc-{}", WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst));
    if !files.is_empty() {
        app.state::<Pending>()
            .files
            .lock()
            .unwrap()
            .insert(label.clone(), files);
    }
    // Cascade new windows a little so they do not hide each other exactly
    let offset = app
        .webview_windows()
        .values()
        .filter_map(|w| w.outer_position().ok())
        .map(|p| p.x)
        .max();
    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title("Plume")
        .inner_size(1100.0, 760.0)
        .min_inner_size(560.0, 420.0)
        .visible(false);
    if offset.is_none() {
        builder = builder.center();
    }
    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
    }
    let window = builder.build()?;
    if let (Some(_), Some(focused)) = (
        offset,
        focused_window(app).or_else(|| app.webview_windows().into_values().next()),
    ) {
        if focused.label() != label {
            if let Ok(pos) = focused.outer_position() {
                let _ = window.set_position(tauri::PhysicalPosition::new(pos.x + 40, pos.y + 40));
            }
        }
    }
    Ok(window)
}

pub(crate) fn focused_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.webview_windows()
        .into_values()
        .find(|w| w.is_focused().unwrap_or(false))
}

/// Files opened from the system (Finder, Explorer, command line, second launch).
/// The focused window decides: it opens the file itself when empty, otherwise in a new window.
fn open_files(app: &AppHandle, files: Vec<String>) {
    if files.is_empty() {
        return;
    }
    let state = app.state::<Pending>();
    let ready = state.ready.lock().unwrap().clone();
    let windows = app.webview_windows();
    let target = focused_window(app)
        .filter(|w| ready.contains(&w.label().to_string()))
        .or_else(|| {
            windows
                .values()
                .find(|w| ready.contains(&w.label().to_string()))
                .cloned()
        });
    if let Some(w) = target {
        let _ = w.emit_to(w.label(), "open-files", files);
        let _ = w.set_focus();
        return;
    }
    // A window is still loading: hand it the files
    if let Some(w) = windows.values().next() {
        state
            .files
            .lock()
            .unwrap()
            .entry(w.label().to_string())
            .or_default()
            .extend(files);
        return;
    }
    let _ = create_window(app, files);
}

fn file_args(args: &[String], cwd: &Path) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(|a| {
            let p = PathBuf::from(a);
            if p.is_absolute() {
                p
            } else {
                cwd.join(p)
            }
        })
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Windows and Linux: a second launch (double-click on a file) hands its files to the running app
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let files = file_args(&args, Path::new(&cwd));
            if files.is_empty() {
                if let Some(w) =
                    focused_window(app).or_else(|| app.webview_windows().into_values().next())
                {
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                } else {
                    let _ = create_window(app, vec![]);
                }
            } else {
                open_files(app, files);
            }
        }));
    }

    let app = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Pending::default())
        .invoke_handler(tauri::generate_handler![
            window_ready,
            read_file,
            write_file,
            export_file,
            path_exists,
            copy_image,
            save_image,
            open_window,
            print_page,
            cancel_quit,
            default_app::md_default_status,
            default_app::make_md_default
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                app.set_menu(menu::build(app.handle())?)?;
                app.on_menu_event(menu::handle);
            }
            let cwd = std::env::current_dir().unwrap_or_default();
            let args: Vec<String> = std::env::args().collect();
            create_window(app.handle(), file_args(&args, &cwd))?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<Pending>();
                state.ready.lock().unwrap().retain(|l| l != window.label());
                state.files.lock().unwrap().remove(window.label());
                state.actions.lock().unwrap().remove(window.label());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Plume");

    app.run(|app, event| match event {
        // macOS: files opened from Finder, also on cold start
        #[cfg(target_os = "macos")]
        RunEvent::Opened { urls } => {
            let files = urls
                .iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            open_files(app, files);
        }
        // macOS: clicking the Dock icon with no window open
        #[cfg(target_os = "macos")]
        RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !has_visible_windows && app.webview_windows().is_empty() {
                let _ = create_window(app, vec![]);
            }
        }
        // macOS apps stay alive without windows, unless the user quit
        RunEvent::ExitRequested {
            code: None, api, ..
        } if cfg!(target_os = "macos") && !QUITTING.load(Ordering::SeqCst) => {
            api.prevent_exit();
        }
        _ => {}
    });
}

/// Quit asked from the menu: every window closes itself, asking about unsaved changes first.
pub(crate) fn request_quit(app: &AppHandle) {
    QUITTING.store(true, Ordering::SeqCst);
    let windows = app.webview_windows();
    if windows.is_empty() {
        app.exit(0);
        return;
    }
    for w in windows.values() {
        let _ = w.emit_to(w.label(), "menu", "quit");
    }
}
