# Schriften der Welt, Übersetzung, Spenden, Kontakt, Admin, Postgres

Auftrag (Simon, 2026-11-03): Krakel & Krone um mehrere Schriften erweitern, umschaltbar über ein
Weltkarten-Feld auf der Startseite (so groß wie eine Spielkachel). Jede Schrift hat ihr **eigenes
Modell**, Schriften werden nie vermischt. In jeder Schrift laufen dieselben Spiele und Animationen wie
heute mit der Druckschrift. Schrift und Sprache werden beim ersten Besuch passend zum Ort vorgewählt.
Die Seite wird in alle sinnvollen Sprachen übersetzt. Nach jedem beendeten Spiel erscheint der
Spendenknopf. Kontaktfeld, Nutzungsstatistik und Admin-Seite mit Postgres, zuerst lokal testbar.

## Schriften (ScriptId)

| id | Name | Zeichen (Klassen) | Lesrichtung | Segmentierung |
|----|------|-------------------|-------------|---------------|
| `druck` | Druckschrift | wie heute `CHARSET` (0-9 A-Z a-z ß) | ltr | `latin` (heute) |
| `grund` | Grundschrift | wie `druck` | ltr | `latin` |
| `schreib` | Schreibschrift (Einzelbuchstaben, SAS/VA/LA) | wie `druck` | ltr | `latin` |
| `hiragana` | Hiragana | 46 Grundzeichen あ…ん | ltr | `block` |
| `katakana` | Katakana | 46 Grundzeichen ア…ン | ltr | `block` |
| `kyrillisch` | Kyrillisch (Russisch) | А–Я, а–я inkl. Ё/ё | ltr | `block` |
| `arabisch` | Arabisch | 28 Buchstaben, isolierte Form | rtl | `block` |
| `devanagari` | Indischer Schriftkreis: Devanagari (Hindi) | 11 Vokale + 33 Konsonanten | ltr | `block` |
| `griechisch` | Griechisch | Α–Ω, α–ω, ς | ltr | `block` |
| `hebraeisch` | Hebräisch | 22 Buchstaben + 5 Endformen | rtl | `block` |
| `hangul` | Hangul | 14 Konsonanten + 10 Vokale (Jamo) + 14 Silben 가…하 | ltr | `block` |
| `thai` | Thailändisch | 44 Konsonanten ก–ฮ | ltr | `block` |

Klassen sind **Strings** (nicht einzelne Codepunkte), die Modelldatei listet sie als Array.

## Modelle (eine Datei-Gruppe pro Schrift)

- `druck` bleibt unter `public/model/glyphnet-v1.*`, `templates-v1.*`, `calib-v1.json` (unverändert).
- Alle anderen: `public/model/<id>/glyphnet-v1.json|bin` und `public/model/<id>/templates-v1.json|bin`.
- Gleiche Architektur (`tools/train/model.py`), gleiches Exportformat wie heute, nur `classes` ist ein
  Array von Strings und es gibt `"script": "<id>"`. Templates: Feld `style` = `"<id>"`.
- Trainingsdaten: frei herunterladbare Handschrift-Datensätze, wo vorhanden (EMNIST für Latein,
  CoMNIST für Kyrillisch, DHCD für Devanagari), sonst synthetisch aus vielen OFL-Schriftarten von
  Google Fonts mit der vorhandenen Augmentierung (Verzerrung, Strichstärke, Lücken).
- Training auf der CPU (keine GPU vorhanden).

## Erkennung im Browser

- `src/recog/scripts.ts`: `ScriptDef` je Schrift (Klassen, Gruppen verwechselbarer Zeichen, Übungs-Sets,
  Lesrichtung, Segmentierung, Modellpfad, Anzeige-Schrift, Latein-Sonderregeln an/aus).
- Recognizer, Templates, Segmentierung bekommen die `ScriptDef` statt fester lateinischer Konstanten.
  Latein-Sonderregeln (Umlautpunkte, Groß/klein über Höhe, Linienzonen, Spiegelschrift) nur bei
  `latin`.
- Segmentierung `block`: Teile eines Zeichens, die nebeneinander oder über/untereinander liegen,
  werden zusammengefasst (い, け, ب, ё …); alle Teile gehen ins Netz.
- Engine lädt das Modell der gewählten Schrift nach (erst wenn sie gewählt wird).

## Startseite

- Neue große Kachel „🌍 Schriften der Welt“ mit Weltkarte (Natural Earth, gemeinfrei); Regionen sind
  antippbar, die gewählte Schrift ist hervorgehoben. Wahl gilt für alle Spiele.
- Erstbesuch: Sprache aus `navigator.languages`, Schrift aus Sprache + Zeitzone (keine Ortung, keine
  Erlaubnis nötig, keine Daten an Dritte).

## Übersetzung

- `src/i18n/`: `t(key, params)`, Kataloge pro Sprache als JSON, Deutsch ist die Quelle.
- Sprachen: de, en, fr, es, it, pt, nl, pl, tr, uk, ru, el, he, ar, hi, th, ko, ja.
- RTL (ar, he): `dir="rtl"` auf `<html>`.
- Sprachaufnahmen gibt es nur auf Deutsch: in anderen Sprachen keine Sprachausgabe.

## Spenden, Kontakt, Statistik, Admin

- Nach jedem beendeten Spiel (Siegerbildschirm, und beim Verlassen eines freien Spiels mit mindestens
  einem Wesen) ein Dankes-Hinweis mit Spendenknopf.
- Kontakt: Formular (Nachricht Pflicht, Name/E-Mail freiwillig), `POST /api/contact`.
- Statistik: anonym, ohne IP, ohne Cookies: `POST /api/event` (Spiel gestartet/beendet, Spielart,
  Schrift, Sprache, Anzahl Zeichen). Tageszähler.
- Admin: `/admin` (eigene Seite), Login über `ADMIN_PASSWORD` (Server-Variable), zeigt Nutzung und
  Nachrichten (gelesen/erledigt markieren).
- Postgres: `DATABASE_URL`; lokal per `docker compose up -d db`. Ohne `DATABASE_URL` läuft die App
  wie bisher, die API antwortet 503.
- Datenschutzerklärung und RECHTLICHES.md um Kontaktformular und Statistik ergänzen.
