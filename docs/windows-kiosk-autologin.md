# Windows-Kiosk-Konto mit Autologin und HA-Display-Autostart

Diese Anleitung beschreibt eine praxistaugliche Kiosk-Basiskonfiguration für die installierte Tauri-App `ha-display` auf Windows.

## 1) Unterstützte Windows-Versionen

- **Unterstützt (Basis-Setup dieser Anleitung):** Windows 10 Pro (22H2), Windows 11 Pro (23H2/24H2), sowie Enterprise/Education.
- **Erweitertes Hardening (optional):** Shell Launcher v2 ist nur in Enterprise/Education verfügbar.
- **Nicht empfohlen:** Windows Home (fehlende Gruppenrichtlinien/Verwaltungsfunktionen für robuste Kiosk-Härtung).

## 2) Kontenmodell (Kiosk + Admin)

1. Lokales Kiosk-Konto anlegen (Beispielname: `ha-kiosk`), **kein** Microsoft-Konto.
2. Sicherstellen, dass `ha-kiosk` nur Mitglied der Gruppe **Users** ist (nicht Administrator).
3. Separates lokales Administrator-Konto für Wartung/Wiederherstellung anlegen (Beispiel: `ha-admin`), starkes Passwort dokumentiert im Betriebshandbuch/Passwortsafe.

PowerShell (als Administrator):

```powershell
net user ha-kiosk "CHANGEME-STRONG-PASSWORD" /add
net localgroup Users ha-kiosk /add
net localgroup Administrators ha-kiosk /delete

net user ha-admin "CHANGEME-STRONG-PASSWORD" /add
net localgroup Administrators ha-admin /add
```

## 3) Zugriff auf Einstellungen/andere Apps einschränken

Auf dem Kiosk-Konto lokale Richtlinien setzen (`gpedit.msc`, falls verfügbar):

- **Benutzerkonfiguration → Administrative Vorlagen → System**
  - `Nur angegebene Windows-Anwendungen ausführen` (Whitelist; mindestens `explorer.exe`, `ha-display.exe` und ggf. Hilfsprozesse).
- **Benutzerkonfiguration → Administrative Vorlagen → Systemsteuerung**
  - `Zugriff auf Systemsteuerung und PC-Einstellungen nicht zulassen` = Aktiviert.
- **Benutzerkonfiguration → Administrative Vorlagen → Startmenü und Taskleiste**
  - Taskleisten-/Kontextmenü-Funktionen nach Bedarf sperren.
- **Benutzerkonfiguration → Administrative Vorlagen → System → Strg+Alt+Entf-Optionen**
  - Task-Manager entfernen (optional, wenn lokale Bedienung stark eingeschränkt werden soll).

> Hinweis: Die exakte Whitelist hängt vom Geräte-Image ab. Vor Ausrollen einmal komplett durchtesten.

## 4) Automatische Anmeldung (Autologin) konfigurieren

Empfohlen: **Sysinternals Autologon** verwenden (Passwort landet nicht als Klartext in einer frei lesbaren UI).

1. Als `ha-admin` anmelden.
2. `Autologon.exe` starten.
3. Benutzer: `.\ha-kiosk`, Domäne: lokaler Rechnername, Passwort des Kiosk-Kontos eintragen.
4. Aktivieren und Gerät neu starten.

Alternativ (klassisch): `netplwiz` → „Benutzer müssen Benutzernamen und Kennwort eingeben“ deaktivieren.

### Sicherheitsfolgen (wichtig)

- Jeder mit physischem Zugriff kann nach dem Booten auf die Kiosk-Sitzung zugreifen.
- Autologin schützt **nicht** vor Offline-Angriffen bei entnehmbarer/ungeschützter SSD.
- Daher zwingend:
  - separates Admin-Konto (`ha-admin`),
  - BIOS/UEFI-Passwort, Secure Boot, BitLocker,
  - eingeschränkte physische Zugänglichkeit.

### Wiederherstellungs-/Admin-Zugang

