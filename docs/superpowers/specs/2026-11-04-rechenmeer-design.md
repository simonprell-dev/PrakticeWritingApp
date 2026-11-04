# Rechenmeer: Rechnen füllt eine Unterwasserwelt

Stand: 04.11.2026

## Worum es geht

Ein Mathe-Spiel für Klasse 1/2. Oben im Bild steht eine Rechenaufgabe. Das Kind schreibt **nur das Ergebnis**
mit Stift auf Papier und hält es wie gewohnt unter die Kamera. Ist die Antwort richtig, fliegt die geschriebene
Zahl ins Meer und wird zu einem kleinen Meerestier oder einer Pflanze. So füllt sich die Unterwasserwelt mit
jeder richtigen Aufgabe. Nach einem Abschnitt kommt ein großer Moment: Ein Hai schwimmt durchs Bild oder eine
Gruppe Delfine springt. *(Idee und Welt vom Nutzer, Ablauf im Detail meine Wahl)*

Warum: Die App macht bisher Schreiben zum Spiel. Das Rechenmeer überträgt dasselbe Prinzip auf das, was laut
bayerischem LehrplanPLUS in Klasse 1/2 automatisiert werden soll. Das Kind übt Rechnen und Ziffernschreiben
zugleich und sieht, wie seine Welt wächst.

Das Kind schaut zu wie in den anderen Welten. Es löst nur Aufgaben, sonst muss es nichts bedienen. Antippen
eines Tieres zeigt wie überall die Karte mit der geschriebenen Zahl.

## Ziele

- Rechnen nach LehrplanPLUS Bayern, Mathematik Grundschule 1/2 (Lernbereich Zahlen und Operationen).
- Aufgaben **per Zufall** und **immer anders** (vom Nutzer entschieden).
- Ein Erwachsener wählt in den **Einstellungen**, welche Aufgabenarten drankommen (vom Nutzer entschieden).
- Jede richtige Antwort macht das Meer sichtbar voller. Nach einem Abschnitt kommt ein Hai oder Delfine.
- Ziffern sauber zu schreiben lohnt sich: Je schöner die Zahl, desto prächtiger das Tier, wie bei den
  Buchstaben. *(meine Wahl)*

## Nicht-Ziele (erste Version)

- Klasse 3/4 (ganzes Einmaleins, Zahlenraum bis 1000).
- Platzhalteraufgaben (7 + _ = 12), Sachaufgaben, Geld, Uhrzeit, Längen, Geometrie.
- Vorlesen der Aufgabe.
- Mehrere Kinder oder Teams gegeneinander.
- Statistik für Lehrkräfte über richtige und falsche Antworten.

## Anti-Ziele (wäre ein Fehlschlag, selbst wenn es funktioniert)

- **Druck:** keine Zeitbegrenzung, kein Countdown, keine Punkte-Rangliste.
- **Strafe:** Bei einer falschen Antwort verschwindet nichts, und kein Tier wird traurig oder schwimmt weg.
- **Angst:** Der Hai ist freundlich und ein Highlight, kein Schreckmoment.
- **Falsch gelesen:** Eine richtige Antwort wird als falsch gewertet, weil die Erkennung eine Ziffer
  verwechselt. Das frustriert am meisten. Im Zweifel fragt das Spiel lieber nach, als „falsch“ zu sagen
  (siehe „Zahl lesen“).

## Aufgabenarten (Einstellungen)

Im Einstellungsfeld bekommt das Rechenmeer einen eigenen Abschnitt mit Ankreuzfeldern. Mindestens eines bleibt
immer angekreuzt. Voreingestellt ist nur „Plus und Minus bis 20“. *(Vorgabe meine Wahl)*

