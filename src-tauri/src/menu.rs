//! macOS application menu. Windows and Linux windows have no menu bar: the in-app toolbar and
//! keyboard shortcuts cover the same commands there.
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use tauri::menu::{AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::{create_window, focused_window, request_quit};

fn french() -> bool {
    sys_locale::get_locale()
        .map(|l| l.to_lowercase().starts_with("fr"))
        .unwrap_or(false)
}

pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let fr = french();
    let t = |en: &'static str, fr_text: &'static str| if fr { fr_text } else { en };
    let item =
        |id: &str, label: &str, accel: Option<&str>| MenuItem::with_id(app, id, label, true, accel);
    let sep = || PredefinedMenuItem::separator(app);

    let about = AboutMetadata {
        name: Some("Plume".into()),
        version: Some(app.package_info().version.to_string()),
        copyright: Some("MIT License".into()),
        website: Some("https://github.com/croos555/plume".into()),
        ..Default::default()
    };

    let app_menu = Submenu::with_items(
        app,
        "Plume",
        true,
        &[
            &PredefinedMenuItem::about(
                app,
                Some(t("About Plume", "À propos de Plume")),
                Some(about),
            )?,
            &sep()?,
            &item("settings", t("Settings…", "Réglages…"), Some("CmdOrCtrl+,"))?,
            &sep()?,
            &PredefinedMenuItem::services(app, None)?,
            &sep()?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &sep()?,
            &item(
                "quit",
                t("Quit Plume", "Quitter Plume"),
                Some("CmdOrCtrl+Q"),
            )?,
        ],
    )?;

    let file = Submenu::with_items(
        app,
        t("File", "Fichier"),
        true,
        &[
            &item(
                "new",
                t("New Document", "Nouveau document"),
                Some("CmdOrCtrl+N"),
            )?,
            &item("open", t("Open…", "Ouvrir…"), Some("CmdOrCtrl+O"))?,
            &sep()?,
            &item("save", t("Save", "Enregistrer"), Some("CmdOrCtrl+S"))?,
            &item(
                "save_as",
                t("Save As…", "Enregistrer sous…"),
                Some("CmdOrCtrl+Shift+S"),
            )?,
            &sep()?,
            &item(
                "export_html",
                t("Export as Web Page…", "Exporter en page web…"),
                None,
            )?,
            &item(
                "print",
                t("Print or Save as PDF…", "Imprimer ou enregistrer en PDF…"),
                Some("CmdOrCtrl+P"),
            )?,
            &sep()?,
            &PredefinedMenuItem::close_window(app, Some(t("Close Window", "Fermer la fenêtre")))?,
        ],
    )?;

    let edit = Submenu::with_items(
        app,
        t("Edit", "Édition"),
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &sep()?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view = Submenu::with_items(
        app,
        t("View", "Présentation"),
        true,
        &[
            &item("mode_read", t("Read", "Lecture"), Some("CmdOrCtrl+1"))?,
            &item("mode_edit", t("Edit", "Modifier"), Some("CmdOrCtrl+2"))?,
            &item(
                "toggle_preview",
                t("Show or Hide Preview", "Afficher ou masquer l'aperçu"),
                Some("CmdOrCtrl+Shift+P"),
            )?,
            &sep()?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let window = Submenu::with_items(
        app,
        t("Window", "Fenêtre"),
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    let help = Submenu::with_items(
        app,
        t("Help", "Aide"),
        true,
        &[&item("guide", t("Markdown Guide", "Guide Markdown"), None)?],
    )?;

    Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window, &help])
}

pub fn handle(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    if id == "quit" {
        request_quit(app);
        return;
    }
    match focused_window(app) {
        Some(w) => {
            let _ = w.emit_to(w.label(), "menu", id);
        }
        // No window open (macOS): New and Open start one
        None if id == "new" => {
            let _ = create_window(app, vec![]);
        }
        None if id == "open" => {
            if let Ok(w) = create_window(app, vec![]) {
                app.state::<crate::Pending>()
                    .actions
                    .lock()
                    .unwrap()
                    .insert(w.label().to_string(), "open".into());
            }
        }
        None => {}
    }
}
