# Saisonwelten und Zeitplan für Welten

Stand 7.11.2026. Vom Nutzer bestätigt im Gespräch; mit „(meine Entscheidung)“ markierte Punkte sind Entscheidungen des Bauenden, die der Nutzer beim Lesen prüfen kann.

## Worum es geht

Im Jahr soll die App zur Jahreszeit und zu den Festen passende Welten anbieten. Der Betreiber legt im Admin-Bereich fest, wann welche Welt auf dem Startbildschirm erscheint, und zwar über eine Zeitleiste mit verschiebbaren Balken. Das gilt für die neuen Saisonwelten und allgemein für alle Spiele des Startbildschirms.

## Ziele

1. Neun neue Welten, die genau so funktionieren wie Savanne und Co.: gemalter Hintergrund mit kleinen Bewegungen, aus jedem erkannten Buchstaben schlüpft eine Figur, je schöner geschrieben, desto prächtiger. Üben-Modus, Album, Spielstände und Vorschaukachel wie bei den anderen Welten.
2. Admin-Bereich „Welten“: je Spiel ein Schalter „nach Zeitplan / immer an / aus“ und eine Jahres-Zeitleiste (Januar bis Dezember), auf der der Zeitraum als Balken gezogen wird: an den Enden ziehen ändert Anfang oder Ende, in der Mitte ziehen verschiebt.
3. Der Zeitplan gilt jedes Jahr wieder. Zeiträume über den Jahreswechsel sind erlaubt (Ende vor Anfang heißt: über Silvester).
4. Ostern richtet sich automatisch nach dem Ostersonntag des Jahres (Nutzer: „Ja“). Gespeichert werden Tage vor und nach dem Ostersonntag, der Balken zeigt das laufende Jahr.
5. Fertig ist es, wenn ein verschobener Balken nach einem Neuladen auf allen Geräten wirkt.

## Nicht-Ziele

- Keine Planung pro Klasse oder pro Gerät, der Plan gilt für alle.
- Kein Planen bestimmter Jahre („nur 2027“), nur der jährlich wiederkehrende Plan.
- Das Rechenmeer bleibt im Code ausgeschaltet (`RECHENMEER = false`) und erscheint nicht im Admin, solange es aus ist.

## Die Welten

Reihenfolge des Bauens nach der Kalenderzeit ab heute (Nutzer bestätigt): Weihnachten, Winter, Neujahr, Ostern, Frühling, Strand & Sonne, Herbst, Halloween, Sankt Martin.

| Id | Titel | Hintergrund | Figuren |
|---|---|---|---|
| `weihnachten` | 🎄 Weihnachten | Winterdorf mit Weihnachtsbaum, Sterne | Wichtel, Rentiere, Geschenke unter dem Baum |
| `winter` | ⛄ Winter | Schneelandschaft, Schneefall, zugefrorener See | Schneemänner, Pinguine, Eisbären auf dem Eis |
| `neujahr` | 🎆 Neujahr | Stadt bei Nacht | Feuerwerksraketen, die beim Schlüpfen am Himmel aufblühen |
| `ostern` | 🐣 Ostern | grüne Wiese mit Büschen | Osterhasen, Küken, bemalte Eier im Gras |
| `fruehling` | 🌷 Frühling | Blumenwiese, Bach, Regenbogen | Blumen, die aufwachsen, Bienen, Marienkäfer, Vögel |
| `strand` | 🏖️ Strand & Sonne | Meer, Sand, Sonnenschirme, Wellen | Krebse, Möwen, Sandburgen, Schildkröten |
| `herbst` | 🍂 Herbst | bunter Wald, fallende Blätter, Wind | Igel, Eichhörnchen, Füchse, Drachen am Himmel |
| `halloween` | 🎃 Halloween | Mondnacht, Kürbisfeld, schiefes Gruselhaus, Fledermäuse | freundliche Gespenster, Kürbisköpfe, kleine Hexen auf Besen |
| `martin` | 🏮 Sankt Martin | Abenddämmerung, Dorf mit Kirche, Martinsfeuer | Laternen, die im Zug durchs Bild wandern |

Alles freundlich und kindgerecht, nichts gruselig im echten Sinn (meine Entscheidung). Figuren tragen wie in den anderen Welten den Buchstaben als Sticker; die Güte der Schrift zeigt sich wie bisher (zerknittert, schief … prachtvoll mit Glanz und Krone). Jede Welt hat mehrere Figurenarten; die Art folgt aus dem Zufallssamen des Zeichens wie bei den Savannentieren.

## Startzeiten (Vorgabe, bevor im Admin etwas gespeichert ist)

