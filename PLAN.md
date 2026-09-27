# HA Display – erster Setup-Plan

## Ziel des ersten Durchlaufs

Eine Tauri-Anwendung für Windows 11 bauen, die ein Home-Assistant-Dashboard auf einem Tablet als Vollbild-Wall-Display anzeigt. Die erste Version soll bewusst minimal gehalten sein und nur die URL http://homeassistant.local im Browser-View laden.

## Phase 1: Projektstruktur

### Aufgaben

- Repository vorbereiten
- Basisstruktur für Tauri + Lit anlegen
- README und Projektplan ergänzen
- GitHub-Actions-Workflow für Windows vorbereiten

### Ergebnis

- Ein lauffähiges Tauri-Projekt mit Lit-Frontend
- vorbereiteter Windows-Build in der CI-Pipeline

## Phase 2: App-Setup

### Aufgaben

- Vite + Lit Initialisierung
- Tauri in das Projekt integrieren
- eine minimale App mit leerem Layout erstellen
- App so konfigurieren, dass nur eine Webansicht angezeigt wird

### Technische Richtung

- Frontend: Lit
- Desktop: Tauri
- Ziel-URL: http://homeassistant.local
- Startverhalten: Vollbild/Kiosk ohne zusätzliche Fenster-UI

## Phase 3: Home Assistant Display Integration

### Aufgaben

- WebView / Browser-Komponente an die HA-URL binden
- Fenster- und Fullscreen-Settings für Tablets definieren
- lokale URL-Konfiguration vorbereiten
- App-Startverhalten stabilisieren

### Konzepte

- Start direkt mit Dashboard
- kein Standard-UI, nur die gerenderte HA-Seite
- passive Betriebsweise, damit das Display über längere Zeit stabil läuft

## Phase 4: Windows-Build in der Pipeline

### Aufgaben

- GitHub Actions Setup mit windows-latest
- Node.js und Rust installieren
- Abhängigkeiten installieren
- Tauri-Build ausführen
- Artefakte für den Windows-Export speichern

### Beispiel-Workflow

```yaml
name: build-windows

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true

      - name: Install dependencies
        run: npm install

      - name: Build Tauri app
        run: npm run tauri build

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ha-display-windows
          path: src-tauri/target/release
```

## Phase 5: Validierung auf Surface

### Aufgaben

- App auf Surface Book 1 testen
- Änderungen an Fenster- und Kiosk-Verhalten prüfen
- Verfügbarkeit von http://homeassistant.local validieren
- Automatische Start-/Vollbild-Umgebung testen

### Ziel

- App startet zuverlässig und zeigt das HA-Dashboard ohne störende UI-Elemente

## Phase 6: Erweiterung nach PoC

### Geplante Erweiterungen

- Auto-Discovery für Home Assistant
- Konfigurationsoberfläche
- URL-/Display-Einstellungen
- optionales Mute, Sleep, Restart
- spätere Unterstützung weiterer Geräte und Betriebssysteme

## Entscheidungslogik

Der erste Schritt ist bewusst nicht eine komplette HA-Integration. Der Fokus liegt auf:

1. stabiler Tauri-Foundation
2. sauberem Lit-Frontend
3. zuverlässiger App-Visualisierung
4. funktionierender Windows-Build-Pipeline

Erst danach wird die Integration mit Home Assistant und Geräte-Discovery aufgebaut.

## Empfohlener Startbefehl

```bash
npm create vite@latest ha-display -- --template lit
cd ha-display
npm install
npm install @tauri-apps/cli @tauri-apps/api
npx tauri init
```

## Wichtige Hinweise

- Die erste PoC-Version soll modular und klein bleiben.
- Tauri und Lit bilden eine gute Basis für spätere Erweiterungen.
- Home Assistant-Integration kann nach der stabilen App-Foundation hinzugefügt werden.
