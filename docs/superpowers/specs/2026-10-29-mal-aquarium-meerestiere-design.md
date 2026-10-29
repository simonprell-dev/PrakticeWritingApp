# Mal-Aquarium: zwölf Meerestiere und Freiform-Karte

Stand: 29.10.2026

## Worum es geht

Im Mal-Aquarium malen Kinder eine gedruckte Karte aus, die Kamera findet die Karte, und das Tier schwimmt in den
Farben des Kindes ins Aquarium. Bisher gibt es genau eine Form (den „Fisch“). Kinder wollen Abwechslung und ihr
Lieblingstier wiederfinden, Lehrkräfte wollen pro Stunde passende Bögen drucken.

Neu:

1. **Zwölf Tiere** statt einem, jedes mit eigener Bewegung im Aquarium.
2. **Freiform-Karte**: nur schwarzer Rahmen auf weißem Papier, das Kind malt ein eigenes Meerestier hinein.
3. **Druckbögen** mit je sechs Karten pro A4-Blatt: ein Bogen pro Tier (6 × dasselbe Tier), ein Freiform-Bogen
   (6 × leer) und **zwei feste gemischte Bögen** (vom Nutzer so entschieden).

## Die Tiere

| # | Tier | gemischter Bogen | Bewegung im Aquarium |
|---|------|------------------|----------------------|
| 1 | Fisch (der bisherige) | B | schwimmt, Schwanzflosse wedelt (wie heute) |
| 2 | Clownfisch | A | schwimmt, Schwanzflosse wedelt |
| 3 | Doktorfisch (Paletten-Doktorfisch: blau, schwarze Zeichnung, gelber Schwanz – als echter Fisch gezeichnet, **nicht** die Filmfigur) | A | schwimmt, Schwanzflosse wedelt |
| 4 | Kugelfisch | A | schwimmt langsam, bläst sich ab und zu auf (Skalierung) |
| 5 | Karpfen | A | schwimmt gemächlich, Schwanzflosse wedelt |
| 6 | Hecht | A | lauert, schießt dann schnell vor |
| 7 | Hai | A | schwimmt groß und ruhig, Schwanzflosse wedelt seitlich |
| 8 | Seepferdchen | B | steht aufrecht, wippt auf und ab, treibt langsam |
| 9 | Qualle | B | pulsiert (Schirm zieht sich zusammen) und steigt dabei stoßweise |
| 10 | Krake | B | Arme schwingen, schwebt in Schüben |
| 11 | Schildkröte | B | gleitet, Flossen paddeln |
| 12 | Krebs | B | läuft seitwärts über den Sand, Scheren klappen |

Bogen A = sechs Fische, Bogen B = der bisherige Fisch plus die fünf anderen Meerestiere.
Karpfen und Hecht sind Süßwasserfische; sie schwimmen trotzdem im selben Aquarium (vom Nutzer gewünscht).

## Ziele

- Jede Karte wird zuverlässig erkannt: **welches Tier** und **wie herum** sie liegt – auch auf gemischten Bögen und
  wenn die Karten ausgeschnitten und durcheinander unter der Kamera liegen.
- Jedes Tier sieht ausgemalt gut aus und bewegt sich erkennbar anders.
- Freiform: Das gemalte Tier wird vom weißen Papier freigestellt und schwimmt als Aufkleber mit weißem Rand.
- Der Name unten auf der Karte funktioniert wie heute („Mein Hai heißt: …“, bei Freiform „Mein Tier heißt: …“).
- Gespeicherte Spiele von vorher laden weiter (ihre Fische sind „Fisch“).

## Nicht-Ziele

- Keine Figuren aus Filmen, Marken oder Logos nachzeichnen.
- Keine Erkennung, *was* ein Kind auf der Freiform-Karte gemalt hat.
- Keine weiteren Lebensräume (Weltraum, Savanne) mit Malkarten in diesem Schritt.
- Kein Zufalls-Mischbogen.

## Was es zum Scheitern bringen würde (Anti-Ziele)

- Eine Karte wird als falsches Tier erkannt (z. B. Karpfen als Fisch) – dann passt die Umrisslinie nicht zur
  ausgemalten Fläche und das Tier sieht kaputt aus.
- Die Erkennung wird spürbar langsamer als heute (mehr als etwa doppelt so lang pro Foto).
- Malflächen sind für Erstklässler zu klein oder zu verwinkelt zum Ausmalen.
- Bestehende Spielstände gehen kaputt.

## Rahmenbedingungen aus dem Bestand

- Karte, Bogen und Erkennung teilen sich eine Geometrie in Millimetern (`src/game/paint/fishCard.ts`): Karte
  94 × 88 mm, Rahmen 2,6 mm, 2 × 3 Karten pro A4. **Kartengröße und Rahmen bleiben gleich**, damit Bögen gemischt
  werden können und die Rahmensuche (`src/vision/cards.ts`) unverändert bleibt.
- Die Lage der Karte (vier Drehungen, gespiegelt) wird heute über die gedruckten Fischlinien bestimmt
  (`lineSamples`). Die Karte ist fast quadratisch, der Rahmen allein reicht dafür nicht.
- Das Sprite eines ausgemalten Fischs (`src/game/creatures/paintedFish.ts`) besteht aus Körper plus einem
  getrennt animierten Teil (Schwanz mit Drehpunkt). Die Bewegung im Aquarium steckt in `HabitatScene`.
