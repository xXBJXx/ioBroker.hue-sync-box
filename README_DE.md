# ioBroker.hue-sync-box

![Logo](admin/hueSyncBox.png)

[![NPM-Version](https://img.shields.io/npm/v/iobroker.hue-sync-box.svg)](https://www.npmjs.com/package/iobroker.hue-sync-box)
[![Tests](https://github.com/xXBJXx/ioBroker.hue-sync-box/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/xXBJXx/ioBroker.hue-sync-box/actions/workflows/test-and-release.yml)

Mit diesem Adapter lässt sich eine Philips Hue Play HDMI Sync Box lokal über ioBroker steuern und überwachen. Unterstützt werden die 4K- und 8K-Modelle. Der Adapter findet Boxen im lokalen Netzwerk und stellt alle Funktionen als States für VIS-2, Skripte und andere ioBroker-Visualisierungen bereit.

English documentation: [README.md](README.md)

## Haftungsausschluss

Alle in diesem Projekt genannten Produkt- und Firmennamen, Logos und Marken gehören ihren jeweiligen Eigentümern. Philips ist eine eingetragene Marke der Koninklijke Philips N.V.; Hue ist eine Marke von Signify. Die Verwendung dient ausschließlich der Identifikation und bedeutet keine Verbindung zu, Unterstützung durch oder Billigung von Koninklijke Philips N.V., Signify Holding B.V., Signify Netherlands B.V. oder deren verbundenen Unternehmen. Dieses private, nicht kommerzielle Projekt wurde ausschließlich zu Freizeitzwecken entwickelt.

## Fehlerberichte mit Sentry

Dieser Adapter verwendet die von ioBroker bereitgestellte Sentry-Integration, um unerwartete Ausnahmen und Programmfehler automatisch an die Entwickler zu melden. Die Fehlerberichterstattung ist seit js-controller Version 3.0 verfügbar und hilft dabei, Fehler zu erkennen und zu beheben, die sonst möglicherweise unentdeckt bleiben würden.

Informationen zu den übertragenen Daten und zum Abschalten der Fehlerberichterstattung enthält die [offizielle ioBroker-Dokumentation zu Sentry](https://github.com/ioBroker/ioBroker.js-controller#error-reporting-via-iobroker-sentry).

## Funktionen

- HDMI-Ausgang und Lichtsynchronisierung ein- oder ausschalten
- HDMI-Eingang, Synchronisierungsmodus und Entertainment-Bereich auswählen
- Helligkeit und modusspezifische Intensität einstellen
- HDMI-Signal, Hue-Bridge-Verbindung, WLAN-Qualität und Geräteinformationen auslesen
- Überhitzung, Unterspannung und Erreichbarkeit anzeigen
- Sync Box sicher suchen und koppeln, ohne den Zugangstoken offenzulegen
- Vorhandene `box_<name>`-Objekt-IDs bei einem Update beibehalten

Der Adapter besitzt bewusst weder einen zusätzlichen Steuerungs-Tab noch eine Seite im Device Manager. Beide wären ebenfalls nur über ioBroker Admin erreichbar und würden dieselben Bedienelemente doppelt anbieten. Die Adaptereinstellungen werden für Suche, Kopplung und Konfiguration verwendet. Für die tägliche Bedienung stehen States bereit, aus denen jeder Benutzer seine gewünschte Oberfläche in VIS-2 oder einem anderen ioBroker-Frontend erstellen kann.

## Voraussetzungen

- Node.js 22.18 oder neuer
- ioBroker js-controller 7.2.2 oder neuer
- ioBroker Admin 8.0.0 oder neuer
- Eine bereits mit der offiziellen Philips-Hue-App eingerichtete Sync Box
- Netzwerkzugriff vom ioBroker-Host auf TCP-Port 443 der Box

## Ersteinrichtung

1. Adapter installieren und eine Instanz anlegen.
2. Die Einstellungen der Instanz öffnen.
3. Die Taste an der Sync Box ungefähr drei Sekunden gedrückt halten. Während der Kopplung muss die LED blinken.
4. **Lokales Netzwerk durchsuchen** auswählen und anschließend bei der gefundenen Box auf **Koppeln** klicken.
5. Falls keine Box gefunden wird, unter **Manuelle Kopplung** ihre IP-Adresse eintragen.
6. Der Adapter speichert die Box und lädt die Einstellungsseite neu. Falls die neuen States nicht automatisch erscheinen, die Instanz neu starten.

Die Suche verwendet mDNS (`_huesync._tcp`). Multicast-Anfragen werden häufig nicht über VLAN-, Docker- oder LXC-Grenzen weitergeleitet. In diesem Fall funktioniert die manuelle Kopplung über die IP-Adresse.

Der Zugangstoken wird verschlüsselt und geschützt in der nativen ioBroker-Konfiguration gespeichert. Er erscheint weder in States noch in Diagnosedaten oder Protokollen.

## States verwenden

Jede konfigurierte Box wird unter `hue-sync-box.<Instanz>.box_<name>` angelegt. Wird ein unterstützter Wert in einen beschreibbaren State geschrieben, sendet der Adapter die Änderung an die Sync Box.

| State                       | Bedeutung                               | Werte/Beispiel                                                  |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `reachable`                 | Box ist erreichbar und authentifiziert  | `true` / `false`                                                |
| `execution.hdmiActive`      | HDMI-Ausgang                            | `true` / `false`                                                |
| `execution.syncActive`      | Lichtsynchronisierung                   | `true` / `false`                                                |
| `execution.mode`            | Synchronisierungsmodus                  | `video`, `game`, `music`, `ambient`, `passthrough`, `powersave` |
| `execution.hdmiSource`      | Aktiver Eingang                         | `input1` bis `input4`                                           |
| `execution.brightness`      | Helligkeitsverstärkung                  | 0–200; 100 ist neutral                                          |
| `execution.hueTarget`       | Entertainment-Bereich                   | von der Box gelieferte Bereichs-ID                              |
| `execution.video.intensity` | Video-Intensität                        | `subtle`, `moderate`, `high`, `intense`                         |
| `execution.game.intensity`  | Spiele-Intensität                       | `subtle`, `moderate`, `high`, `intense`                         |
| `execution.music.intensity` | Musik-Intensität                        | `subtle`, `moderate`, `high`, `intense`                         |
| `hdmi.contentSpecs`         | Informationen zum aktuellen HDMI-Signal | nur lesbar                                                      |
| `device.overheating`        | Temperaturwarnung                       | nur lesbar, sofern unterstützt                                  |
| `device.undervolt`          | Warnung zur Stromversorgung             | nur lesbar, sofern unterstützt                                  |

Weitere States werden nur angelegt, wenn die Box die jeweilige Funktion tatsächlich meldet. Dadurch entstehen bei unterschiedlichen Hardware- und Firmwareständen keine irreführenden Bedienelemente. Die vollständige technische Zuordnung steht in der [Hue-API- und State-Dokumentation](docs/HUE_SYNC_BOX_API.md).

## Einstellungen

- **Execution-Abfrage:** aktualisiert häufig veränderte Steuerwerte; Standard 3 Sekunden.
- **Status-Abfrage:** aktualisiert HDMI- und Hue-Status; Standard 15 Sekunden.
- **Metadaten-Abfrage:** aktualisiert Gerät, Verhalten und Presets; Standard 5 Minuten.
- **IPv4-Schnittstellenpräfix:** begrenzt die Suche bei Bedarf, zum Beispiel auf `192.168.10.`.
- **Unsicheres TLS erlauben:** ausschließlich zur Diagnose. Im normalen Betrieb ausgeschaltet lassen.

## Sicherheit

Normale API-Anfragen prüfen das Zertifikat der Sync Box gegen die Hue-Sync-Box-CA und gleichen die Identität mit der gespeicherten Geräte-ID ab. Authentifizierte HTTPS-Verbindungen verwenden Keep-Alive, acht Sekunden Zeitlimit, maximal ein MiB große Antworten und begrenzte Wiederholungen ausschließlich bei vorübergehenden Netzwerkfehlern.

`allowInsecureTls` ist standardmäßig deaktiviert. Die Option schaltet die Zertifikatsprüfung ab und darf nur kurzfristig zur Fehlersuche verwendet werden.

## Fehlerbehebung

- **Keine Box gefunden:** Prüfen, ob ioBroker und Box im selben Netzwerk sind, mDNS/UDP 5353 erlauben oder manuell koppeln.
- **Kopplung schlägt fehl:** Taste an der Box erneut gedrückt halten und koppeln, während die LED blinkt.
- **Fehler bei der Zertifikatsidentität:** Prüfen, ob die IP-Adresse noch zur gespeicherten Box gehört; nach einer DHCP-Änderung erneut suchen.
- **401 / Authentifizierung abgelehnt:** Box erneut koppeln.
- **API-Level kleiner als 7:** Firmware mit der offiziellen Hue-App aktualisieren.
- **States fehlen:** Adapter nach der Kopplung neu starten und das Instanzprotokoll prüfen.
- **Kein HDMI-Signal:** `hdmi.contentSpecs` und die States `hdmi.input1` bis `hdmi.input4` prüfen.

## Entwicklung

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Lokale Hardwaretests verwenden `HUE_SYNC_BOX_HOST`, `HUE_SYNC_BOX_UNIQUE_ID` und `HUE_SYNC_BOX_TOKEN` als Umgebungsvariablen. Diese Werte niemals committen.

## Lizenz

MIT License

Copyright (c) 2022-2026 Issi <issi.dev.iobroker@gmail.com>
