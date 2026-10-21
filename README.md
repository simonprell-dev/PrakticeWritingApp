# Buchstaben-Zoo 🐠👽🦒

Ein Schreib-Motivationsspiel für die Grundschule. Eine Dokumentenkamera schaut auf das Blatt. Jeder geschriebene Buchstabe und jede Zahl wird zu einem süßen Wesen:

- Schön geschriebene Zeichen werden zu prachtvollen, glitzernden Wesen mit Krone.
- Krakelige Zeichen werden zu zerknitterten, schiefen und lustigen Wesen, aber immer liebenswert und nie beschämend.

Auf dem Bauch jedes Wesens klebt das echte Zeichen des Kindes.

- **Meer, Weltraum, Savanne**: Fische, Aliens oder Tiere sammeln.
  - **Frei schreiben**: jedes Zeichen zählt.
  - **Buchstaben üben**: z. B. „Schreibe 5× das B“. Das Wesen gibt dazu einen Tipp („Bäuche schön zumachen!“, „Ganz langsam und ruhig schreiben.“).
- **Team-Duell**: Zwei Teams schreiben auf kleine Zettel. Die Teams werden an der Stift- oder der Zettelfarbe erkannt.
  - Jedes Zeichen wird zu einer Figur, die zur gegnerischen Seifenblasen-Burg läuft.
  - Schöne Zeichen sind groß und stark. Besiegte Figuren zerplatzen wie Seifenblasen.
  - Gekritzel macht nur „Pfff?“.
  - Am Ende werden das schönste Zeichen und die tapferste Figur jedes Teams gefeiert.

**Datenschutz:**
- Die Handschrift wird **komplett im Browser** ausgewertet.
- Bilder verlassen das Gerät nie und werden nicht gespeichert.
- Gespeichert werden nur die Einstellungen (localStorage).
- Es gibt keine Cookies und keine externen Dienste. Auch die Schriften liegen auf dem eigenen Server.
- Datenschutzerklärung, Impressum und Lizenzhinweise sind in der App eingebaut (`/datenschutz`, `/impressum`, `/lizenzen`).
- Für den legalen Betrieb (Hoster, Auftragsverarbeitung, Pflichtangaben, Schule) siehe **[RECHTLICHES.md](RECHTLICHES.md)**.

---

## Im Unterricht

**Ausstattung**
- Laptop mit Chrome oder Edge
- Beamer
- USB-Dokumentenkamera (jede Webcam geht auch)

**Erster Start:** Der Kamera-Assistent öffnet sich von selbst. Dort:
1. Die Kamera auswählen. Dokumentenkameras werden automatisch bevorzugt.
2. „Drehen“ drücken, bis die Schrift aufrecht steht.
3. Einen Rahmen um das Blatt ziehen.
4. „Testscan“ ausprobieren.

**Scannen**
- Mit dem Knopf **„Fertig!“**, der **Leertaste**, **Enter** oder einem **Presenter-Klicker** (Bild↓ / Pfeil →).
- Optional **automatisch**: Die App scannt, sobald sich unter der Kamera etwas verändert hat und die Hände wieder weg sind (Taste A oder 👁).

**Schon Gescanntes wird erkannt.** Auf demselben Blatt kann einfach weitergeschrieben werden. Mit „Neues Blatt“ (Taste N) gilt alles wieder als neu.

**Tipps für gute Erkennung**
- Filzstift oder weicher Bleistift (B/2B)
- das Licht der Dokumentenkamera einschalten
- etwas Platz zwischen den Zeichen lassen
- im Duell: rote gegen blaue Stifte, Zettel auf einer dunklen Unterlage
- Liniertes Papier und Karopapier werden automatisch erkannt. Die Linien werden vor der Auswertung entfernt.

**Einstellungen**

| Einstellung | Wirkung |
|---|---|
| **Strenge** (leicht / mittel / streng) | wie schnell ein Zeichen „Prachtstück“ wird |
| **Vorlage** (Grundschrift / Druckschrift / beide) | womit die Buchstaben verglichen werden |
| **Wesen gleichzeitig** | wenn es mehr werden, schwimmen die ältesten Wesen weg |

**Tastenkürzel**

| Taste | Funktion |
|---|---|
| Leertaste / Enter / Bild↓ / → | Scannen |
| N | Neues Blatt |
| A | Automatisch scannen |
| F | Vollbild |
| Esc | Menü |

**Offline:** Nach dem ersten Besuch funktioniert die App auch ohne Internet (Service Worker).

---

## Installation & Deployment

### Lokal starten
```bash
npm install
npm run dev          # http://localhost:5173  (Kamera funktioniert auf localhost)
```

### Auf Railway
Railway erkennt das Projekt über `railway.json`:
- Build: `npm run build`
- Start: `node server.js`
- Healthcheck: `/healthz`