| Aufgabenart | Beispiele | Grenzen |
|---|---|---|
| Plus bis 20 | 7 + 5, 13 + 4 | Summe ≤ 20 |
| Minus bis 20 | 12 − 5, 18 − 6 | Minuend ≤ 20, Ergebnis ≥ 0 |
| Plus und Minus bis 100 | 34 + 20, 56 + 7, 72 − 8, 45 + 23 | alle Zahlen und Ergebnisse 0–100 |
| Einmaleins-Kernaufgaben | 5 · 6, 10 · 3, 7 · 7, 0 · 8 | Reihen 1, 2, 5, 10, Quadratsätze bis 10 · 10, mal 0; beide Reihenfolgen |
| Geteilt (Umkehr der Kernaufgaben) | 35 : 5, 49 : 7, 20 : 2 | nur ohne Rest, Divisor nie 0 |

Plus und Minus bis 20 sind als zwei Felder getrennt, damit Erstklässler auch nur Plus üben können. Wie die
Aufgaben bis 100 gemischt werden (Zehner plus Einer, mit und ohne Übergang, zwei zweistellige Zahlen), entscheidet
der Bauende. Es soll eine sinnvolle Mischung sein, in der auch Aufgaben mit Zehnerübergang vorkommen.

## Aufgaben ziehen

- Aus allen angekreuzten Arten wird per Zufall gezogen. Jede angekreuzte Art kommt etwa gleich oft dran.
  *(meine Wahl)*
- **Immer anders:** Eine Aufgabe kommt frühestens nach 15 anderen wieder dran. Eine Tauschaufgabe (5 + 7 statt
  7 + 5) gilt dabei als dieselbe Aufgabe. *(meine Wahl)* Bei sehr kleinen Mengen, etwa nur Geteilt, reicht die
  Auswahl vielleicht nicht für 15. Dann wird der Abstand so groß wie möglich gehalten.
- Triviale Aufgaben wie 0 + 0 oder 1 · 1 kommen höchstens selten vor. Die Feinheiten regelt der Bauende.

## Die Aufgabe im Bild

- Oben in der Mitte steht groß die Aufgabe, zum Beispiel **7 + 5 = ?**, gut lesbar auf einer Tafel, einem
  Schild oder einer großen Muschel. Die Form ist Sache des Bauenden.
- Daneben ein Fortschritt bis zum nächsten großen Moment, zum Beispiel 10 Perlen, die sich füllen.
- Die Zahl, die das Kind schreibt, wird wie Buchstaben über die Kamera erkannt. Auslösen per Knopf oder
  automatisch wie in den anderen Welten.

## Zahl lesen

- Gewertet werden nur **neu geschriebene** Zeichen (`isNew`), wie bei den Buchstaben. Das Kind kann auf demselben
  Blatt weiterschreiben.
- Neue Zeichen, die nebeneinander auf einer Zeile stehen, werden von links nach rechts zu **einer Zahl**
  zusammengesetzt (1 bis 3 Ziffern, 0–100). Ab welchem Abstand zwei Ziffern zusammengehören, legt der Bauende
  fest. Ziffern sind meist so groß wie ein Buchstabe und stehen eng beieinander.
- Die Erkennung soll im Rechenmeer **nur Ziffern** liefern. Ähnliche Zeichen werden auf die Ziffer umgedeutet,
  etwa O→0 und l/I→1. Sonst gewinnt die wahrscheinlichste Ziffer aus den Kandidaten der Erkennung. Wie das
  technisch geht, entscheidet der Bauende. Ein eigener Ziffern-Modus der Erkennung ist eine gute Möglichkeit.
- Ziffern kennen die Modelle von Druckschrift, Grundschrift und Schreibschrift. Die anderen neun Schriften
  (Hiragana, Katakana, Kyrillisch, Arabisch, Devanagari, Griechisch, Hebräisch, Hangul, Thai) haben keine
  Ziffern. Bei ihnen nutzt das Rechenmeer das Druckschrift-Modell. `GROUPS` fasst `0Oo` und `1Il` schon zusammen.
