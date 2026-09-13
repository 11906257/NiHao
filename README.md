# Nǐ Hǎo — HSK 3.0 Level 1

Eine private, statische Lern-PWA auf Deutsch: 300 Wörter, 246 Erkennungszeichen, 49 thematische Lektionen, 70 Grammatik-Lernpunkte, 30 Themen und 59 kommunikative Teilkompetenzen. Grundlage ist der **neue Prüfungslehrplan von 2025**, nicht die 500-Wörter-Abgrenzung des Kompetenzstandards von 2021. Quellen und offene Abgrenzungen stehen in [SOURCES.md](SOURCES.md).

## Lokal starten

Node.js 24 LTS und npm verwenden:

```sh
npm ci
npm run dev
```

Die ausgegebene lokale Adresse öffnen. Die Entwicklungsansicht registriert keinen Service Worker.

```sh
npm run check
BASE_PATH=/chinese/ npm run build
npm run preview -- --base /chinese/ --port 4173
```

`check` führt Typecheck, Curriculum-Validierung, Production Build und die Unit-Tests aus. Ohne `BASE_PATH` wird für `/` gebaut. Unterpfade müssen mit `/` beginnen und enden. Hash-Navigation (`#/learn/l01`) vermeidet GitHub-Pages-404s beim Neuladen.

## Auf GitHub Pages veröffentlichen

1. Ein GitHub-Repository anlegen und den Inhalt dieses Ordners auf den Branch **main** pushen. Noch ist kein GitHub-Remote eingerichtet.
2. Im Repository **Settings → Pages → Build and deployment → Source: GitHub Actions** auswählen.
3. Der Workflow **Prüfen und GitHub Pages veröffentlichen** läuft bei Push auf `main` und manuell über **Actions → Run workflow**.
4. Er installiert per `npm ci`, prüft Lernlogik und Curriculum, baut für den Test-Unterpfad, führt mobile Chromium-/WebKit-Tests aus und baut anschließend mit dem tatsächlichen Pages-Pfad. `configure-pages`, `upload-pages-artifact` und `deploy-pages` veröffentlichen das statische `dist/`.
5. Die veröffentlichte URL erscheint im Deployment. Typisch: `https://USERNAME.github.io/REPOSITORY/`. Root-Repositories und eigene Domains erhalten über `configure-pages` den passenden Basispfad.

Es gibt keinen Server, Login, API-Schlüssel oder Laufzeit-KI-Dienst. Der Workflow wurde lokal hinsichtlich Build und Tests geprüft; ein echtes GitHub-Deployment setzt dein Repository und aktivierte Pages voraus.

## Auf dem iPhone

Die HTTPS-Adresse in Safari öffnen, **Teilen → Zum Home-Bildschirm** wählen und anschließend über das neue Symbol starten. Beim ersten Laden die App vollständig online laden . Curriculum, Übungen und Lernstand funktionieren dann ohne Netzwerk.

Für Hörübungen muss eine **lokale Mandarin-Systemstimme** verfügbar sein. Unter iOS lässt sie sich in **Einstellungen → Bedienungshilfen → Gesprochene Inhalte / Lesen & Sprechen → Stimmen → Chinesisch** laden; die Bezeichnung kann je nach iOS-Version abweichen. In der App unter Einstellungen testen. Fehlt die Stimme, bleiben die übrigen Lernbereiche nutzbar; ein echter Hörtest wird nicht durch sichtbaren Text vorgetäuscht.

Safari und die installierte PWA können getrennte Datenbereiche besitzen. Lernstand dann über **Einstellungen → Export / Import** übertragen. Regelmäßig eine JSON-Sicherung außerhalb der App aufbewahren.

## Tests

```sh
npm test
npm run validate
BASE_PATH=/chinese/ npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Die Browser-Tests prüfen Lernen, Reload-Persistenz, Backup, Navigation, globale Audiogeschwindigkeit, Light/Dark Mode, 320 px Breite und echte Offline-Nutzung. Die Systemstimme wird für den Tempo-Vertrag simuliert; Klangqualität ist auf dem jeweiligen Gerät zu prüfen.

## Daten und Architektur

- `src/data/official.json`: unabhängige offizielle Referenzlisten mit Seitenangaben und Quellhash.
- `src/data/*.json`: statische eigene Lerninhalte und stabile IDs. IDs niemals für neue Inhalte wiederverwenden.
- `src/lib/scheduler.ts`: FSRS, ein Zustand pro Wort; getrennte Fähigkeitsstatistiken wählen die Abrufrichtung.
- `src/lib/storage.ts`, `backup.ts`: atomarer IndexedDB-Snapshot, strenge JSON-Validierung und sichtbare Speicherfehler.
- `src/lib/exercises.ts`: gemeinsame Abruf-/Feedbacklogik; Tonzeichen oder Tonziffern bei Pinyin, sinnvolle Synonyme bei freien Antworten.
- `vite.config.ts`: Manifest, Icons und lokaler Precache. Keine externen Fonts oder Laufzeit-Assets.

Die Grammatikzahl bezeichnet 70 Tabellenzeilen, teils mit mehreren Formen. Die App dient dem Lernen und langfristigen Behalten auf Basis des offiziellen HSK 3.0. Sie enthält keine Prüfungssimulation, Prüfungsfragen oder Bestehensprognose.

Beim WebKit-Offlinetest wird ein eigener HTTP-Server mit `Cache-Control: no-store` nach erfolgreichem Precache vollständig gestoppt. Ein ungecachter Abruf muss scheitern; anschließend müssen Reload und Übung weiter funktionieren. So wird der Service Worker unabhängig von Besonderheiten der WebKit-Netzwerkemulation geprüft.

## Aktueller Funktionsumfang

Ein globales Sprechtempo (Langsam, Normal, Schnell) steuert sämtliche TTS-Ausgaben. `src/lib/audio.ts` ist die einzige Quelle der Tempostufen; Einstellungen, Reload und Backup-Import aktualisieren denselben Wert.

Die drei Tagesübersichten sind auf kleinen Geräten untereinander angeordnet. Das 你好-Icon, warme Rot-/Gold-Tokens und Light/Dark Mode verwenden eine gemeinsame Farbwelt.

Alte lokale Profile und Sicherungen bleiben lesbar. Die entfernte Prüfungshistorie wird bei der Validierung ausgelassen; Lernkarten, FSRS-Zustände, Übungen und Lektionen bleiben erhalten. Neue Sicherungen enthalten kein Prüfungsfeld. Der letzte Exportklick wird lokal gespeichert; nach einem Monat erinnert die Übersicht an eine Sicherung.

Neue Inhalte werden ausschließlich als vollständige Lektion mit Wörtern, Satzmustern und Abrufübungen gelernt. Der Start auf „Heute“ verwendet denselben Ablauf wie der Lernpfad. Es gibt kein Neuwörter-Tageslimit. Die nächste Lektion ist die erste noch nicht abgeschlossene Lektion, unabhängig davon, wie viele Wörter bereits begonnen wurden. Alte Tageslimit-Felder werden beim Laden und Import entfernt.
