use axum::{
  Json, Router,
  body::Body,
  extract::{ConnectInfo, State},
  http::{
    HeaderMap, HeaderValue, Method, Request, StatusCode,
    header::{ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS, ACCESS_CONTROL_ALLOW_ORIGIN, AUTHORIZATION, ORIGIN, VARY},
  },
  middleware::{self, Next},
  response::{IntoResponse, Response},
  routing::{get, post, put},
};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use rand::random;
use serde::{Deserialize, Serialize};
use std::{
  collections::HashMap,
  net::{IpAddr, SocketAddr},
  path::PathBuf,
  sync::{Arc, Mutex},
  time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
use url::Url;

const API_PORT: u16 = 8765;
const PIN_TTL: Duration = Duration::from_secs(15 * 60);
const ATTEMPT_WINDOW: Duration = Duration::from_secs(5 * 60);
const MAX_PIN_ATTEMPTS: u8 = 5;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct DisplayConfig {
  device_id: String,
  token: Option<String>,
  dashboard_url: Option<String>,
}

#[derive(Clone)]
struct ApiState {
  config: Arc<Mutex<DisplayConfig>>,
  config_path: PathBuf,
  pin: String,
  pin_created: Instant,
  attempts: Arc<Mutex<HashMap<IpAddr, (u8, Instant)>>>,
  app: AppHandle,
}

#[derive(Deserialize)]
struct PairRequest {
  pin: String,
}

#[derive(Deserialize)]
struct ConfigRequest {
  dashboard_url: String,
}

#[derive(Serialize)]
struct BootstrapResponse {
  device_id: String,
  paired: bool,
  pin: Option<String>,
  dashboard_url: Option<String>,
}

#[derive(Serialize)]
struct InfoResponse {
  device_id: String,
  name: String,
  version: &'static str,
}

#[derive(Serialize)]
struct PairResponse {
  token: String,
}

fn config_is_valid_url(value: &str) -> bool {
  Url::parse(value)
    .map(|url| {
      matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
    })
    .unwrap_or(false)
}

fn is_lan_address(ip: IpAddr) -> bool {
  match ip {
    IpAddr::V4(ip) => ip.is_private() || ip.is_loopback() || ip.is_link_local(),
    IpAddr::V6(ip) => {
      ip.is_loopback()
        || ip.is_unicast_link_local()
        || (ip.segments()[0] & 0xfe00) == 0xfc00
    }
  }
}

fn generate_token() -> String {
  random::<[u8; 32]>()
    .iter()
    .map(|byte| format!("{byte:02x}"))
    .collect()
}

fn save_config(path: &PathBuf, config: &DisplayConfig) -> Result<(), std::io::Error> {
  let bytes = serde_json::to_vec(config).map_err(std::io::Error::other)?;
  std::fs::write(path, bytes)?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
  }
  Ok(())
}

async fn cors(request: Request<Body>, next: Next) -> Response {
  let origin = request
    .headers()
    .get(ORIGIN)
    .and_then(|value| value.to_str().ok())
    .filter(|origin| {
      matches!(
        *origin,
        "tauri://localhost"
          | "http://tauri.localhost"
          | "https://tauri.localhost"
          | "http://localhost:5173"
          | "http://127.0.0.1:5173"
      )
    })
    .map(str::to_owned);
  let mut response = next.run(request).await;
  if let Some(origin) = origin {
    if let Ok(value) = HeaderValue::from_str(&origin) {
      let headers = response.headers_mut();
      headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, value);
      headers.insert(
        ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, OPTIONS"),
      );
      headers.insert(
        ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("authorization, content-type"),
      );
      headers.insert(VARY, HeaderValue::from_static("Origin"));
    }
  }
  response
}

async fn preflight() -> StatusCode {
  StatusCode::NO_CONTENT
}