- Spielstände speichern pro Fisch das Kartenbild (`PaintSave` in `src/scenes/paintScene.ts`).
- Gedruckt wird aus der Seite selbst (`src/ui/printSheet.ts`), Vorschau im Lobby-Fenster (`src/ui/paintLobby.ts`).

## Wie es gebaut wird (festgelegt)

### Tierbeschreibung

Jedes Tier ist ein Datensatz in einem Register (ersetzt das einzelne `FISH`-Objekt), mit:

- Name (deutsch, mit Artikel für Texte wie „Ein neuer Hai!“), Text auf der Namenszeile („Mein Hai heißt:“),
- Umrissteile als geschlossene Pfade in eigenen Einheiten, Innenlinien (Malflächen), Augen,
- welche Teile getrennt animiert werden, mit Drehpunkt,
- Bewegungsart (siehe Tabelle),
- Platzierung auf der Karte.

Der bisherige Fisch wird der erste Datensatz, unverändert in Form und Lage, damit schon gedruckte Bögen weiter
erkannt werden.

### Erkennung, welches Tier

Für jeden gefundenen Rahmen wird wie heute in allen acht Lagen geprüft, ob gedruckte Linien unter den erwarteten
Stellen liegen – jetzt für **jedes Tier**. Das Tier mit dem deutlich besten Treffer gewinnt. Die Formen werden so
gezeichnet, dass sie sich in den Linien klar unterscheiden (verschiedene Umrisse, nicht nur andere Innenlinien).

*Entscheidung des Bauenden (Claude):* Ist der Sieger nicht eindeutig (zweitbestes Tier zu nah dran) oder passt
selbst das beste Tier nur schwach, wird die Karte **nicht** als Tier übernommen. Es erscheint der Hinweis „Diese
Karte erkenne ich nicht sicher – bitte flach und ganz ins Bild legen“. Lieber einmal nachfragen als ein Tier mit
falschem Umriss (Anti-Ziel 1). Die alten Fisch-Bögen müssen in den Tests gegen alle anderen Tiere eindeutig gewinnen.

### Freiform-Karte

- Rahmen wie alle Karten, innen leer bis auf die Namenszeile unten, einen kleinen Hinweis oben
  („Mal dein eigenes Meerestier!“) und einen kleinen Pfeil mit „Kopf nach hier →“ (vom Nutzer so entschieden).
  Die App geht davon aus, dass jedes Freiform-Tier nach rechts schaut, und spiegelt es beim Umdrehen wie die
  anderen Tiere. Diese gedruckten Elemente legen auch fest, wie herum die Karte liegt.
- Erkannt wird sie als „Freiform“, wenn ihre gedruckten Linien passen und kein Tier besser passt.
- Freistellen: alles, was sich deutlich vom Papier abhebt (dunkler oder farbig), innerhalb der Malfläche; kleine
  Krümel weg, Löcher im Tier füllen, größte zusammenhängende Fläche(n) behalten; weißer Aufkleberrand drumherum.
- Bewegung: schwimmt wie ein Fisch, ganzes Bild wiegt sich leicht (kein getrennter Schwanz). Kein Auge
  aufgesetzt.
- *Entscheidung des Bauenden:* Die Namenszeile ist für lange Tiernamen zu kurz („Mein Seepferdchen heißt:“);
  Text und Linie werden pro Tier so verteilt, dass beides passt.
- „Noch nicht ausgemalt“: zu wenig Farbe/Strich auf der Karte, wie heute.

### Druckbögen

Im Lobby-Fenster wählt man vor dem Drucken den Bogen: jedes der zwölf Tiere, Freiform, gemischter Bogen A,
gemischter Bogen B. Die Vorschau zeigt den gewählten Bogen.

### Spielstände

Jeder gespeicherte Fisch bekommt die Tierart dazu; fehlt sie (alte Spielstände), ist es „Fisch“.

## Dem Bauenden überlassen

- Die Zeichnungen selbst (Pfade), solange die Malflächen kindgerecht groß sind und alle zwölf sich in den Linien
  unterscheiden.
- Genaue Bewegungsparameter, Geschwindigkeiten, Größenunterschiede (Hai größer, Krebs kleiner …).
- Wie das Register technisch aufgeteilt wird (eine Datei pro Tier oder eine gemeinsame).
- Schwellen für Tierunterscheidung und Freiform-Freistellen – festgelegt über Tests mit synthetischen Karten
  (wie die bestehenden in `test/vision/cards.test.ts`).
- Texte in der App (Toasts, Lobby), solange „Fisch“ dort, wo jetzt jedes Tier gemeint ist, allgemein wird.

## Wie wir prüfen, dass es fertig ist

- Tests: Für jedes Tier wird eine ausgemalte Karte in verschiedenen Lagen als richtiges Tier und richtig herum
  erkannt; ein gemischter Bogen liefert sechs Karten mit den sechs richtigen Tieren; eine bemalte Freiform-Karte
  wird freigestellt (der gemalte Fleck ist drin, das weiße Papier nicht); eine leere Freiform-Karte gilt als
  „noch nicht ausgemalt“.
- Alter Spielstand mit Fischen lädt.
- Sichtprüfung der Druckvorschau aller Bögen durch den Nutzer, danach Probe mit echter Kamera.