- **Halb geschriebene Zahl:** Viele Kinder schreiben bei „dreiundzwanzig“ zuerst die 3 und dann die 2 links
  davor. Ein automatischer Scan kann dazwischen fallen. Sind die neuen Ziffern der Anfang oder das Ende des
  richtigen Ergebnisses, wartet das Spiel, statt zu werten. Beim nächsten Scan werden neue Ziffern auf derselben
  Zeile mit den gerade gesehenen zusammengesetzt. *(meine Wahl)*
- **Unsicher gelesen:** Ist die Erkennung bei einer Ziffer sehr unsicher, sagt das Spiel nicht „falsch“. Es fragt
  freundlich nach, etwa: „Ich kann die Zahl nicht gut lesen. Schreib sie noch einmal deutlich!“ Die Aufgabe
  bleibt stehen. Die Schwelle legt der Bauende fest.
- **Spiegelverkehrt geschriebene Ziffern** werden bemängelt, aber akzeptiert (vom Nutzer entschieden). Stimmt das
  Ergebnis, zählt es als richtig und das Tier kommt. Dazu gibt es den Tipp „Andersrum!“ bei der gespiegelten
  Ziffer und eine niedrigere Stufe, so wie die Erkennung gespiegelte Zeichen ohnehin bewertet. Die Einstellung
  „Spiegelschrift zählt nicht“ (`recog.noMirror`) gilt im Rechenmeer nicht.
- **Mehrere Zahlen** in einem Scan: Das Spiel bittet, nur das Ergebnis zu schreiben, und wertet nichts.
  *(meine Wahl)*
- **Keine neue Zahl:** dieselben Hinweise wie bisher („Ich habe nichts Neues gefunden…“).

## Richtig

- Die geschriebene Zahl fliegt wie ein Buchstabe ins Meer (vorhandener Flug-Effekt) und wird zu einem Meerestier
  oder einer Pflanze.
- Die Zahl des Kindes ist darauf sichtbar, auf einem weißen Abzeichen wie in den anderen Welten. Bei
  mehrstelligen Zahlen stehen die Ziffern nebeneinander auf dem Abzeichen.
- Sterne und Stufe (zerknittert bis prachtvoll) richten sich nach dem Durchschnitt der Ziffern. Die
  Schreibtipps erscheinen wie gewohnt beim schwächsten Zeichen.
- Ein kurzes Lob, zum Beispiel „Richtig! 7 + 5 = 12“.
- Dann erscheint die nächste Aufgabe.

### Was ins Meer kommt *(Auswahl meine Wahl)*

- **Kleine Tiere:** Seepferdchen, Clownfisch, Doktorfisch, Kugelfisch, Qualle, Krebs, Schildkröte und Krake.
  Diese Umrisse gibt es schon im Mal-Aquarium (`src/game/paint/species.ts`, mit Bewegungen in `motion.ts`). Im
  Rechenmeer werden sie farbig gefüllt dargestellt, nicht ausgemalt. Dazu kommt neu ein Seestern, der am Boden
  sitzt.
- **Pflanzen:** Seegras, Koralle und Seeanemone, neu zu zeichnen. Sie wachsen auf dem Sand, wiegen sich und
  bleiben stehen.
- Ungefähr jede dritte richtige Antwort wird eine Pflanze, der Rest Tiere. Die Mischung legt der Bauende fest.
- Je schöner die Zahl geschrieben ist, desto prächtiger: kräftigere Farben, Glanz, Funkeln, bei „prachtvoll“
  eine kleine Krone oder Perle, wie in den anderen Welten.
- Die vorhandene Höchstzahl an Wesen (`maxCreatures`) gilt: Wird es zu voll, schwimmt das älteste Tier
  freundlich davon. Pflanzen haben eine eigene Obergrenze. Ist sie erreicht, verschwindet die älteste Pflanze
  sanft. *(meine Wahl)*

## Falsch

