# Rechtliche Hinweise für den Betrieb (DSGVO & Hosting)

> **Keine Rechtsberatung.** Dieser Leitfaden fasst den technischen Stand der App und die üblichen Pflichten beim Betrieb einer Website in Deutschland zusammen (Stand: Oktober 2026). Im Schulkontext bitte immer mit **Schulleitung** und **Datenschutzbeauftragter/m der Schule** abstimmen. Im Zweifel juristischen Rat einholen.

---

## 1. Was die App mit Daten macht

| Daten | Wo verarbeitet | Weitergabe | Speicherdauer |
|---|---|---|---|
| **Kamerafotos** | nur im Browser des Geräts (Web Worker) | **keine** | nur im Arbeitsspeicher, bis die Auswertung fertig ist |
| **Spielstände** (ausgeschnittene Buchstaben mit Bewertung, ausgemalte Fisch-Karten mit dem darauf geschriebenen Fischnamen, Vorschaubild, Spieleinstellungen) | `IndexedDB` des Browsers | keine (nur wenn jemand selbst eine Datei herunterlädt) | das letzte Spiel jeder Spielart bis zum nächsten Spiel dieser Art; benannte Spielstände bis zum Löschen (einzeln, „Alle Spielstände löschen“, „Alles zurücksetzen“ oder Websitedaten löschen) |
| **Einstellungen** (Kamera, Bildausschnitt, Strenge, Teamnamen, Übungsbuchstabe) | `localStorage` des Browsers | keine | bis „Alles zurücksetzen“ oder Löschen der Websitedaten |
| **App-Dateien** (Offline-Betrieb) | Cache des Service Workers | keine | bis zur nächsten Aktualisierung |
| **Verbindungsdaten** (IP-Adresse, Zeit, URL, Statuscode, Datenmenge, Browser) | beim Hoster **Railway** (Auftragsverarbeiter) | Railway Corporation, USA | 7 Tage (Railway-Tarife Trial/Hobby) bzw. 30 Tage (Pro) |

Außerdem:
- **Es gibt keine Cookies, kein Tracking, keine Analyse, keine Werbung und keine Konten.**
- **Es werden keine Dienste Dritter eingebunden.** Schriften, Modell und Programm liegen auf dem eigenen Server. Die Content-Security-Policy (`default-src 'self'`) erzwingt das technisch.
  - Hintergrund zu den Schriften: Das LG München I (Urteil vom 20.01.2022, Az. 3 O 17493/20) hat die Einbindung von Google Fonts über Googles Server als Datenschutzverstoß gewertet.
- **Der eigene Server (`server.js`) schreibt keine Zugriffsprotokolle.** Die Protokolle entstehen nur auf der Plattform von Railway.
- **Ein Cookie-Banner ist nicht nötig.** Die Speicherung im Browser ist für die gewünschten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
- **Spielstände enthalten Handschrift der Kinder** (ausgeschnittene Buchstaben, ausgemalte Bilder). Sie bleiben im Browser des Geräts. Auf gemeinsam genutzten Geräten in den Einstellungen „Letztes Spiel merken“ ausschalten oder die Spielstände nach dem Unterricht löschen. Heruntergeladene Spielstand-Dateien wie andere Schülerarbeiten behandeln.

**In der App:**
- Datenschutzerklärung, Impressum und Lizenzhinweise sind auf der Startseite unten verlinkt.
- Sie sind auch direkt aufrufbar unter `/datenschutz`, `/impressum` und `/lizenzen`.
- Die Texte stehen in `src/ui/legal.ts`. Die Angaben zum Betreiber kommen aus Railway-Variablen (siehe Abschnitt 3).

---

## 2. Checkliste vor dem öffentlichen Betrieb

### Organisatorisch
- [ ] **Verantwortlichen festlegen.** Wer betreibt die Website: eine Lehrkraft privat, die Schule, ein Förderverein? Davon hängen die Rechtsgrundlage (`LEGAL_TYPE`) und die zuständige Aufsichtsbehörde ab.
- [ ] **Schule:** Den Einsatz mit der Schulleitung abstimmen. Die/den **Datenschutzbeauftragte/n** einbinden. Die Verarbeitung ins **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30 DSGVO) aufnehmen.
- [ ] **Datenschutz-Folgenabschätzung (Art. 35 DSGVO):** Die Bilder werden nur lokal verarbeitet; gespeichert werden nur Spielstände im Browser des Geräts (ohne Kamerafotos). Deshalb ist sie voraussichtlich nicht erforderlich. Die Entscheidung trifft der Verantwortliche zusammen mit der/dem Datenschutzbeauftragten.
- [ ] **Eltern informieren** (empfohlen, siehe Vorlage in Abschnitt 4). Eine Einwilligung ist für die App selbst nicht nötig, weil keine Daten der Kinder das Gerät verlassen.
- [ ] **Im Unterricht:**
  - Die Kamera nur auf das Papier richten, keine Gesichter.
  - Keine Namen von Kindern als Teamnamen.
  - Nichts aufzeichnen.