- Für Wartung mit `Ctrl+Alt+Entf` abmelden und als `ha-admin` anmelden.
- Beim nächsten Neustart meldet Windows wieder automatisch `ha-kiosk` an.
- Falls nötig, Autologin temporär deaktivieren (Autologon-Tool oder `netplwiz`), Wartung durchführen, danach wieder aktivieren.

## 5) Autostart der installierten Tauri-App

Installationspfad der gebündelten App (Standard):

`%LOCALAPPDATA%\Programs\ha-display\ha-display.exe`

Empfohlen: Start **über Aufgabenplanung** (robuster als Autostart-Ordner).

1. Aufgabenplanung öffnen (`taskschd.msc`).
2. Aufgabe `HA Display - Watchdog` erstellen:
   - **Sicherheit**: Ausführen als `ha-kiosk`, nur bei Benutzeranmeldung.
   - **Trigger**: Bei Anmeldung von `ha-kiosk`.
   - **Aktion**: `powershell.exe` mit Argumenten:

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\ha-display\watchdog.ps1"
```

3. Unter **Einstellungen**:
   - „Falls Aufgabe bereits ausgeführt wird“ → **Keine neue Instanz starten**.

## 6) Zuverlässiger Neustart nach Absturz/Beenden (ohne Doppelinstanzen)

Datei `C:\ProgramData\ha-display\watchdog.ps1` anlegen:

```powershell
$ErrorActionPreference = "Stop"
$appPath = "$env:LOCALAPPDATA\Programs\ha-display\ha-display.exe"
$mutex = New-Object System.Threading.Mutex($false, "Global\HA_DISPLAY_WATCHDOG")
$flagFile = "C:\ProgramData\ha-display\pause-watchdog.flag"

if (-not $mutex.WaitOne(0, $false)) { exit 0 }

while ($true) {
  if (Test-Path $flagFile) {
    Start-Sleep -Seconds 2
    continue
  }

  if (-not (Test-Path $appPath)) {
    Start-Sleep -Seconds 5
    continue
  }

  $running = Get-Process -Name "ha-display" -ErrorAction SilentlyContinue
  if (-not $running) {
    Start-Process -FilePath $appPath
    Start-Sleep -Seconds 3
  }

  Start-Sleep -Seconds 2
}
```

Warum keine Doppelinstanzen entstehen:

- Aufgabenplanung ist auf „Keine neue Instanz starten“ gesetzt.
- Das Skript erzwingt zusätzlich eine globale Mutex-Sperre.
- Die App wird nur gestartet, wenn aktuell kein `ha-display`-Prozess läuft.

## 7) Betriebsverhalten / Grenzfälle

- **Home Assistant nicht erreichbar:** Die App startet, `window.location.assign(...)` verweist auf Home Assistant; bei fehlender Erreichbarkeit zeigt die WebView die Browser-/Netzwerkfehlerseite. Nach Netzrückkehr hilft Neuladen oder Prozessneustart (Watchdog).
- **Windows-Neustart/Updates:** Nach Reboot meldet sich `ha-kiosk` automatisch an; die Watchdog-Aufgabe startet die App erneut.
- **Manueller App-Abbruch:** Der Watchdog startet `ha-display` innerhalb weniger Sekunden neu.
- **Gewollte Wartung ohne Autorestart:** Als `ha-admin` Datei `C:\ProgramData\ha-display\pause-watchdog.flag` anlegen, dann App schließen. Nach Wartung Flag-Datei löschen.

## 8) Abnahme-Checkliste

1. Kaltstart: Gerät bootet direkt in `ha-kiosk`, App startet im Vollbild.
2. Prozess im Task-Manager beenden: App startet automatisch neu.
3. Home Assistant kurzzeitig trennen: erwartetes Fehlerbild sichtbar, nach Wiederverbindung wieder bedienbar.
4. Anmeldung als `ha-admin` weiterhin möglich und Wartungszugang vorhanden.
5. Autologin-Risiken dokumentiert und durch Betriebsmaßnahmen mitigiert.
