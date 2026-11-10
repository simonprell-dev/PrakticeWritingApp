# Trainingsdaten für den deutschen Raum – Analyse

Stand 10.11.2026. Ziel ist, die Erkennung der lateinischen Schriften (Druckschrift, Grundschrift, Schreibschrift: 63 Klassen `0–9 A–Z a–z ß`) für **Kinderhandschrift in Deutschland** zu verbessern.

## Ausgangslage

| Modell | Echte Handschrift | Synthetisch |
|---|---|---|
| Druckschrift (`train.py`) | EMNIST byclass: Erwachsene, USA (Volkszählungsbögen) | 21 handschriftähnliche Schriftarten |
| Grundschrift, Schreibschrift (`train_script.py`) | EMNIST | Google-Fonts inkl. Playwrite DE Grund, DE LA, DE SAS, DE VA |

Was dabei fehlt:

- **Kinderschrift.** EMNIST stammt von Erwachsenen. Kinder schreiben wackliger, größer und kleiner durcheinander, mit Lücken und Überschwüngen an den Strichenden.
- **Deutsche Formen.** Ziffern sind amerikanisch: eine „1“ ohne Aufstrich, eine „7“ ohne Querstrich. Die Richtformen der Druckschrift nach dem bayerischen LehrplanPLUS kennt nur die App selbst, als Strichfolgen der Schreibanimation.
- **ß.** Das Zeichen kommt in keinem Datensatz echter Handschrift vor und wird bisher nur aus Schriftarten gelernt.
- **Umlaute.** Sie werden über den Grundbuchstaben plus die erkannten Punkte gelesen und sind deshalb keine eigene Klasse. Echte Proben helfen hier vor allem beim Grundbuchstaben.

## Öffentliche Quellen

