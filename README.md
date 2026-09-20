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
BASE_PATH=/NiHao/ npm run build
npm run preview -- --base /NiHao/ --port 4173
```

`check` führt Typecheck, Curriculum-Validierung, Production Build und die Unit-Tests aus. Ohne `BASE_PATH` wird für `/` gebaut. Unterpfade müssen mit `/` beginnen und enden. Hash-Navigation (`#/learn/l01`) vermeidet GitHub-Pages-404s beim Neuladen.

## Auf GitHub Pages veröffentlichen

1. Das Repository ist `11906257/NiHao`. Änderungen auf **main** lösen den Workflow aus.
2. Im Repository **Settings → Pages → Build and deployment → Source: GitHub Actions** auswählen.
3. Der Workflow **Prüfen und GitHub Pages veröffentlichen** läuft bei Push auf `main` und manuell über **Actions → Run workflow**.
4. Er installiert per `npm ci`, prüft Lernlogik und Curriculum, baut für den Test-Unterpfad, führt mobile Chromium-/WebKit-Tests aus und baut anschließend mit dem tatsächlichen Pages-Pfad. `configure-pages`, `upload-pages-artifact` und `deploy-pages` veröffentlichen das statische `dist/`.
5. Die veröffentlichte URL erscheint im Deployment. Aktuell: `https://11906257.github.io/NiHao/`. Root-Repositories und eigene Domains erhalten über `configure-pages` den passenden Basispfad.

Es gibt keinen Server, Login, API-Schlüssel oder Laufzeit-KI-Dienst. Die lokale Prüfung veröffentlicht keine Änderungen. Das Deployment erfolgt über den GitHub-Workflow.

## Auf dem iPhone

Die HTTPS-Adresse in Safari öffnen, **Teilen → Zum Home-Bildschirm** wählen und anschließend über das neue Symbol starten. Beim ersten Laden die App vollständig online laden. Curriculum, Übungen und Lernstand funktionieren dann ohne Netzwerk.

Für Hörübungen muss eine **lokale Mandarin-Systemstimme** verfügbar sein. Unter iOS lässt sie sich in **Einstellungen → Bedienungshilfen → Gesprochene Inhalte / Lesen & Sprechen → Stimmen → Chinesisch** laden. Die Bezeichnung kann je nach iOS-Version abweichen. In der App unter Einstellungen testen. Fehlt die Stimme, bleiben die übrigen Lernbereiche nutzbar. Ein echter Hörtest wird nicht durch sichtbaren Text vorgetäuscht.

Safari und die installierte PWA können getrennte Datenbereiche besitzen. Lernstand dann über **Einstellungen → Export / Import** übertragen. Regelmäßig eine JSON-Sicherung außerhalb der App aufbewahren.

## Tests