### Railway
- [ ] **EU-Region wählen:** Service → Settings → Region → **EU West Metal (Amsterdam, Niederlande)**, Kennung `europe-west4-drams3a` ([Railway-Doku](https://docs.railway.com/reference/deployment-regions)).
- [ ] **Auftragsverarbeitungsvertrag (DPA) abschließen:**
  - Railway bietet den Vertrag als Self-Service an ([railway.com/legal/dpa](https://railway.com/legal/dpa)). Er wird per DocuSign-Formular abgeschlossen; der Link steht im DPA.
  - Den unterschriebenen Vertrag aufbewahren.
  - Der DPA enthält die **EU-Standardvertragsklauseln** (Durchführungsbeschluss (EU) 2021/914) für die Übermittlung in die USA.
- [ ] **Unterauftragsverarbeiter** zur Kenntnis nehmen: [trust.railway.com/item/subprocessors](https://trust.railway.com/item/subprocessors).
- [ ] **EU-U.S. Data Privacy Framework prüfen:**
  - Auf [dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list) nachsehen, ob „Railway Corporation“ zertifiziert ist.
  - Wenn nicht, gelten die Standardvertragsklauseln. Dann ggf. ein Transfer Impact Assessment mit der/dem Datenschutzbeauftragten besprechen.
- [ ] **Protokoll-Aufbewahrung:** `LEGAL_LOG_DAYS` passend zum Tarif setzen: **7** bei Trial/Hobby, **30** bei Pro ([Railway-Doku](https://docs.railway.com/guides/logs)).

### Pflichtangaben
- [ ] Die **LEGAL_\*-Variablen** setzen (Abschnitt 3) und neu deployen.
- [ ] Danach `/impressum` und `/datenschutz` aufrufen und prüfen.
  - Solange Angaben fehlen, zeigt die App auf der Startseite einen gelben Hinweis.
  - Auf `localhost` erscheint dieser Hinweis nicht.
- [ ] **Impressum:**
  - Nach **§ 5 DDG** Pflicht für „geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste“.
  - Für Schulen und Behörden ist ein Impressum üblich bzw. nach Landesrecht gefordert. Auch bei rein privatem Betrieb wird es empfohlen.
  - Anbieter und Verantwortlicher müssen ohnehin in der Datenschutzerklärung genannt werden (Art. 13 DSGVO).
  - Zur Kontaktaufnahme gehört neben der E-Mail-Adresse am besten auch eine Telefonnummer.
- [ ] **Barrierefreiheit (öffentliche Stellen):**
  - Staatliche Schulen sind öffentliche Stellen. Sie müssen für Websites in der Regel eine **Erklärung zur Barrierefreiheit** veröffentlichen.
  - Grundlage ist die EU-Richtlinie 2016/2102 bzw. Landesrecht, in Bayern z. B. Art. 13 BayBGG und BayBITV.
  - Mit der Schulleitung bzw. der zuständigen Stelle klären.

### Lizenzen (sind bereits erfüllt, bitte nicht entfernen)
- [ ] **Schriften (SIL Open Font License 1.1):**
  - Die Lizenztexte mit Copyright liegen in `public/fonts/OFL-*.txt` und werden im Dialog „Lizenzen“ verlinkt.
  - Die Schrift „Andika“ ist als verkleinerte Fassung eingebunden und deshalb nach den Lizenzregeln in **„Druckvorlage“** umbenannt („Andika“ und „SIL“ sind reservierte Namen).
- [ ] **EMNIST (CC BY 4.0):**
  - Das Erkennungsmodell wurde mit EMNIST trainiert. Die Quelle wird im Dialog „Lizenzen“ genannt: Cohen et al. 2017, arXiv:1702.05373, NIST Special Database 19.
  - Bei neuem Training mit anderen Daten die Angaben in `src/ui/legal.ts` anpassen.

---

## 3. Railway-Variablen für Impressum & Datenschutz

In Railway: **Service → Variables → New Variable**. Für Zeilenumbrüche `|` verwenden.

Ohne diese Variablen liefert der Server die Angaben aus `public/legal.json` aus (dort stehen die Angaben des aktuellen Betreibers). Gesetzte Variablen haben Vorrang.

| Variable | Pflicht | Beispiel |
|---|---|---|
| `LEGAL_TYPE` | ja | `schule` (öffentliche Schule → Art. 6 Abs. 1 lit. e DSGVO), `privat` oder `organisation` (→ lit. f) |
| `LEGAL_NAME` | ja | `Grundschule Musterstadt` oder `Max Mustermann` |
| `LEGAL_REPRESENTATIVE` | bei Schulen/Vereinen | `Schulleiterin Erika Beispiel` |
| `LEGAL_ADDRESS` | ja | `Schulstraße 1 \| 12345 Musterstadt` |
| `LEGAL_EMAIL` | ja | `verwaltung@gs-musterstadt.de` |
| `LEGAL_PHONE` | empfohlen | `01234 56789-0` |
| `LEGAL_WEBSITE` | optional | eigene Website, wird im Impressum verlinkt, z. B. `https://prelldynamics.de/` |
| `LEGAL_DPO` | wenn vorhanden | `Datenschutzbeauftragte/r der Schule \| datenschutz@gs-musterstadt.de` |
| `LEGAL_AUTHORITY` | empfohlen | siehe unten |
| `LEGAL_SUPERVISION` | bei Schulen empfohlen | `Staatliches Schulamt … \| Anschrift` |
| `LEGAL_CONTENT_RESPONSIBLE` | optional | Person, die inhaltlich verantwortlich ist |
| `LEGAL_SERVER_LOCATION` | nur wenn andere Region | Standard: `EU West (Amsterdam, Niederlande)` |
| `LEGAL_LOG_DAYS` | ja | `7` (Hobby) oder `30` (Pro) |
| `LEGAL_DATE` | optional | Stand der Erklärung, z. B. `Oktober 2026` |

**Aufsichtsbehörde (`LEGAL_AUTHORITY`) – Beispiele für Bayern:**

| Betreiber | Aufsichtsbehörde |
|---|---|
| Öffentliche Stellen (z. B. staatliche Schulen) | `Der Bayerische Landesbeauftragte für den Datenschutz \| Wagmüllerstraße 18 \| 80538 München \| poststelle@datenschutz-bayern.de` |
| Private Personen, Vereine, Privatschulen | `Bayerisches Landesamt für Datenschutzaufsicht (BayLDA) \| Promenade 18 \| 91522 Ansbach \| poststelle@lda.bayern.de` |

In anderen Bundesländern ist die jeweilige Landesbehörde zuständig.

---

## 4. Vorlage: Elterninformation

> Liebe Eltern,
>
> im Unterricht üben wir das Schreiben mit dem Lernspiel „Krakel & Krone“. Die Kinder schreiben Buchstaben und Zahlen auf Papier, eine Dokumentenkamera zeigt das Blatt. Aus jedem Zeichen entsteht ein Spielwesen. Je sorgfältiger geschrieben, desto prächtiger ist es.
>
> **Datenschutz:**
> - Die Kamerabilder werden ausschließlich auf dem Schulgerät ausgewertet. Sie werden nicht ins Internet übertragen und nicht gespeichert.
> - Damit ein Spiel in der nächsten Stunde weitergehen kann, merkt sich das Programm auf dem Schulgerät die ausgeschnittenen Buchstaben und ausgemalten Bilder. Diese Spielstände verlassen das Gerät nicht und werden gelöscht, wenn wir sie nicht mehr brauchen.
> - Die Kamera zeigt nur das Papier, keine Gesichter.
> - Die Kinder brauchen kein Konto. Es werden keine Namen erfasst. Auf die Malvorlage schreiben die Kinder einen Namen für ihren Fisch, nicht ihren eigenen.
> - Die „Sterne“ im Spiel sind keine Noten.
>
> Bei Fragen wenden Sie sich gern an [Ansprechperson].

---

## 5. Quellen

- DSGVO: [Art. 6](https://dsgvo-gesetz.de/art-6-dsgvo/), [Art. 13](https://dsgvo-gesetz.de/art-13-dsgvo/), [Art. 28](https://dsgvo-gesetz.de/art-28-dsgvo/), [Art. 30](https://dsgvo-gesetz.de/art-30-dsgvo/)
- [§ 5 DDG (Impressum)](https://www.gesetze-im-internet.de/ddg/__5.html) · [§ 25 TDDDG (Speicherung auf Endgeräten)](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- Railway: [Auftragsverarbeitung (DPA)](https://railway.com/legal/dpa) · [Regionen](https://docs.railway.com/reference/deployment-regions) · [Logs und Aufbewahrung](https://docs.railway.com/guides/logs) · [Unterauftragsverarbeiter](https://trust.railway.com/item/subprocessors)
- [Bayerischer Landesbeauftragter für den Datenschutz](https://www.datenschutz-bayern.de) · [Bayerisches Landesamt für Datenschutzaufsicht](https://www.lda.bayern.de)
- [EMNIST (Cohen et al. 2017)](https://arxiv.org/abs/1702.05373) · [SIL Open Font License 1.1](https://openfontlicense.org)