1. Das Projekt auf GitHub hochladen.
2. Unter [railway.com](https://railway.com): **New Project → Deploy from GitHub repo**.
3. Im Service: **Settings → Region → EU West (Amsterdam)** wählen (Datenschutz).
4. Im Service: **Variables** mit den Angaben für Impressum und Datenschutz anlegen (`LEGAL_NAME`, `LEGAL_ADDRESS`, `LEGAL_EMAIL`, …), siehe **[RECHTLICHES.md](RECHTLICHES.md)**.
5. Im Service: **Settings → Networking → Generate Domain**. Railway liefert HTTPS; das ist für den Kamerazugriff nötig.
6. Den Auftragsverarbeitungsvertrag (DPA) mit Railway abschließen und die Checkliste in **[RECHTLICHES.md](RECHTLICHES.md)** durchgehen.

Alternativ mit der CLI: `npm i -g @railway/cli`, dann `railway login` und `railway up`.

`server.js` hat keine Abhängigkeiten. Es liefert `dist/` mit gzip, Caching-Headern und einer strengen CSP aus.

---

## Für Entwickler

### Ordner

| Ordner | Inhalt |
|---|---|
| `src/vision/` | Bildverarbeitung in reinem TypeScript (läuft im Web Worker und in Node-Tests) |
| `src/recog/` | Erkennung und Bewertung, Worker |
| `src/game/` | Engine |
| `src/scenes/` | Szenen |
| `src/ui/` | Oberfläche |
| `tools/train/` | Python-Training des Handschrift-Netzes (nicht deployt) |
| `tools/*.ts` | Kalibrierung, Vorschauen, End-to-End-Test |

**Bildverarbeitung (`src/vision/`):**
- Papier- und Zettelerkennung
- Tinte mit Schattenausgleich: `inkness = 1 − min_c(I_c / Hintergrund_c)`
- Hysterese-Schwelle
- Entfernen der Lineatur
- Segmentierung mit i-Punkten und Umlauten
- Teamfarben
- Erkennen schon gescannter Zeichen

**Erkennung und Bewertung (`src/recog/`):**
- CNN-Inferenz (GlyphNet, 71k Parameter, float16)
- Skelett-Chamfer-Vergleich mit Vorlagen in Druckschrift (Andika) und Grundschrift (Playwrite DE Grund)
- Strichqualität und Proportionen werden zu einem Score von 0–100 zusammengerechnet.

**Engine (`src/game/`):** Canvas-2D-Loop, prozedurale Wesen, Partikel, WebAudio-Synth-Töne und die Duell-Simulation.

### Tests & Werkzeuge
```bash
npm test                         # Vision-Pipeline (synthetische Seiten), CNN-Parität, Duell-Balance
npm run lab                      # Labor: Fotos laden, alle Zwischenschritte und Teilscores ansehen
node tools/calibrate.ts          # Score-Verteilung je Qualitätsstufe (zum Einstellen der Strenge)
node tools/preview-creatures.ts  # Vorschau aller Wesen als PNG
node tools/preview-scenes.ts     # Vorschau aller Szenen als PNG
node tools/make-fake-cam.ts && npm run build && node tools/e2e.ts   # End-to-End im echten Chrome
```

### Handschrift-Netz neu trainieren (optional)
```bash
py -3.14 -m venv tools/train/.venv
tools/train/.venv/Scripts/python -m pip install -r tools/train/requirements.txt
cd tools/train
../train/.venv/Scripts/python download_data.py   # EMNIST (Hugging-Face-Spiegel, SHA-256 geprüft) + OFL-Schriften
../train/.venv/Scripts/python train.py           # ca. 1 Std. auf der CPU
../train/.venv/Scripts/python export.py          # -> public/model/glyphnet-v1.*
../train/.venv/Scripts/python make_templates.py  # Vorlagen -> public/model/templates-v1.*
../train/.venv/Scripts/python make_webfonts.py   # Schrift-Subsets -> public/fonts/
```

**Wichtig nach dem Neutraining:** Die Modell-Dateien werden ein Jahr lang gecacht. Deshalb die Version im Dateinamen erhöhen (`-v2`) und die Pfade anpassen:
- `src/recog/engine.ts`
- `public/sw.js`

### Lizenzen
- Schriften: SIL Open Font License 1.1, Lizenztexte in `public/fonts/OFL-*.txt`.
  - Fredoka
  - Playwrite DE Grund
  - „Druckvorlage“: verkleinerte, nach OFL umbenannte Fassung von Andika (SIL International)
- Trainingsdaten: EMNIST (Cohen et al. 2017, NIST), CC BY 4.0. Die Quellenangabe steht im Dialog „Lizenzen“.