- Kein Tier, keine Strafe. Ein kleiner Fisch schwimmt mit einem freundlichen Hinweis heran: „Fast! Schau noch
  mal: 7 + 5“. Die Aufgabe bleibt stehen. *(mein Vorschlag, vom Nutzer nicht widersprochen)*
- Ab dem zweiten Fehlversuch bei derselben Aufgabe gibt es eine Rechenhilfe, die zur Aufgabe passt, zum Beispiel
  ein Zwanzigerfeld mit Plättchen, Zehnerstangen oder Malpunkte. Was genau, entscheidet der Bauende.
  *(meine Wahl)*
- Nach dem dritten Fehlversuch zeigt das Spiel das Ergebnis freundlich mit der Rechenhilfe. Dann kommt eine neue
  Aufgabe, und diese Aufgabe kommt später noch einmal dran. Eine so aufgelöste Aufgabe füllt keine Perle.
  *(meine Wahl)*

## Abschnitt und großer Moment

- Ein Abschnitt dauert **10 richtige Antworten** *(meine Wahl)*. Die Perlen zeigen den Fortschritt.
- Danach kommt abwechselnd einer von zwei großen Momenten *(meine Wahl)*:
  1. **Hai:** Ein großer, freundlicher Hai schwimmt langsam einmal quer durchs Bild. Die kleinen Fische
     schwärmen um ihn herum. Der Hai-Umriss aus dem Mal-Aquarium kann die Grundlage sein.
  2. **Delfine:** Drei bis fünf Delfine springen in einem Bogen über das Bild. Sie sind neu zu zeichnen.
- Ein großer Moment dauert etwa 6–10 Sekunden. Danach geht es mit einer neuen Aufgabe weiter. Während des
  Moments steht keine Aufgabe im Bild. Gescannte Zahlen in dieser Zeit werden nicht gewertet und gehen nicht
  verloren: Das Spiel sagt „Gleich geht's weiter!“.
- Der Hai und die Delfine sind Besucher, keine bleibenden Tiere. *(meine Wahl)*

## Wo es im Spiel auftaucht

- Eine neue Kachel auf dem Startbildschirm: **„🐬 Rechenmeer“** mit dem Hinweis „Rechnen füllt das Meer“
  *(Name meine Wahl)*. Es gibt dann zehn Kacheln. Das Raster muss mit zehn gut aussehen.
- Technisch eine eigene Welt auf der Habitat-Maschine (`src/scenes/habitat.ts`), ähnlich wie das Zauberland
  von `HabitatScene` abgeleitet. Hintergrund und Sand wie im Meer (`src/scenes/aquarium.ts`).
- Der Buchstaben-Übungsmodus und die Überraschungsblasen sind im Rechenmeer aus.
- **Spielstände:** Das Rechenmeer wird gespeichert und geladen wie die anderen Welten, mit Tieren, Pflanzen,
  Perlenfortschritt und der Liste der zuletzt gestellten Aufgaben.
- **Texte:** alle neuen Texte über i18n in alle 17 Sprachen. Rechenzeichen werden überall als + − · : gezeigt.
  *(meine Wahl)*

## Was der Bauende entscheidet

- Aussehen von Aufgabentafel, Perlen, Rechenhilfen, Pflanzen, Seestern und Delfinen.
- Die Mischung der Aufgaben bis 100 und wie selten triviale Aufgaben vorkommen.
- Wie Ziffern zu einer Zahl gruppiert werden und wie die Erkennung auf Ziffern beschränkt wird.
- Ab wann eine Ziffer als „unsicher gelesen“ gilt.
- Genaue Zeiten, Wege und Bewegungen der Tiere und der großen Momente.

## Erfolg

- Ein Kind in Klasse 1/2 kann ohne Hilfe eines Erwachsenen 10 Aufgaben lösen und sieht danach den Hai oder die
  Delfine.
- Richtig geschriebene Ergebnisse werden zuverlässig als richtig erkannt, auch zweistellige.
- In 30 Aufgaben hintereinander fällt keine Wiederholung auf.
