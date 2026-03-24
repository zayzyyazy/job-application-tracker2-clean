use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::webview::WebviewWindowBuilder;
use tauri::Manager;
use tauri::RunEvent;
use tauri::WebviewUrl;
use url::Url;

const NEXT_PORT: u16 = 14587;
const DEV_URL: &str = "http://localhost:3000/";
const RELEASE_URL: &str = "http://127.0.0.1:14587/";

fn prisma_db_url_for(path: &Path) -> String {
  let s = path.to_string_lossy().replace('\\', "/");
  if cfg!(windows) && s.len() >= 2 && s.chars().nth(1) == Some(':') {
    format!("file:/{}", s)
  } else {
    format!("file:{}", s)
  }
}

/// GUI apps on macOS often inherit a minimal PATH; Homebrew Node is typically not found.
fn augmented_path_env() -> String {
  let base = std::env::var("PATH").unwrap_or_default();
  #[cfg(target_os = "macos")]
  {
    let extra = [
      "/opt/homebrew/bin",
      "/opt/homebrew/opt/node/bin",
      "/usr/local/bin",
      "/usr/local/opt/node/bin",
    ];
    let mut out = base;
    for e in extra {
      if !out.split(':').any(|p| p == e) {
        if !out.is_empty() {
          out.push(':');
        }
        out.push_str(e);
      }
    }
    log::info!(
      "[desktop] PATH length {} (Homebrew paths prepended for GUI-safe node resolution)",
      out.len()
    );
    out
  }
  #[cfg(not(target_os = "macos"))]
  {
    base
  }
}

fn resolve_node_binary() -> PathBuf {
  let path = augmented_path_env();
  match which::which_in("node", Some(path.as_str()), ".") {
    Ok(p) => {
      log::info!("[desktop] using node binary: {}", p.display());
      p
    }
    Err(e) => {
      log::warn!(
        "[desktop] which(node) failed ({}); falling back to `node` on PATH",
        e
      );
      PathBuf::from("node")
    }
  }
}

fn run_prisma_db_push(server_dir: &Path, database_url: &str, path_env: &str) {
  let node = resolve_node_binary();
  let status = Command::new(&node)
    .current_dir(server_dir)
    .env("PATH", path_env)
    .args([
      "node_modules/prisma/build/index.js",
      "db",
      "push",
      "--skip-generate",
    ])
    .env("DATABASE_URL", database_url)
    .status();
  log::info!("[desktop] prisma db push: {:?}", status);
}

fn wait_for_http_ok(url: &str, timeout: Duration) -> Result<(), String> {
  let start = Instant::now();
  log::info!("[desktop] waiting for HTTP 200 from {} (timeout {:?})", url, timeout);
  while start.elapsed() < timeout {
    match ureq::get(url).call() {
      Ok(resp) => {
        let status = resp.status();
        log::info!("[desktop] GET {} -> HTTP {}", url, status);
        if (200..400).contains(&status) {
          return Ok(());
        }
      }
      Err(e) => {
        log::debug!("[desktop] GET {} not ready yet: {}", url, e);
        thread::sleep(Duration::from_millis(250));
      }
    }
  }
  Err(format!(
    "Timed out after {:?} waiting for HTTP response from {}",
    timeout, url
  ))
}

fn spawn_next_server_logger(mut child: Child) -> Child {
  if let Some(out) = child.stdout.take() {
    thread::spawn(move || {
      for line in BufReader::new(out).lines().flatten() {
        log::info!("[next-server][stdout] {}", line);
      }
    });
  }
  if let Some(err) = child.stderr.take() {
    thread::spawn(move || {
      for line in BufReader::new(err).lines().flatten() {
        log::warn!("[next-server][stderr] {}", line);
      }
    });
  }
  child
}

