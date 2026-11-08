# Wörter-Zoo

Stand 7.11.2026. Vom Nutzer bestätigt („Ja passt“). Inhalt passend zur 1. Klasse in Bayern (LehrplanPLUS). Mit „(meine Entscheidung)“ markierte Punkte hat der Bauende festgelegt.

## Worum es geht

Ein Bild erscheint (Tier oder Gegenstand), die Kinder schreiben das Wort dazu auf Papier, die App liest das Wort. Stimmt es, wird das Bild lustig lebendig und zieht in den Zoo ein. Es soll lustig sein und zum Schriftspracherwerb der 1. Klasse passen.

## Ablauf

1. Ein großes, freundliches Bild erscheint in der Mitte. Die Erzählstimme sagt „Was ist das? Schreib es auf!“.
2. Die Kinder schreiben das Wort in Druckschrift, Nomen mit großem Anfangsbuchstaben („Hund“).
3. Nach „Fertig!“ setzt die App die neu erkannten Buchstaben, die in einer Zeile nebeneinander stehen, von links nach rechts zu einem Wort zusammen (meine Entscheidung: die längste Gruppe der neuen Zeichen in einer Zeile; Buchstaben gelten als Nachbarn, wenn ihr Abstand höchstens etwa eine Buchstabenbreite ist).
4. **Richtig** (alle Buchstaben stimmen, der erste groß): das Bild wird lebendig (lustige Animation, ein Satz von ihm), die Güte der Schrift zeigt sich wie in den anderen Welten (zerknittert … prachtvoll mit Krone), dann wandert es in den Zoo und das nächste Bild kommt.
5. **Fast** (ein Buchstabe falsch, fehlt oder zu viel, oder nur der große Anfangsbuchstabe fehlt): freundliche Rückmeldung mit dem geschriebenen Wort und dem richtigen darunter, die falsche Stelle markiert („Hunt → Hund“, „hund → Hund – Namen von Dingen schreibt man groß“). Die Kinder schreiben es nochmal. Nach dem dritten „Fast“ gilt das Wort trotzdem als geschafft (meine Entscheidung, damit niemand festhängt).
6. **Daneben** (mehr als ein Fehler oder gar kein Wort): „Schau nochmal genau hin!“ – bei Hilfestufe 2 und 3 wird das Wort kurz eingeblendet.

## Hilfestufen (einstellbar im Startfenster des Spiels)

1. **Abschreiben:** Bild und Wort stehen da.
2. **Merkwort:** das Wort steht 5 Sekunden da und wird dann zugedeckt („Schau – merk dir’s – schreib“). Antippen deckt es wieder auf.
3. **Nur Bild:** die Stimme spricht das Wort langsam in Silben vor („Ba–na–ne“), ein Knopf zeigt den Anfangsbuchstaben.

## Wortmaterial

- **Bekannte Buchstaben:** Die Lehrkraft wählt im Startfenster, welche Buchstaben die Klasse schon kann (wie die Fibel sie einführt). Es kommen nur Wörter, die ganz aus diesen Buchstaben bestehen. Vorgabe: alle.
- **Wörter:** etwa 80 Wörter mit Bild, in drei Stufen: lautgetreu kurz (Oma, Eis, Mama, Ast …), lautgetreu länger (Hund, Maus, Rose, Sofa …), Grundwortschatz 1/2 mit Besonderheiten (Apfel, Banane, Fisch, Schule …). Die Liste orientiert sich am Grundwortschatz der Jahrgangsstufen 1/2 in Bayern; das offizielle Verzeichnis lag dem Bauenden nicht vor (mit dem PDF aus dem LehrplanPLUS-Portal abgleichen, wenn es vorliegt).
- Reihenfolge: zuerst Stufe 1, dann gemischt; jedes Wort erst wieder, wenn alle anderen möglichen dran waren.

## Zoo

Unten im Bild ein bunter Zoo mit Gehegen, Wegen und einem Eingangstor; jedes geschaffte Wort steht dort mit seinem Bild und Namensschild (wie die Kinder es geschrieben haben, als Abzeichen), Tiere bewegen sich, Gegenstände wackeln ab und zu. Ab vielen Einträgen rücken sie enger zusammen.

## Sprache und Sprachen

- Die Inhalte (Wörter, Silben) sind deutsch. Die Kachel erscheint nur, wenn die Seite auf Deutsch ist und eine lateinische Schrift eingestellt ist (meine Entscheidung). Die übrigen Texte des Spiels laufen trotzdem über `t()` und die Übersetzungen.
- Gesprochen: „Was ist das? Schreib es auf!“, die Silben jedes Wortes, ein lustiger Satz je Bild, die Rückmeldungen. Alles im Sprechertext (Aufnahmen) und mit Piper erzeugt.

## Einbau

- Neues Spiel `woerterzoo` im Welten-Zeitplan (Vorgabe: immer an), eigene Kachel mit Vorschaubild, Spielstand (welche Wörter im Zoo stehen) wie bei den anderen Spielen.
- Szene auf Basis von `HabitatScene` (Scan, Flug der Buchstaben, Partikel); die Buchstaben fliegen zum Wortfeld unter dem Bild.

## Nicht-Ziele

Kein Satzschreiben, keine Schreibschrift-Prüfung, keine Wortlisten anderer Sprachen in diesem Schritt.