```sh
npm test
npm run validate
BASE_PATH=/NiHao/ npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Die Browser-Tests prüfen Lernen, Reload-Persistenz, Backup, Navigation, globale Audiogeschwindigkeit, Light/Dark Mode, 320 px Breite und echte Offline-Nutzung. Die Systemstimme wird für den Tempo-Vertrag simuliert. Klangqualität ist auf dem jeweiligen Gerät zu prüfen.

## Daten und Architektur

- `src/data/official.json`: unabhängige offizielle Referenzlisten mit Seitenangaben und Quellhash.
- `src/data/*.json`: statische eigene Lerninhalte und stabile IDs. IDs niemals für neue Inhalte wiederverwenden.
- `src/lib/scheduler.ts`: FSRS, ein Zustand pro Wort. Getrennte Fähigkeitsstatistiken wählen die Abrufrichtung.
- `src/lib/storage.ts`, `backup.ts`: atomarer IndexedDB-Snapshot, strenge JSON-Validierung und sichtbare Speicherfehler.
- `src/lib/exercises.ts`: gemeinsame Abruf-/Feedbacklogik. Tonzeichen oder Tonziffern bei Pinyin, sinnvolle Synonyme bei freien Antworten.
- `src/components/Navigation.tsx`, `CurriculumCards.tsx`: gemeinsame Navigation und Karten für alle Ansichten.
- `vite.config.ts`: Manifest, Icons und lokaler Precache. Keine externen Fonts oder Laufzeit-Assets.

Die Grammatikzahl bezeichnet 70 Tabellenzeilen, teils mit mehreren Formen. Die App dient dem Lernen und langfristigen Behalten auf Basis des offiziellen HSK 3.0. Sie enthält keine Prüfungssimulation, Prüfungsfragen oder Bestehensprognose.

Beim WebKit-Offlinetest wird ein eigener HTTP-Server mit `Cache-Control: no-store` nach erfolgreichem Precache vollständig gestoppt. Ein ungecachter Abruf muss scheitern. Anschließend müssen Reload und Übung weiter funktionieren. So wird der Service Worker unabhängig von Besonderheiten der WebKit-Netzwerkemulation geprüft.

## Aktueller Funktionsumfang

Ein globales Sprechtempo (Langsam, Normal, Schnell) steuert sämtliche TTS-Ausgaben. `src/lib/audio.ts` ist die einzige Quelle der Tempostufen. Einstellungen, Reload und Backup-Import aktualisieren denselben Wert.

Die anklickbaren Karten Wiederholen und Lernpfad stehen auf kleinen Geräten untereinander. Das 你好-Icon, Blau-/Korall-Tokens und Light/Dark Mode verwenden eine gemeinsame Farbwelt.

Alte lokale Profile und Sicherungen bleiben lesbar. Die entfernte Prüfungshistorie wird bei der Validierung ausgelassen. Lernkarten, FSRS-Zustände, Übungen und Lektionen bleiben erhalten. Neue Sicherungen enthalten kein Prüfungsfeld. Der letzte Exportklick wird lokal gespeichert. Nach einem Monat erinnert die Übersicht an eine Sicherung.

Neue Inhalte werden ausschließlich als vollständige Lektion mit Wörtern, Grammatik und Abrufübungen gelernt. Der Start auf „Heute“ verwendet denselben Ablauf wie der Lernpfad. Es gibt kein Neuwörter-Tageslimit. Die nächste Lektion ist die erste noch nicht abgeschlossene Lektion, unabhängig davon, wie viele Wörter bereits begonnen wurden. Alte Tageslimit-Felder werden beim Laden und Import entfernt.

Wortschatz, Hanzi und Grammatik sind Nachschlagebereiche mit Beispielen, Audio und Lektionenbezug. Grammatik folgt der Lektionenreihenfolge. Aktive Grammatikaufgaben bleiben Teil der Lektionen. Das separate Tontraining und die isolierten Zeichenübungen sind entfernt. Deren alte Statistiken werden beim Laden/Import verworfen. Bei Hanzi zeigt das CircleCheck-Icon, dass bereits ein zugehöriges Wort begonnen wurde.

Automatisch prüfbare Wortantworten verwenden gepflegte Bedeutungsalternativen und begrenzte Schreibvarianten (Groß-/Kleinschreibung, Satzzeichen, optionale Artikel, ae/oe/ue/ss). Falsche Bedeutungen werden nicht durch unscharfe Ähnlichkeit akzeptiert. Nur freie kommunikative Formulierungen werden weiterhin anhand eines Beispiels selbst eingeschätzt. Pinyin unterstützt Tonzeichen, Tonziffern 1–4 und neutral ohne Ziffer bzw. mit 5. Die Vokaltasten bieten die Unicode-Zeichen ā–ù und ǖ/ǘ/ǚ/ǜ sowie unmarkierte Vokale an. Die Tasten erzeugen keine zusätzlichen Silben oder Lerninhalte.

Beim Verlassen einer Einheit bleiben beantwortete Aufgaben gespeichert. Es gibt dafür keinen Bestätigungsdialog. Nur noch ausstehende/fehlgeschlagene Speicherung schützt ein `beforeunload`-Hinweis. Ein Backup-Import bestätigt weiterhin das tatsächliche Überschreiben.

Der Production-Build setzt explizit Safari 15.4 / Chromium 100 als Syntax-Ziel und liefert Source Maps für nachvollziehbare Fehlerpositionen. Das ist keine Aussage über Tests auf jedem älteren Gerät: automatisiert getestet wird die installierte Playwright-WebKit-Version.

## Wartung

`npm run format` formatiert den Quellcode einheitlich. `npm run format:check` prüft ihn ohne Änderungen. Die offiziellen JSON-Daten bleiben dabei unverändert. Themen- und Quellenreferenzen werden bei der Curriculum-Prüfung geladen, nicht von der App-Oberfläche. Lektionsaufgaben werden einmal pro Inhaltsauswahl erzeugt. Unveränderte Tempoeinstellungen unterbrechen keine laufende Wiedergabe.

Die Darstellung verwendet zentrale Design-Tokens in `src/styles.css`: Blau #3B5BDB, Koralle #FF6B6B, Text #111827, Hintergrund #FAF9F6 und weiße Karten. H1/H2/H3 verwenden Manrope mit 44/32/22 px. Fließtext verwendet Inter 400 mit 16 px, Buttons und Labels Inter 600 mit 14 px. Noto Sans SC stellt chinesische Sätze und UI-Texte dar, Ma Shan Zheng einzelne Lernwörter und Zeichen. Alle benötigten WOFF2-Dateien und OFL-Lizenzen liegen lokal. Abstände folgen 8/16/24/40 px. Karten haben 24 px Radius und Padding, Buttons und Inputs 16 px Radius und 48 px Höhe. Dark Mode verwendet dazu passende dunkle Flächen und helle Texte.