| Quelle | Inhalt | Lizenz | Bewertung |
|---|---|---|---|
| [kensanata/numbers](https://github.com/kensanata/numbers), Teil 1 | 16.994 handgeschriebene Ziffern im europäischen Stil (1 mit Aufstrich, 7 mit Querstrich), 29 Personen, v. a. Schweiz, auch AT, IT, PL | **CC0** (frei, auch kommerziell) | **Passt – eingebaut** (`--numbers`). Teil 2 (800.000 automatisch ausgeschnittene Ziffern) ist laut Projekt oft falsch beschriftet oder gedruckt und wird nicht verwendet. |
| [CVL-Database (TU Wien)](https://cvl.tuwien.ac.at/research/cvl-databases/an-off-line-database-for-writer-retrieval-writer-identification-and-word-spotting/) | Texte von 310 Erwachsenen, u. a. ein deutscher Text, mit Wortrahmen | CC BY-NC 3.0 | Nicht verwendet: nur nicht-kommerziell (der Betreiber ist ein Unternehmen), Wörter statt Einzelbuchstaben, Erwachsene. |
| [fhswf/german_handwriting](https://huggingface.co/datasets/fhswf/german_handwriting) (Hugging Face) | ≈ 10.900 Zeilen deutscher Handschrift von 15 Erwachsenen | AFL-3.0 | Später vielleicht für das Schreibschrift-Modell. Dafür müssten die Zeilen erst in Buchstaben zerlegt werden; das ist aufwendig und fehleranfällig. |
| [IntuiScript – Children Handwritings Database (IRISA)](https://www-intuidoc.irisa.fr/en/children-handwritings-database/) | 27.000 Schreibschrift-Buchstaben von 147 Kindern (3–7 Jahre), auf dem Tablet geschrieben | frei für die Forschung | Nicht verwendet: französische Schreibschrift, nur Forschung. |
| Hijja (Arabisch), BPS2025 (Bangla) | Einzelbuchstaben von Schulkindern | verschieden | Nicht für Deutsch. Hijja wäre ein Kandidat für das arabische Modell. |
| EMNIST / NIST SD19 | Erwachsene, USA | frei | Schon im Training. |

**Ergebnis:** Einen öffentlichen Datensatz mit deutscher Kinderhandschrift als Einzelbuchstaben gibt es nicht. Auch für deutsche Erwachsenenschrift gibt es keinen frei nutzbaren als Einzelbuchstaben. Die größten Hebel sind deshalb eigene Daten und eine Synthese, die sich an den deutschen Schulformen orientiert.

## Umgesetzt

### 1. Schriftproben aus der App (der wichtigste Hebel)

Die App sieht täglich genau die Daten, die gebraucht werden: deutsche Kinderschrift, auf Papier, mit der Kamera aufgenommen. Diese Proben sind jetzt so erfassbar:

- **Sammeln während der Stunde.** Jeder neu erkannte Buchstabe wird gemerkt (`src/app/samples.ts`): der transparente Tinten-Ausschnitt, die Reihenfolge des Schreibens, das Foto, auf dem er stand, die Lage auf dem Blatt und was er ist. Kamerafotos und Namen werden nie gemerkt.
- **Beschriftung ohne Handarbeit:**
  - **wort (sicher):** Im Wörter-Zoo stand das ganze Wort richtig da, also ist jeder Buchstabe bekannt.
  - **uebung (ziemlich sicher):** Übungsbuchstabe, und die Erkennung war derselben Meinung.
  - **erkannt (prüfen):** nur die Vermutung der Erkennung. Gerade die Fälle, in denen die Erkennung danebenlag, sind die wertvollsten; der Übungsbuchstabe steht dabei, damit man sie schnell beschriften kann.
- **Nach der Stunde** fragt die App „Schriftproben spenden?“ und zeigt dabei genau die Buchstaben, die hochgeladen würden. In den Einstellungen gibt es dafür „Nach jeder Stunde fragen“ (Vorgabe), „Immer hochladen“ und „Nie“.
- **Server** (`server/samples.js`, Datenbank-Migration 6):
  - Ein Upload zählt nur mit dem Ticket der Stunde, frühestens nach einer Minute und nur einmal.
  - Höchstens 6 Uploads pro Stunde und Anschluss, höchstens 300.000 Proben insgesamt.
  - Proben werden nach 12 Monaten automatisch gelöscht.
- **Admin, Bereich „Schriftproben“:**
  - Zahlen nach Sicherheit der Beschriftung und die letzten Stunden mit ihren Buchstaben.
  - **„Neue herunterladen“** liefert ein ZIP-Paket mit `samples.csv` und den Bildern, alles Heruntergeladene gilt danach als erledigt.
  - Löschen: einzelne Stunden, alle heruntergeladenen Proben oder alles.
- **Lokal auswerten:**
  - `python tools/train/import_samples.py <paket.zip>` legt die Bilder nach Schrift und Zeichen in `tools/train/data/krakel/` ab und erzeugt die Übersicht `uebersicht.html`.
  - Falsch beschriftete Bilder verschiebt man einfach im Explorer in den richtigen Ordner oder nach `_falsch`. Der Ordner zählt als Beschriftung.
- **Training:** `train.py --krakel 0.3` mischt die Proben ein. Ein Teil der Stunden bleibt als eigener Test („krakel test“) zurück, damit man sieht, ob die Erkennung für Kinderschrift wirklich besser wird.

### 2. Kinderschrift aus den Richtformen (Synthese)

Die App kennt für jeden Buchstaben die Strichfolge der bayerischen Richtformen in Druck- und Grundschrift (`src/game/strokes.ts`).

- `tools/export-strokes.ts` schreibt diese Striche als Datei heraus.
- `tools/train/strokes_synth.py` zeichnet daraus beliebig viele „Kinderbuchstaben“. Variiert werden:
  - Schräglage und Größe
  - zittrige Linien
  - Über- und Unterschwünge an den Strichenden
  - kleine Lücken an den Ansätzen
  - Stiftbreite vom Bleistift bis zum Filzstift
- Im Training mit `--strokes 0.2`. Damit kommen deutsche Schulformen und auch das ß zum ersten Mal als Handschrift ins Training.

### 3. Europäische Ziffern

[kensanata/numbers](https://github.com/kensanata/numbers), Teil 1, unter CC0: 16.994 Ziffern von 29 Personen. Der Download über `download_data.py` holt nur diesen Teil (etwa 25 Sekunden). Im Training kommen die Ziffern mit `--numbers 0.3` dazu. Getestet wird nach Personen getrennt (14.342 Training, 2.652 Test), sodass eine Person nie gleichzeitig im Training und im Test ist.

### Wie die neuen Quellen ins Training gehen

- **Was sie ersetzen:** Die Anteile `--krakel`, `--strokes` und `--numbers` gehen vom EMNIST-Anteil ab, die Schriftarten behalten ihren Anteil. Beim ß ersetzen die neuen Quellen die Schriftarten. Ohne die Schalter (Anteil 0) trainiert `train.py` bitgenau wie vorher.
- **Was nicht verwendet wird:**
  - Spiegelschrift, außer jemand hat die Probe von Hand einsortiert.
  - Proben mit Umlaut-Punkten. Die Erkennung entfernt die Punkte vor dem Erkennen, die Bilder enthalten sie aber.
  - Beim i und j bleibt der Punkt dran, so wie in der App.
- **Wiederholungen begrenzt:** Jede Probe wird pro Durchgang höchstens zehnmal gezogen, damit wenige echte Proben das Training nicht dominieren.
- **Vergleich vorher/nachher:** Der „krakel test“ und der „numbers test“ werden immer ausgegeben, auch mit Anteil 0. So gibt es einen Vergleichswert.

## Datenschutz bei den Schriftproben

- **Rechtsgrundlage ist die Einwilligung.** Die Frage richtet sich an die Lehrkraft. Weil es um Kinderhandschrift geht, ist sie ausdrücklich an die Bedingung geknüpft, dass Schule und Eltern einverstanden sind. Die Datenschutzerklärung hat dafür einen eigenen Abschnitt „Schriftproben (freiwillig)“. Die Feedback-Ampel steht dort jetzt ebenfalls.
- **Übertragen werden** nur Tinten-Ausschnitte einzelner Zeichen, ohne Fotos, Namen, Teamnamen oder IP-Adresse. Einzelne Buchstaben lassen sich kaum einem Kind zuordnen. Die Daten werden trotzdem vorsichtig behandelt: Einwilligung, Löschfrist und Weitergabe nur ans eigene Training.
- **Vor einem breiten Einsatz empfohlen:**
  - Kurz mit dem zuständigen Datenschutzbeauftragten oder Schulamt abstimmen.
  - Bei öffentlichen Schulen ist die Schule meist selbst verantwortlich und braucht eine eigene Einwilligung der Eltern.
  - Ein kurzer Elternbrief als Vorlage würde das erleichtern (noch nicht erstellt).

## Weitere Möglichkeiten (noch nicht umgesetzt)

1. **Sammelstunde mit Übungsbögen.** Die Lehrkraft lässt im Übungsmodus gezielt die Buchstaben schreiben, die oft verwechselt werden (b/d, ß/B, 1/7, G/6, Z/2). Die Proben sind dann als „Übung“ beschriftet. Hier hilft schon die Liste der häufigsten Verwechslungen (`tools/train/out/confusion.py`).
2. **Aktives Lernen.** Bei „erkannt“-Proben mit unsicherer Erkennung (kleiner Abstand zwischen erstem und zweitem Platz) zuerst prüfen. Dafür müsste die App die Wahrscheinlichkeiten mit hochladen; im Ergebnis (`top3`) sind sie bereits vorhanden.
3. **Kooperation.** Lehrstühle für Grundschulpädagogik (Didaktik des Schriftspracherwerbs) und das Schreibmotorik Institut haben Material zu Kinderhandschrift. Eine Anfrage nach Einzelbuchstaben mit Nutzungsrecht wäre ein Versuch wert.
4. **Schreibschrift.** Für das Schreibschrift-Modell könnten die Zeilen von fhswf/german_handwriting in Buchstaben zerlegt werden, wenn die Lizenz (AFL-3.0) für den Einsatz geklärt ist.

## Ablauf in Kürze

```
App: Stunde → „Schriftproben spenden?“ → Server
Admin: „Neue herunterladen“ → paket.zip   (danach ggf. „Heruntergeladene löschen“)
lokal: python tools/train/import_samples.py paket.zip
       uebersicht.html ansehen, Fehler im Explorer umsortieren
       npx vite-node tools/export-strokes.ts      (einmal, für --strokes)
       python tools/train/download_data.py        (einmal, für --numbers)
       python tools/train/train.py --epochs 15 --krakel 0.3 --strokes 0.2 --numbers 0.3
       Vergleich: „krakel test“ und „numbers test“ vorher/nachher, dann wie gewohnt exportieren
```