| Welt | Zeitraum |
|---|---|
| Neujahr | 27.12.–6.1. |
| Winter | 1.12.–28.2. (im Schaltjahr bis 29.2. durch den Monatsvergleich) |
| Weihnachten | 1.12.–26.12. |
| Ostern | 14 Tage vor bis 1 Tag nach Ostersonntag |
| Frühling | 20.3.–31.5. |
| Strand & Sonne | 1.6.–31.8. |
| Herbst | 1.9.–30.11. |
| Halloween | 15.10.–2.11. |
| Sankt Martin | 1.11.–13.11. |

Meer, Weltraum, Savanne, Zauberland, Team-Duell, Riesenburg, Türme bauen und Mal-Aquarium: immer an.

Zeiten dürfen sich überschneiden.

## Verhalten in der App

- **Aktiv** heißt: Schalter „immer an“, oder „nach Zeitplan“ und das heutige Datum (Gerät des Kindes, Ortszeit) liegt im Zeitraum, Anfang und Ende eingeschlossen.
- **Startbildschirm:** Nur aktive Spiele erscheinen. Aktive Saisonwelten stehen vorn (nach der Schrift-Kachel) und tragen ein Kennzeichen „bis 26.12.“ mit dem letzten Tag (meine Entscheidung). Bei „immer an“ kein Kennzeichen.
- **Inaktive Spiele:** Kachel weg, ihre Spielstände werden in der Liste und bei „Weiterspielen“ ausgeblendet, aber nicht gelöscht; kommt die Welt wieder, sind sie wieder da. Eine Spielstand-Datei einer inaktiven Welt wird beim Laden abgelehnt, wie heute beim Rechenmeer.
- **Wechsel während des Spiels:** Ein laufendes Spiel läuft weiter, auch wenn um Mitternacht die Zeit endet. Erst der Startbildschirm zeigt den neuen Stand.
- **Plan holen:** Beim Start holt die App den Plan vom Server (`GET /api/worlds`, kurze Wartezeit) und merkt ihn sich im Browser. Ohne Server oder ohne Antwort gilt der zuletzt gemerkte Plan, sonst die Startzeiten. Der Startbildschirm wird neu gezeichnet, wenn der Plan ankommt.
- **Unbekannte oder fehlende Einträge** im gespeicherten Plan bekommen die Vorgabe. So kommen spätere neue Welten mit ihren Startzeiten dazu.

## Admin-Bereich „Welten“

- Neuer Abschnitt auf der bestehenden Admin-Seite, nach dem Anmelden.
- Zwei Gruppen: „Immer da“ (die bisherigen Spiele) und „Jahreszeiten und Feste“. Jede Zeile: Name, Schalter, Zeitleiste mit Monatsnamen, rote Linie für heute, Datum als Text („1.12. – 26.12. · jetzt aktiv“).
- Ziehen rastet auf ganze Tage. Ein Zeitraum ist mindestens 1 Tag lang.
- Auch die bisherigen Spiele haben eine Zeitleiste, damit „nach Zeitplan“ für sie funktioniert (meine Entscheidung: Vorgabe-Zeitraum ganzes Jahr).
- Ostern: Balken liegt um den Ostersonntag des laufenden Jahres; Ziehen ändert die Tage vor und nach.
- „Speichern“ schickt den ganzen Plan (`POST /api/admin/worlds`), „Zurücksetzen“ verwirft ungespeicherte Änderungen. Gespeichert wird in der Datenbank (neue Tabelle `settings`, Schlüssel `worlds`, Wert JSON). Ohne Datenbank antwortet der Speicherknopf mit der bestehenden 503-Meldung, und die App nutzt die Startzeiten.
- Der Server prüft den Plan: nur bekannte Ids, Schalter aus den drei Werten, Tage gültig (Monat 1–12, Tag passend zum Monat, 29.2. erlaubt), Ostern-Tage 0–60.

## Datenform

```json
{ "version": 1,
  "worlds": {
    "weihnachten": { "mode": "plan", "from": "12-01", "to": "12-26" },
    "ostern": { "mode": "plan", "easter": { "before": 14, "after": 1 } },
    "meer": { "mode": "on", "from": "01-01", "to": "12-31" } } }
```

## Was dem Bauenden überlassen ist

Aussehen der Figuren und Hintergründe im Stil der vorhandenen Welten, Bewegungsmuster (laufen, fliegen, schweben, im Zug ziehen), Anzahl der Figurenarten je Welt (3 bis 4), Texte der Kacheln, Übersetzungen in alle 17 Sprachen der App.