async fn info(
  State(state): State<ApiState>,
  ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Result<Json<InfoResponse>, StatusCode> {
  if !is_lan_address(peer.ip()) {
    return Err(StatusCode::FORBIDDEN);
  }
  let config = state.config.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
  Ok(Json(InfoResponse {
    device_id: config.device_id.clone(),
    name: "HA Display".to_owned(),
    version: env!("CARGO_PKG_VERSION"),
  }))
}

async fn bootstrap(
  State(state): State<ApiState>,
  ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Result<Json<BootstrapResponse>, StatusCode> {
  if !peer.ip().is_loopback() {
    return Err(StatusCode::FORBIDDEN);
  }
  let config = state.config.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
  let paired = config.token.is_some();
  let pin = (!paired && state.pin_created.elapsed() < PIN_TTL).then(|| state.pin.clone());
  Ok(Json(BootstrapResponse {
    device_id: config.device_id.clone(),
    paired,
    pin,
    dashboard_url: config.dashboard_url.clone(),
  }))
}

async fn pair(
  State(state): State<ApiState>,
  ConnectInfo(peer): ConnectInfo<SocketAddr>,
  Json(request): Json<PairRequest>,
) -> Result<Json<PairResponse>, StatusCode> {
  if !is_lan_address(peer.ip()) {
    return Err(StatusCode::FORBIDDEN);
  }
  if state.pin_created.elapsed() >= PIN_TTL {
    return Err(StatusCode::GONE);
  }
  let now = Instant::now();
  let mut attempts = state.attempts.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
  let entry = attempts.entry(peer.ip()).or_insert((0, now));
  if now.duration_since(entry.1) >= ATTEMPT_WINDOW {
    *entry = (0, now);
  }
  if entry.0 >= MAX_PIN_ATTEMPTS {
    return Err(StatusCode::TOO_MANY_REQUESTS);
  }
  let mut config = state.config.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
  if config.token.is_some() {
    return Err(StatusCode::CONFLICT);
  }
  if request.pin != state.pin {
    entry.0 += 1;
    entry.1 = now;
    return Err(StatusCode::UNAUTHORIZED);
  }
  let token = generate_token();
  config.token = Some(token.clone());
  if save_config(&state.config_path, &config).is_err() {
    config.token = None;
    return Err(StatusCode::INTERNAL_SERVER_ERROR);
  }
  attempts.remove(&peer.ip());
  Ok(Json(PairResponse { token }))
}

async fn update_config(
  State(state): State<ApiState>,
  ConnectInfo(peer): ConnectInfo<SocketAddr>,
  headers: HeaderMap,
  Json(request): Json<ConfigRequest>,
) -> Result<StatusCode, StatusCode> {
  if !is_lan_address(peer.ip()) {
    return Err(StatusCode::FORBIDDEN);
  }
  let supplied_token = headers
    .get(AUTHORIZATION)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.strip_prefix("Bearer "))
    .ok_or(StatusCode::UNAUTHORIZED)?;
  let mut config = state.config.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
  if config.token.as_deref() != Some(supplied_token) {
    return Err(StatusCode::UNAUTHORIZED);
  }
  let dashboard_url = request.dashboard_url.trim();
  if !config_is_valid_url(dashboard_url) {
    return Err(StatusCode::BAD_REQUEST);
  }
  config.dashboard_url = Some(dashboard_url.to_owned());
  if save_config(&state.config_path, &config).is_err() {
    return Err(StatusCode::INTERNAL_SERVER_ERROR);
  }
  let url = Url::parse(dashboard_url).map_err(|_| StatusCode::BAD_REQUEST)?;
  if let Some(window) = state.app.get_webview_window("main") {
    window.navigate(url).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
  }
  Ok(StatusCode::NO_CONTENT)
}

fn start_discovery(device_id: String) {
  std::thread::spawn(move || {
    let daemon = match ServiceDaemon::new() {
      Ok(daemon) => daemon,
      Err(error) => {
        log::error!("Could not start HA Display mDNS discovery: {error}");
        return;
      }
    };
    let service_name = format!("HA Display {device_id}");
    let host_name = format!("ha-display-{device_id}.local.");
    let properties = [("id", device_id.as_str()), ("version", env!("CARGO_PKG_VERSION"))];
    let service = match ServiceInfo::new(
      "_ha-display._tcp.local.",
      &service_name,
      &host_name,
      "",
      API_PORT,
      &properties[..],
    ) {
      Ok(service) => service.enable_addr_auto(),
      Err(error) => {
        log::error!("Could not register HA Display mDNS service: {error}");
        return;
      }
    };
    if let Err(error) = daemon.register(service) {
      log::error!("Could not advertise HA Display over mDNS: {error}");
      return;
    }
    if let Ok(monitor) = daemon.monitor() {
      while monitor.recv().is_ok() {}
    }
  });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let config_dir = app.path().app_config_dir()?;
      std::fs::create_dir_all(&config_dir)?;
      let config_path = config_dir.join("display.json");
      let mut config = std::fs::read(&config_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<DisplayConfig>(&bytes).ok())
        .unwrap_or_default();
      if config.device_id.is_empty() {
        config.device_id = format!("{:08x}", random::<u32>());
      }
      save_config(&config_path, &config)?;

      let state = ApiState {
        config: Arc::new(Mutex::new(config.clone())),
        config_path,
        pin: format!("{:08}", random::<u32>() % 100_000_000),
        pin_created: Instant::now(),
        attempts: Arc::new(Mutex::new(HashMap::new())),
        app: app.handle().clone(),
      };
      let router = Router::new()
        .route("/api/info", get(info).options(preflight))
        .route("/api/bootstrap", get(bootstrap).options(preflight))
        .route("/api/pair", post(pair).options(preflight))
        .route("/api/config", put(update_config).options(preflight))
        .layer(middleware::from_fn(cors))
        .with_state(state);

      let listener = std::net::TcpListener::bind(("0.0.0.0", API_PORT))?;
      listener.set_nonblocking(true)?;
      let listener = tokio::net::TcpListener::from_std(listener)?;
      tauri::async_runtime::spawn(async move {
        if let Err(error) = axum::serve(
          listener,
          router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        {
          log::error!("HA Display local API stopped: {error}");
        }
      });
      start_discovery(config.device_id);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building Tauri application");
}

#[cfg(test)]
mod tests {
  use super::{config_is_valid_url, is_lan_address};
  use std::net::IpAddr;

  #[test]
  fn accepts_http_and_https_dashboard_urls_without_credentials() {
    assert!(config_is_valid_url("http://homeassistant.local:8123/lovelace"));
    assert!(config_is_valid_url("https://ha.example.test/dashboard"));
    assert!(!config_is_valid_url("file:///etc/passwd"));
    assert!(!config_is_valid_url("javascript:alert(1)"));
    assert!(!config_is_valid_url("******ha.local:8123"));
    assert!(!config_is_valid_url("not a URL"));
  }

  #[test]
  fn permits_loopback_and_private_network_clients_only() {
    assert!(is_lan_address("127.0.0.1".parse::<IpAddr>().unwrap()));
    assert!(is_lan_address("192.168.1.20".parse::<IpAddr>().unwrap()));
    assert!(is_lan_address("10.0.0.8".parse::<IpAddr>().unwrap()));
    assert!(is_lan_address("fd00::1".parse::<IpAddr>().unwrap()));
    assert!(!is_lan_address("8.8.8.8".parse::<IpAddr>().unwrap()));
    assert!(!is_lan_address("2001:4860:4860::8888".parse::<IpAddr>().unwrap()));
  }
}