fn error_page_data_url(message: &str) -> Result<Url, String> {
  let esc = message
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;");
  let html = format!(
    r#"<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>Startup error</title>
<style>body{{font-family:system-ui,-apple-system,sans-serif;padding:24px;background:#0a0a0a;color:#e5e5e5;max-width:720px;line-height:1.5;}}
h1{{color:#f87171;font-size:1.25rem}} code{{background:#171717;padding:2px 6px;border-radius:4px;word-break:break-all;}}
p{{color:#a3a3a3;font-size:0.9rem}}</style></head><body>
<h1>Could not start the Next.js server</h1>
<p><code>{esc}</code></p>
<p>Look for log lines prefixed with <code>[desktop]</code> or <code>[next-server]</code> (e.g. in Terminal if you launched from there).</p>
</body></html>"#
  );
  let b64 = STANDARD.encode(html);
  Url::parse(&format!("data:text/html;base64,{}", b64)).map_err(|e: url::ParseError| e.to_string())
}

fn open_main_window<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  window_config: &tauri::utils::config::WindowConfig,
) -> Result<(), String> {
  log::info!(
    "[desktop] opening main window; webview url = {:?}",
    window_config.url
  );
  WebviewWindowBuilder::from_config(app, window_config)
    .map_err(|e| e.to_string())?
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn open_error_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>, message: &str) -> Result<(), String> {
  let url = error_page_data_url(message)?;
  log::error!("[desktop] showing error webview: {}", message);
  WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
    .title("Job Application Tracker — Error")
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let server_child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
  let server_for_setup = server_child.clone();

  let app = tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .setup(move |app| {
      let handle = app.handle().clone();
      let window_config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or("tauri.conf: missing app.windows[0]")?;

      let resource_dir = handle.path().resource_dir().map_err(|e| e.to_string())?;
      let bundled_dir = resource_dir.join("next-server");
      let bundled_server_js = bundled_dir.join("server.js");
      let use_bundled = bundled_server_js.exists();

      log::info!(
        "[desktop] resource_dir = {}",
        resource_dir.display()
      );
      log::info!(
        "[desktop] bundled Next server = {} (use_bundled = {})",
        bundled_server_js.display(),
        use_bundled
      );

      let path_env = augmented_path_env();

      let result: Result<(), String> = (|| {
        let mut win_cfg = window_config.clone();

        if use_bundled {
          let data_dir = handle.path().app_local_data_dir().map_err(|e| e.to_string())?;
          std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
          let db_path: PathBuf = data_dir.join("job-application-tracker.db");
          let database_url = prisma_db_url_for(&db_path);
          log::info!(
            "[desktop] DATABASE_URL (desktop DB) = file:{}",
            db_path.display()
          );

          run_prisma_db_push(&bundled_dir, &database_url, &path_env);

          let node = resolve_node_binary();
          let mut cmd = Command::new(&node);
          cmd.current_dir(&bundled_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", &path_env)
            .arg("server.js")
            .env("HOSTNAME", "127.0.0.1")
            .env("PORT", NEXT_PORT.to_string())
            .env("DATABASE_URL", &database_url);

          if let Ok(v) = std::env::var("OPENAI_API_KEY") {
            cmd.env("OPENAI_API_KEY", v);
          }

          log::info!(
            "[desktop] spawning Next: cwd={} node={}",
            bundled_dir.display(),
            node.display()
          );

          let child = cmd.spawn().map_err(|e| {
            format!(
              "Failed to spawn `node` for bundled server (is Node.js installed?). {e}"
            )
          })?;
          log::info!("[desktop] Next server PID {}", child.id());
          let child = spawn_next_server_logger(child);
          *server_for_setup.lock().expect("lock server child") = Some(child);

          win_cfg.url = WebviewUrl::External(
            Url::parse(RELEASE_URL).map_err(|e: url::ParseError| e.to_string())?,
          );
          wait_for_http_ok(RELEASE_URL, Duration::from_secs(120))?;
        } else {
          log::info!("[desktop] dev / no bundled server — waiting for {}", DEV_URL);
          win_cfg.url =
            WebviewUrl::External(Url::parse(DEV_URL).map_err(|e: url::ParseError| e.to_string())?);
          wait_for_http_ok(DEV_URL, Duration::from_secs(120))?;
        }

        open_main_window(&handle, &win_cfg)?;
        Ok(())
      })();

      if let Err(e) = result {
        log::error!("[desktop] startup failed: {}", e);
        open_error_window(&handle, &e)?;
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(move |_handle, event| {
    if let RunEvent::Exit = event {
      if let Some(mut child) = server_child.lock().expect("lock server child").take() {
        let _ = child.kill();
        let _ = child.wait();
        log::info!("[desktop] Next server stopped");
      }
    }
  });
}
