mod printers;

use printers::PrinterInfo;

#[tauri::command]
fn list_printers() -> Result<Vec<PrinterInfo>, String> {
  printers::list_printers()
}

#[tauri::command]
fn print_raw_escpos(bytes: Vec<u8>, printer_name: String) -> Result<String, String> {
  printers::print_raw(&printer_name, "Cash Game Pro Recibo", &bytes)
}

#[tauri::command]
fn print_receipt_text(
  text: String,
  printer_name: String,
  width_mm: Option<u32>,
  cut: Option<bool>,
) -> Result<String, String> {
  let bytes = printers::build_escpos_receipt(&text, width_mm.unwrap_or(80), cut.unwrap_or(true));
  printers::print_raw(&printer_name, "Cash Game Pro Recibo", &bytes)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      list_printers,
      print_raw_escpos,
      print_receipt_text,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
