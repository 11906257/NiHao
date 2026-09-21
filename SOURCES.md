# Quellen und Entscheidungen

Verifiziert am **12. September 2026**. Die App bildet ausschließlich Level 1 des neuen konkreten HSK-Prüfungslehrplans ab. Die deutschen Erklärungen, Übersetzungen, Beispielsätze und Übungen sind eigene Lerninhalte.

## Maßgeblicher offizieller Lehrplan

Die [CTI-Seite „Examination Syllabus“](https://www.chinesetest.cn/syllabus) verlinkt den [neuen HSK Exam Syllabus, Fassung 1219](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf). Titelseite: veröffentlicht November 2025, Umsetzung Juli 2026. Herausgeber: Center for Language Education and Cooperation. SHA-256 und die vollständigen unabhängigen Soll-Listen stehen in `src/data/official.json`.

| Inhalt         | Abgrenzung                                     | Gedruckte Seiten / PDF-Seiten |
| -------------- | ---------------------------------------------- | ----------------------------- |
| Wortschatz     | 300 nummerierte Einträge                       | 77–84 / 80–87                 |
| Hanzi erkennen | 246 nummerierte Zeichen                        | 353–354 / 356–357             |
| Grammatik      | 70 sichtbare Tabellenzeilen (27 + 31 + 12)     | 383–385 / 386–388             |
| Themen         | 5 Haupt-, 15 Unter-, 30 Blattthemen            | 56–57 / 59–60                 |
| Kommunikation  | 15 Bereiche, 59 Kompetenz-Aufzählungspunkte    | 2–5 / 5–8                     |
| Schreiben      | Gemeinsame Liste mit 100 Zeichen für Level 1–2 | 374 / 377                     |

**70 und 59 sind dokumentierte Zählungen der Quellenstruktur**, keine dort gedruckten pauschalen Kompetenzzahlen. Einzelne Grammatikzeilen bündeln Formen. Jede Zeile hat eine Lernkarte und Übung. Aufgabenkompetenzen und Themen sind einzeln erfasst und Lektionen zugeordnet. Die gemeinsame Schreibzeichenliste ist nicht gleichbedeutend mit einer Level-1-Schreibprüfung. Level 1 prüft Hören und Lesen. Das [offizielle Competency Profile](https://hsk.cn-bj.ufileos.com/3.0/HSK3.0%E8%80%83%E8%AF%95%E8%83%BD%E5%8A%9B%E6%8F%8F%E8%BF%B0.pdf) beschreibt einfache Kommunikation in Alltagssituationen.

### Auflösung widersprüchlicher Angaben

Der [amtliche Standard GF0025—2021](https://hudong.moe.gov.cn/jyb_sjzl/ziliao/A19/202111/W020211118507389477190.pdf), Druckseite 1/PDF-Seite 7, nennt für seine Stufe 1 unter anderem **500 Wörter, 300 Hanzi, 48 Grammatikpunkte**. Er ist ein übergreifender Kompetenzstandard. Die neuere konkrete Prüfungsliste ist anders abgegrenzt und hat Vorrang. [CLEC erläutert die gesonderte Anpassung des Prüfungssystems](https://www.chinese.cn/zhuanti/202107/). Die App importiert keine Legacy-Lernliste. Identische Wörter können natürlich Teil beider offiziellen Stufen sein.

Die jüngste [CTI-Ankündigung zum weltweiten Start](https://admin.chinesetest.cn/gonewcontent.do?id=51336883) nennt **13. Dezember 2026**. Deshalb wird das aufgedruckte Umsetzungsdatum Juli nicht als bereits erfolgter weltweiter Prüfungsstart ausgegeben. Die [zweite weltweite Erprobung](https://admin.chinesetest.cn/gonewcontent.do?id=51236758) ist für 20. September 2026 angekündigt.

## Lernprinzipien

| Prinzip                        | Evidenz                                                                                                                                                                                    | Konkrete Umsetzung                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aktives Erinnern               | [Roediger & Karpicke 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x), [McDermott 2021, Review](https://www.annualreviews.org/content/journals/10.1146/annurev-psych-010419-051019) | Erst Antwort erzeugen, dann Feedback. Freie Bedeutung, Form, Pinyin, Hörabruf und Kontext.                                                       |
| Verteilte Wiederholung         | [Cepeda et al. 2006, Meta-Analyse](https://digitalcommons.usf.edu/psy_facpub/1771/), [Pavlik & Anderson 2005, Wortschatzexperiment](https://pubmed.ncbi.nlm.nih.gov/21702785/)             | Adaptive Fälligkeiten. Wiederholungen vor neuen Lektionen.                                                                                       |
| Korrektives Feedback           | [Butler & Roediger 2008](https://pubmed.ncbi.nlm.nih.gov/18491500/)                                                                                                                        | Richtige Antwort mit Erklärung. Fehler später in der Einheit und früher im Zeitplan erneut abrufen.                                              |
| Gezieltes Mischen              | [Brunmair & Richter 2019, Meta-Analyse](https://pubmed.ncbi.nlm.nih.gov/31556629/)                                                                                                         | Nutzen hängt vom Material ab, bei Wortmaterial Vorteil geblockter Einführung. Daher thematische Erstlektionen und spätere gezielte Abrufwechsel. |
| Hilfen und kognitive Belastung | [IES Practice Guide, Pashler et al. 2007](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)                                                                                                     | Kleine Portionen, Beispiele, Pinyin beim Kennenlernen und später auf Wunsch. Kein ablenkendes Belohnungssystem.                                  |

[ts-fsrs-Dokumentation](https://open-spaced-repetition.github.io/ts-fsrs/) und [Quellcode](https://github.com/open-spaced-repetition/ts-fsrs): Zielretention 0,90, keine selbst erfundenen festen Intervalle. Ein Zustand pro Wort plus getrennte Fähigkeitszählwerte vermeidet fünf parallele Kartenstapel. Die Forschung stützt die Prinzipien, nicht einen Wirksamkeitsnachweis dieser konkreten App.

## Technische Primärquellen

[GitHub Pages: eigene Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite: statisches Deployment](https://vite.dev/guide/static-deploy), [Vite PWA](https://vite-pwa-org.netlify.app/guide/). Die App liefert alle Kernressourcen lokal aus. Audio verwendet ausschließlich vom Browser als lokal ausgewiesene Mandarin-Systemstimmen. Keine externen TTS-Aufnahmen oder kommerziellen Lehrbuchinhalte werden mitgeliefert.

Neue Inhalte werden ausschließlich als vollständige Lektion mit Wörtern, Grammatik und Abrufübungen gelernt. Der Start auf „Heute“ führt zur nächsten Lektion. Es gibt kein Neuwörter-Tageslimit. Die nächste Lektion ist die erste noch nicht abgeschlossene Lektion, unabhängig davon, wie viele Wörter bereits begonnen wurden.

### Pinyin-Eingabezeichen

Die ü-Tonzeichen ǖ, ǘ, ǚ, ǜ sind in der [Unicode-Zeichenliste Latin Extended-B](https://www.unicode.org/charts/nameslist/n_0180.html) unter U+01D6, U+01D8, U+01DA und U+01DC dokumentiert. Die Tastatur gruppiert gültige Vokalzeichen. Sie behauptet nicht, dass jede Kombination aus beliebiger Silbe und Ton ein Mandarin-Wort bildet. Unmarkierte Vokale bleiben für Neutralton und normale Eingabe verfügbar.
