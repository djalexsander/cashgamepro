#[cfg(target_os = "windows")]
mod windows_print {
  use std::{mem::size_of, thread, time::Duration};

  const INPUT_KEYBOARD: u32 = 1;
  const KEYEVENTF_KEYUP: u32 = 0x0002;
  const VK_CONTROL: u16 = 0x11;
  const VK_SHIFT: u16 = 0x10;
  const VK_P: u16 = 0x50;

  #[repr(C)]
  struct Input {
    input_type: u32,
    data: KeyboardInput,
  }

  #[repr(C)]
  struct KeyboardInput {
    virtual_key: u16,
    scan_code: u16,
    flags: u32,
    time: u32,
    extra_info: usize,
  }

  #[link(name = "user32")]
  extern "system" {
    fn SendInput(input_count: u32, inputs: *const Input, input_size: i32) -> u32;
  }

  fn key(virtual_key: u16, flags: u32) -> Input {
    Input {
      input_type: INPUT_KEYBOARD,
      data: KeyboardInput {
        virtual_key,
        scan_code: 0,
        flags,
        time: 0,
        extra_info: 0,
      },
    }
  }

  pub fn open_system_print_dialog() -> Result<(), String> {
    thread::sleep(Duration::from_millis(120));

    let inputs = [
      key(VK_CONTROL, 0),
      key(VK_SHIFT, 0),
      key(VK_P, 0),
      key(VK_P, KEYEVENTF_KEYUP),
      key(VK_SHIFT, KEYEVENTF_KEYUP),
      key(VK_CONTROL, KEYEVENTF_KEYUP),
    ];

    let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<Input>() as i32) };
    if sent == inputs.len() as u32 {
      Ok(())
    } else {
      Err(format!("Falha ao acionar a caixa de impressao do sistema ({sent}/{} teclas).", inputs.len()))
    }
  }
}

#[tauri::command]
fn open_system_print_dialog() -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    return windows_print::open_system_print_dialog();
  }

  #[cfg(not(target_os = "windows"))]
  {
    Err("A caixa de impressao do sistema esta disponivel apenas no Windows.".to_string())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_system_print_dialog])
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
