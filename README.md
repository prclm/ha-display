# HA Display

Home Assistant Wall Display auf Basis von Tauri für Surface-Tablets und andere kioskartige Endgeräte.

## Ziel

Eine Tauri-Anwendung für Windows 11, die auf Surface-Tablets als Home-Assistant-Wall-Display dient. In der ersten PoC-Phase soll die App nur das Home-Assistant-Dashboard unter http://homeassistant.local anzeigen und dabei als Vollbild-/Kiosk-Anwendung laufen. Später sollen zusätzliche Geräte, Konfigurations-Optionen und eine Home-Assistant-Integration mit Auto-Discovery hinzukommen.

## Projektidee

- Fokus: Microsoft Surface Tablets mit Windows 11
- Initiales Ziel: Surface Book 1 als konkretes Referenzgerät
- Langfristig: Erweiterung auf weitere Geräte und Betriebsysteme
- Technologie: Tauri als App-Framework
- Frontend: Lit, passend zur Home-Assistant-Umgebung
- Ausrichtung: stabile, einfache Anzeige von Dashboards ohne Overhead

## Warum Tauri?

Tauri ist für dieses Projekt gut geeignet, weil es:

- native Windows-Anwendungen mit einem kleinen Paketumfang ermöglicht
- eine einfache, leichtgewichtige Desktop-Umgebung bereitstellt
- auf Tablet- und Kiosk-Szenarien gut passt
- eine gute Grundlage für zukünftige Erweiterungen bildet
- später leicht um Konfigurations- und Discovery-Mechanismen erweitert werden kann

## Warum Lit?

Lit ist eine gute Wahl, weil:

- es leichtgewichtig und performant ist
- es gut zu Home Assistant passt
- es später möglich macht, bestehende Designmuster und Komponenten aus der HA-Welt zu übernehmen
- es für ein kompakte Dashboard-Frontend ideal ist

## Scope der PoC-Phase

Die erste Version soll bewusst klein und klar sein:

- Tauri-App für Windows
- Frontend in Lit
- Anzeige eines externen Home-Assistant-Dashboards unter http://homeassistant.local
- Vollbildmodus / Kiosk-Verhalten
- Ausblenden von Browser-/App-UI, soweit technisch sinnvoll
- Build in CI/CD für Windows
- keine komplexe HA-Integration im ersten Schritt

## Zukunftsvision

Später ist geplant:

- Auto-Discovery einer Home-Assistant-Instanz im lokalen Netzwerk
- Konfigurationsoberfläche für Display-Name, URL, Refresh, Helligkeit, etc.
- Reboot-/Sleep-Verhalten und Geräte-Management
- Erkennung von Tablet-/Display-Umgebungen
- Erweiterung auf andere Endgeräte neben Windows

## Architektur

- Frontend: Lit + Vite
- Desktop-App: Tauri
- Anzeige: WebView mit einem konfigurierten Home-Assistant-URL
- Später: Tauri-Commands / Backend für System- und Gerätefunktionen
- Optional: Home Assistant Integration mit Discovery-Mechanismus

## Anforderungen

### Entwicklungsumgebung

- Node.js LTS
- npm oder pnpm
- Rust stable
- Visual Studio 2022 Build Tools für Windows (für Tauri-Windows-Builds)
- Git

### Zielplattform

- Windows 11
- Surface Book 1 (PoC)
- spätere kompatible Windows-Tablet-Geräte

## Erste Setup-Planung

### 1. Repository vorbereiten

- Git-Repository initialisieren
- Basisstruktur anlegen
- README und Projekt-Plan dokumentieren

### 2. Tauri-Projekt anlegen

Für die erste App-Version wird ein Tauri-Projekt mit Lit-Frontend angelegt.

Beispiel:

```bash
npm create vite@latest ha-display -- --template lit
cd ha-display
npm install
npm install @tauri-apps/cli @tauri-apps/api
```

Danach die Tauri-Integration ergänzen.

### 3. App-Design definieren

- nur ein WebView-Fenster
- keine Menüleiste
- keine Fensterrahmen
- feste Größe oder Vollbildmodus
- automatische Anzeige der HA-URL http://homeassistant.local

### 4. Sicherheits- und Netz-Überlegungen

- lokale Netzwerk-URL ohne Authentifizierung, sofern im lokalen Setup vorgesehen
- später optionaler Token-/Auth-Mechanismus, falls Home Assistant entsprechend konfiguriert ist
- App darf keine zusätzlichen unneeded Browser-Features laden

### 5. Windows-Build in CI vorbereiten

Ziel: Windows-Builds automatisch in der Pipeline erstellen.

Beispielkonzept:

- Runner: windows-latest
- install Rust
- install Node.js
- install dependencies
- `npm run tauri build`
- Artefakt für Windows-Installer und portable Build-Version speichern

## Empfohlene Projektstruktur

```text
ha-display/
├── README.md
├── PLAN.md
├── src/
│   ├── main.js
│   ├── styles.css
│   └── app.js
├── public/
├── package.json
├── vite.config.js
├── tauri.conf.json
├── src-tauri/
│   ├── Cargo.toml
│   ├── src/
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       └── build-windows.yml
└── .gitignore
```

## CI-Philosophie

Die Pipeline soll früh und zuverlässig funktionieren:

- Build auf Windows läuft automatisch
- App muss mit minimalen Abhängigkeiten gebaut werden
- Output sollte als Artefakt verwertbar sein
- später können Tests und Release-Mechanismen ergänzt werden

## Grundsätzliche App-Logik

Die erste App wird im Kern sehr einfach sein:

- beim Start die Home-Assistant-URL laden
- Dashboard in einem Embedded WebView anzeigen
- gewünschte Kiosk-/Display-Einstellungen aktivieren
- ohne zusätzliche Navigationsmöglichkeiten

## Erste technische Annahmen

- Dashboard-URL: http://homeassistant.local
- in der PoC-Phase ohne weitere UI-Elemente
- nur lokale HA-Instanz, kein Cloud-Abgleich notwendig
- Fokus auf Stabilität und einfache Darstellung

## Nächste Schritte

1. Tauri-Projekt initialisieren
2. Lit-Frontend einrichten
3. Dashboard-WebView verbinden
4. Windows-Build in GitHub Actions definieren
5. Erstes Surface-Setup validieren
6. Danach HA-Auto-Discovery und Konfigurationslogik ergänzen

## Hinweis

Dieses Repository ist bewusst als einfache, robuste PoC-Basis angelegt. Die erste funktionierende Version soll ein zuverlässiges Wall Display sein, bevor zusätzliche Home-Assistant-Integration und Geräte-Features implementiert werden.

## Lizenz

Der genaue Lizenztext kann später ergänzt werden. Für die erste Phase ist die Entwicklung als privates Projekt ausreichend.
