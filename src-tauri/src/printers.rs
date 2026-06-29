use serde::{Deserialize, Serialize};
#[cfg(not(target_os = "windows"))]
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterInfo {
  pub name: String,
  pub status: Option<String>,
  pub is_default: bool,
  pub is_thermal: bool,
}

pub fn detect_thermal(name: &str) -> bool {
  let n = name.to_lowercase();
  const NEEDLES: &[&str] = &[
    "pos-58",
    "pos58",
    "pos-80",
    "pos80",
    "tm-t",
    "tm-u",
    "epson tm",
    "bematech",
    "mp-4200",
    "mp4200",
    "daruma",
    "elgin",
    "thermal",
    "term",
    "receipt",
    "ticket",
    "cupom",
    "xprinter",
    "x-printer",
    "zjiang",
    "zj-",
    "gprinter",
    "gp-",
  ];
  NEEDLES.iter().any(|needle| n.contains(needle))
}

#[cfg(target_os = "windows")]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
  win_raw::list_printers_native()
}

#[cfg(not(target_os = "windows"))]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
  let output = Command::new("lpstat")
    .args(["-p", "-d"])
    .output()
    .map_err(|e| format!("lpstat indisponivel (CUPS): {e}"))?;

  if !output.status.success() {
    return Err(format!(
      "lpstat status {}: {}",
      output.status,
      String::from_utf8_lossy(&output.stderr)
    ));
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let mut default_name: Option<String> = None;
  let mut printers: Vec<PrinterInfo> = Vec::new();

  for line in stdout.lines() {
    let line = line.trim();
    if let Some(rest) = line.strip_prefix("printer ") {
      let mut it = rest.split_whitespace();
      if let Some(name) = it.next() {
        printers.push(PrinterInfo {
          name: name.to_string(),
          status: Some(if line.contains("disabled") { "disabled" } else { "Pronta" }.to_string()),
          is_default: false,
          is_thermal: detect_thermal(name),
        });
      }
    } else if let Some(rest) = line.strip_prefix("system default destination: ") {
      default_name = Some(rest.trim().to_string());
    }
  }

  if let Some(default_name) = default_name {
    for printer in printers.iter_mut() {
      printer.is_default = printer.name == default_name;
    }
  }

  Ok(printers)
}

#[cfg(target_os = "windows")]
pub fn print_raw(printer_name: &str, doc_name: &str, data: &[u8]) -> Result<String, String> {
  win_raw::write_raw(printer_name, doc_name, data)?;
  Ok(format!("Cupom enviado para '{}'.", printer_name))
}

#[cfg(not(target_os = "windows"))]
pub fn print_raw(printer_name: &str, _doc_name: &str, data: &[u8]) -> Result<String, String> {
  use std::io::Write;

  let mut child = Command::new("lp")
    .args(["-d", printer_name, "-o", "raw"])
    .stdin(std::process::Stdio::piped())
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped())
    .spawn()
    .map_err(|e| format!("lp indisponivel: {e}"))?;

  if let Some(stdin) = child.stdin.as_mut() {
    stdin.write_all(data).map_err(|e| format!("write: {e}"))?;
  }

  let out = child.wait_with_output().map_err(|e| format!("wait: {e}"))?;
  if !out.status.success() {
    return Err(format!("lp raw falhou: {}", String::from_utf8_lossy(&out.stderr)));
  }

  Ok(format!("Cupom enviado para '{}'.", printer_name))
}

pub fn build_escpos_receipt(text: &str, width_mm: u32, cut: bool) -> Vec<u8> {
  let cols: usize = if width_mm <= 58 { 32 } else { 48 };
  let mut out: Vec<u8> = Vec::with_capacity(text.len() + 64);

  out.extend_from_slice(&[0x1B, 0x40]);
  out.extend_from_slice(&[0x1B, 0x74, 0x10]);
  out.extend_from_slice(&[0x1B, 0x61, 0x00]);

  for raw_line in text.split('\n') {
    let encoded = utf8_to_cp1252(raw_line);
    if encoded.is_empty() {
      out.push(0x0A);
      continue;
    }

    let mut i = 0;
    while i < encoded.len() {
      let end = (i + cols).min(encoded.len());
      out.extend_from_slice(&encoded[i..end]);
      out.push(0x0A);
      i = end;
    }
  }

  out.extend_from_slice(&[0x0A, 0x0A, 0x0A, 0x0A]);

  if cut {
    out.extend_from_slice(&[0x1D, 0x56, 0x01]);
  }

  out
}

fn utf8_to_cp1252(s: &str) -> Vec<u8> {
  s.chars()
    .map(|c| {
      let code = c as u32;
      if code <= 0x7F {
        code as u8
      } else if (0xA0..=0xFF).contains(&code) {
        code as u8
      } else {
        match c {
          '€' => 0x80,
          '‚' => 0x82,
          'ƒ' => 0x83,
          '„' => 0x84,
          '…' => 0x85,
          '†' => 0x86,
          '‡' => 0x87,
          'ˆ' => 0x88,
          '‰' => 0x89,
          'Š' => 0x8A,
          '‹' => 0x8B,
          'Œ' => 0x8C,
          'Ž' => 0x8E,
          '‘' => 0x91,
          '’' => 0x92,
          '“' => 0x93,
          '”' => 0x94,
          '•' => 0x95,
          '–' => 0x96,
          '—' => 0x97,
          '˜' => 0x98,
          '™' => 0x99,
          'š' => 0x9A,
          '›' => 0x9B,
          'œ' => 0x9C,
          'ž' => 0x9E,
          'Ÿ' => 0x9F,
          _ => b'?',
        }
      }
    })
    .collect()
}

