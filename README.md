# HA Display

HA Display is a Tauri kiosk app for opening a Home Assistant dashboard. Its HACS custom integration discovers displays over mDNS, pairs each device using the temporary PIN shown on its screen, and centrally manages the dashboard URL.

## Home Assistant integration

1. Add this repository to HACS as a custom integration and install **HA Display**.
2. Restart Home Assistant.
3. Start HA Display on a device on the same local network as Home Assistant.
4. Select the discovered display in Home Assistant and enter the PIN shown on its screen.
5. Open the display's integration options to configure the shared default dashboard URL. An optional URL override applies only to that display.

The shared URL is stored by the integration and used by every paired display that has no per-device override. Changes are sent immediately. Each display keeps its last URL locally and continues to use it while Home Assistant is unavailable.

## Network and security

The app advertises `_ha-display._tcp.local.` and listens on TCP port `8765`. mDNS discovery requires the app and Home Assistant to share a multicast-capable LAN. Routed networks and tailnets may block mDNS; manually routed discovery is not implemented.

The app accepts API traffic only from loopback, private, and link-local addresses. The PIN expires after 15 minutes and is rate limited to five attempts per source address in a five-minute window. A random, device-specific bearer token is issued during pairing and stored in the user's application configuration directory. The dashboard URL and token are written to `display.json`; on Unix-like systems the file is restricted to the current user. Removing the integration entry revokes its token; restart the display app to show a new PIN before pairing it again.

The local API currently uses plain HTTP. The PIN and bearer token are therefore visible to an observer able to capture traffic on the local network. Use this only on a trusted network, do not forward port `8765` from the internet, and use firewall rules to restrict inbound access. HTTPS or certificate pinning is not currently provided.

## Development

- `npm ci && npm run build` builds the frontend.
- `cd src-tauri && cargo test --lib` runs the backend unit tests and compiles the Rust API.
- `python -m compileall custom_components/ha_display` checks the integration's Python syntax.
