#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Window;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Clone, serde::Serialize)]
struct LogMessage {
    message: String,
    level: String,
}

#[derive(Serialize, Deserialize)]
struct ConvertArgs {
    file_path: String,
    output_dir: String,
    api_key: String,
    model_name: String,
    use_ai: bool,
}

#[tauri::command]
async fn convert_pdf(
    window: Window,
    args: ConvertArgs,
) -> Result<String, String> {
    // Write the python script to a temp file
    let script_content = include_str!("engine.py");
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("doc2md_engine.py");
    std::fs::write(&script_path, script_content).map_err(|e| e.to_string())?;

    // Create a safe folder name based on the input file
    let path = Path::new(&args.file_path);
    let file_stem = path.file_stem().unwrap_or_default().to_string_lossy();
    
    // Sanitize filename for Windows
    let safe_name: String = file_stem
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '_' || c == '-' || c == '.' { c } else { '_' })
        .collect();

    let target_dir = PathBuf::from(&args.output_dir).join(&safe_name);
    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    }

    let mut cmd = Command::new("python");
    cmd.arg(script_path);
    cmd.arg("--file").arg(&args.file_path);
    cmd.arg("--outdir").arg(target_dir.to_string_lossy().as_ref());
    if !args.api_key.is_empty() {
        cmd.env("GEMINI_API_KEY", &args.api_key);
    }
    cmd.arg("--model").arg(&args.model_name);
    if args.use_ai {
        cmd.arg("--use-ai");
    }

    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.env("PYTHONUTF8", "1");

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone.emit(
                "log",
                LogMessage {
                    message: line,
                    level: "info".to_string(),
                },
            );
        }
    });

    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone.emit(
                "log",
                LogMessage {
                    message: line,
                    level: "error".to_string(),
                },
            );
        }
    });

    let status = child.wait().await.map_err(|e| e.to_string())?;
    
    if status.success() {
        let md_file = target_dir.join(format!("{}.md", safe_name));
        if md_file.exists() {
            let content = std::fs::read_to_string(&md_file).unwrap_or_default();
            Ok(content)
        } else {
            Ok("Conversion finished but MD file not found.".to_string())
        }
    } else {
        Err("Conversion process failed.".to_string())
    }
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![convert_pdf, open_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