#[cfg(target_os = "windows")]
mod win_raw {
  use super::{detect_thermal, PrinterInfo};
  use std::ffi::OsStr;
  use std::os::windows::ffi::OsStrExt;
  use std::{ptr, slice};
  use winapi::shared::minwindef::DWORD;
  use winapi::um::winnt::HANDLE;
  use winapi::um::winspool::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW, OpenPrinterW,
    StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS,
    PRINTER_ENUM_LOCAL, PRINTER_INFO_2W,
  };

  fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
  }

  unsafe fn from_wide_ptr(p: *const u16) -> Option<String> {
    if p.is_null() {
      return None;
    }

    let mut len = 0usize;
    while *p.add(len) != 0 {
      len += 1;
    }

    if len == 0 {
      None
    } else {
      Some(String::from_utf16_lossy(slice::from_raw_parts(p, len)))
    }
  }

  fn default_printer_name() -> Option<String> {
    unsafe {
      let mut needed: DWORD = 0;
      GetDefaultPrinterW(ptr::null_mut(), &mut needed);
      if needed == 0 {
        return None;
      }

      let mut buf = vec![0u16; needed as usize];
      if GetDefaultPrinterW(buf.as_mut_ptr(), &mut needed) == 0 {
        return None;
      }

      from_wide_ptr(buf.as_ptr())
    }
  }

  fn status_text(status: DWORD, jobs: DWORD) -> Option<String> {
    if jobs > 0 {
      Some(format!("{jobs} trabalho(s) na fila"))
    } else if status == 0 {
      Some("Pronta".to_string())
    } else {
      Some(format!("Status {status}"))
    }
  }

  pub fn list_printers_native() -> Result<Vec<PrinterInfo>, String> {
    unsafe {
      let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
      let mut needed: DWORD = 0;
      let mut returned: DWORD = 0;

      EnumPrintersW(flags, ptr::null_mut(), 2, ptr::null_mut(), 0, &mut needed, &mut returned);
      if needed == 0 {
        return Ok(Vec::new());
      }

      let mut buffer = vec![0u8; needed as usize];
      let ok = EnumPrintersW(
        flags,
        ptr::null_mut(),
        2,
        buffer.as_mut_ptr(),
        needed,
        &mut needed,
        &mut returned,
      );

      if ok == 0 {
        return Err(format!(
          "Falha ao consultar impressoras do Windows: {}",
          std::io::Error::last_os_error()
        ));
      }

      let default_name = default_printer_name();
      let infos = slice::from_raw_parts(buffer.as_ptr() as *const PRINTER_INFO_2W, returned as usize);
      let mut printers = Vec::with_capacity(returned as usize);

      for info in infos {
        let Some(name) = from_wide_ptr(info.pPrinterName) else {
          continue;
        };
        let is_default = default_name
          .as_deref()
          .map(|default_name| default_name.eq_ignore_ascii_case(&name))
          .unwrap_or(false);

        printers.push(PrinterInfo {
          status: status_text(info.Status, info.cJobs),
          is_thermal: detect_thermal(&name),
          is_default,
          name,
        });
      }

      Ok(printers)
    }
  }

  pub fn write_raw(printer: &str, doc_name: &str, data: &[u8]) -> Result<(), String> {
    unsafe {
      let mut printer_w = to_wide(printer);
      let mut handle: HANDLE = ptr::null_mut();

      if OpenPrinterW(printer_w.as_mut_ptr(), &mut handle, ptr::null_mut()) == 0 || handle.is_null() {
        return Err(format!(
          "OpenPrinter('{printer}') falhou: {}",
          std::io::Error::last_os_error()
        ));
      }

      let mut doc_name_w = to_wide(doc_name);
      let mut datatype_w = to_wide("RAW");
      let mut doc = DOC_INFO_1W {
        pDocName: doc_name_w.as_mut_ptr(),
        pOutputFile: ptr::null_mut(),
        pDatatype: datatype_w.as_mut_ptr(),
      };

      let job = StartDocPrinterW(handle, 1, &mut doc as *mut _ as *mut _);
      if job == 0 {
        let e = std::io::Error::last_os_error();
        ClosePrinter(handle);
        return Err(format!("StartDocPrinter falhou: {e}"));
      }

      if StartPagePrinter(handle) == 0 {
        let e = std::io::Error::last_os_error();
        EndDocPrinter(handle);
        ClosePrinter(handle);
        return Err(format!("StartPagePrinter falhou: {e}"));
      }

      let mut written: DWORD = 0;
      let ok = WritePrinter(handle, data.as_ptr() as *mut _, data.len() as DWORD, &mut written);
      let write_error = if ok == 0 {
        Some(std::io::Error::last_os_error().to_string())
      } else if (written as usize) != data.len() {
        Some(format!("escrita parcial: {written}/{}", data.len()))
      } else {
        None
      };

      EndPagePrinter(handle);
      EndDocPrinter(handle);
      ClosePrinter(handle);

      if let Some(error) = write_error {
        return Err(format!("WritePrinter falhou: {error}"));
      }
    }

    Ok(())
  }
}
