# Nǐ Hǎo

Eine private, deutschsprachige Lern-App für **HSK 3.0 Level 1**. Sie führt in kleinen Lektionen durch Wortschatz und Grammatik und unterstützt beim Lesen, Verstehen, Schreiben und Wiederholen.

## Umfang

- 300 Wörter, 246 Schriftzeichen, 70 Grammatikpunkte und 49 Lektionen
- Wortschatz, Zeichen und Grammatik zum Nachschlagen
- Übungen mit Pinyin, Hörverständnis, Satzverständnis und aktiver Formulierung
- Wiederholung mit FSRS-Lernplan und Fortschritt pro Wort
- Einstellungen für Darstellung und Sprechtempo

Die Inhalte orientieren sich am HSK-3.0-Prüfungslehrplan von 2025. Quellen und Abgrenzungen stehen in [SOURCES.md](SOURCES.md). Die App ist eine Lernhilfe, keine Prüfungssimulation.

## Datenschutz und Nutzung

Die App läuft ohne Konto, Server oder externe Laufzeitdienste. Lernstand und Einstellungen bleiben lokal auf dem Gerät. Inhalte, Schriften und die App-Oberfläche können nach dem ersten Laden offline genutzt werden. Der Lernstand kann als Datei exportiert und wieder importiert werden.

Für Hörübungen verwendet die App die Mandarin-Systemstimme des Geräts. Ist keine Stimme verfügbar, bleiben die übrigen Lernbereiche nutzbar.

## Betrieb und Qualität

Die App wird als statische PWA über GitHub Pages veröffentlicht. Änderungen auf `main` durchlaufen Curriculum-Prüfung, Build und mobile Browser-Tests, bevor GitHub Pages aktualisiert wird. Hash-Routen ermöglichen direkte Links und vermeiden Neuladefehler auf GitHub Pages.

Lokale Entwicklung benötigt Node.js 24 und npm:

```sh
npm ci
npm run dev
```

Qualitätsprüfung:

```sh
npm run check
npm run test:e2e
```

## Inhalte und Lernlogik

Die offiziellen Referenzlisten werden unabhängig mitgeliefert und gegen die Lerninhalte geprüft. FSRS plant Wiederholungen pro Wort; getrennte Fähigkeitswerte wählen die nächste Abrufrichtung. Antworten werden mit gepflegten Bedeutungsvarianten und nachvollziehbaren Schreibregeln geprüft. Pinyin akzeptiert Tonzeichen und Tonziffern.

Der Lernstand wird lokal in IndexedDB gespeichert. Sicherungen werden vor dem Import vollständig geprüft; ein Import ersetzt den vorhandenen Lernstand erst nach Bestätigung.
