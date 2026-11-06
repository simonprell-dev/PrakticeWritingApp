# Vordrucke mit Kronen und Punktraster – Entwurf

Stand: 2026-11-06. Sprache des Produkts: Deutsch, übersetzt in alle 17 Sprachen der App.

## Warum

Die App erkennt ein Blatt heute nur an der Handschrift darauf (`src/vision/dedup.ts`). Daraus entstehen zwei Fehler, die im Alltag stören:

- Manches wird doppelt gescannt, und das Kind bekommt Tiere für alte Buchstaben.
- Eine neue Seite wird nicht als neu erkannt, wenn sie der alten zu ähnlich sieht.

Vordrucke sollen beides beheben: Das Papier selbst sagt der App, welches Blatt es ist und wo es liegt. Außerdem führt jedes gedruckte Blatt über eine Werbeecke zurück zur Seite.

Zusätzlich war der Nutzer mit der Zahlenerkennung im Rechenmeer nicht zufrieden. Das Rechenmeer kommt vorerst aus der App.

## Ziele

1. Rechenmeer für Nutzer nicht mehr erreichbar, Code bleibt im Repo.
2. Druckbare Vordrucke für alle Papierarten, als A4 und A5.
3. Die App erkennt auf einem Vordruck sicher, welches Blatt es ist, auch wenn die Kamera nah dran ist und keine Ecke sieht.
4. Kein doppeltes Zählen, keine übersehene neue Seite auf Vordrucken.

## Nicht-Ziele

- Überarbeiten des Rechenmeers oder der Ziffernerkennung.
- Änderungen an den Karten des Mal-Aquariums.
- Vordrucke mit vorgegebenen Aufgaben, Buchstaben oder Übungswörtern.

## Was auf keinen Fall passieren darf

- Der Vordruck stört das Kind beim Schreiben oder sieht nach Technik aus.
- Gedruckte Teile (Kronen, Punkte, Werbeecke) werden als Schrift gelesen und erzeugen Tiere.
- Normales Papier funktioniert schlechter als heute.
- Ein Vordruck funktioniert schlechter als normales Papier, wenn die Marken einmal nicht lesbar sind.

## Vom Nutzer entschieden

- **Rechenmeer:** rausnehmen, „erst mal“. Der Vorschlag, es nur auszublenden, blieb unwidersprochen.
- **Papierarten:** alle Möglichkeiten: Lineatur 1, 2, 3, liniert, kariert, blanko.
- **Formate:** A4 und A5.
- **Ecken:** vier kleine Kronen, die nach oben zeigen.
- **Zeilen (Lineatur 1 und 2):** ganze Zeile hell getönt, Mittelband etwas kräftiger, Grundlinie dunkler, weißer Streifen zwischen den Zeilen. Blasser als der erste Entwurf.
- **Hintergrund:** feines Punktraster über das ganze Blatt, Stufe „Blass“.
- **Werbeecke:** unten rechts, mit QR-Code zur Seite.
- **Woher die Blätter kommen:** Gedruckt wird aus der App, Kopieren soll aber auch gehen und kommt vermutlich regelmäßig vor.
- **Kameraabstand:** sehr unterschiedlich, vom ganzen Blatt im Bild bis nah dran.
- **Neue Kopie mit ähnlichem Inhalt:** Der Knopf „Neues Blatt“ reicht. Es gibt kein Ankreuzfeld auf dem Vordruck. Dass die App solche Kopien nicht selbst trennt, ist damit akzeptiert. Ziel 4 gilt bei Kopien nur, soweit die Handschrift sie unterscheidet.

Werte aus dem bestätigten Entwurf (`.superpowers/brainstorm/20233-1793962075/content/`, nicht im Repo):

| Teil | Wert |
|---|---|
| Zeile, Fläche | `#f8fafe` |
| Mittelband | `#e3edfa` |
| Linien | `#b3c4de`, 0,3 mm |
| Grundlinie | `#7f9ccb`, 0,5 mm |
| Krone | `#6d6680`, etwa 9 × 6 mm, Mitte 10 mm vom Rand |
| Punkte | `#d9dde8`, Radius 0,16 mm, Abstand etwa 3 mm |
| Lineatur 1 | Bänder 5 mm, Zeilenabstand 24 mm |
| Lineatur 2 | Bänder 4 mm, Zeilenabstand 19 mm |
| Lineatur 3 | Mittelband 4 mm, Zeilenabstand 11 mm |
| Liniert | Abstand 8 mm |
| Kariert | 5 mm |
| Werbeecke | etwa 66 × 22 mm: QR-Code, „Krakel & Krone“, „Weiter schreiben? Scannen!“, krakelkrone.prelldynamics.de |

## Ablauf in vier Stufen

Die Reihenfolge ist wichtig: Stufe 2 entscheidet, ob Stufe 3 und 4 so gebaut werden.

### Stufe 1: Rechenmeer ausblenden

Kachel auf dem Startbildschirm, Abschnitt in den Einstellungen und gespeicherte Rechenmeer-Spiele sind nicht mehr zu sehen. Der Code und die Tests bleiben. Das Einschalten soll eine einzige Stelle im Code sein. Der Ziffern-Modus der Erkennung wird dadurch nicht mehr aufgerufen.

### Stufe 2: Testblatt (Machbarkeit)

Das ist der unsicherste Teil. Die Punkte sind sehr hell und winzig. Viele Drucker bilden helle Töne nur als gestreute Rasterpunkte ab, und ein 0,32-mm-Punkt besteht dann aus wenigen Druckpunkten. Die Kamera liefert höchstens 1920 × 1080 (`src/camera/camera.ts`). Das ergibt bei einem ganzen A4-Blatt im Bild höchstens etwa 5 Pixel pro mm, von nah (etwa 100 mm Bildbreite) etwa 18. `Camera.grab` verkleinert das Bild zusätzlich auf `DETECT_SIZE`. Für die Marken darf deshalb ein eigenes Bild in voller Auflösung gegriffen werden, die Erkennung auf normalem Papier behält ihre Eingabe.

Ein Wegwerf-Testblatt mit mehreren Helligkeiten und Punktgrößen, dazu ein Messwerkzeug in `?debug` oder `src/lab/`. Der Nutzer druckt es aus und hält es vor die eigene Kamera.

**Bestanden** ist eine Stufe, wenn sie auf dem Drucker und der Kamera des Nutzers, in der Kamera-Betriebsart des Nutzers, in mindestens 9 von 10 Aufnahmen lesbar ist und nicht als Schrift erscheint. Das gilt für alle sechs Papierarten, denn ein Punkt auf dem getönten Mittelband hat weniger Kontrast als auf Weiß. Die Punktfarbe darf sich je Papierart unterscheiden, solange es für das Auge gleich blass wirkt.

Reicht „Blass“ nicht, legen wir dem Nutzer vor, was nötig wäre (dunkler, größer oder die Mini-Kronen aus dem Entwurf). Diese Entscheidung trifft der Nutzer. Vorher wird Stufe 3 und 4 nicht gebaut.

### Stufe 3: Vordrucke drucken

In den Einstellungen gibt es einen Knopf „Vordrucke drucken“. Der Dialog fragt Papierart, Format und Blattzahl (1 bis 30). Gedruckt wird wie beim Mal-Aquarium aus der Seite heraus (`src/ui/printSheet.ts`), also ohne Pop-up, die Seitengröße passt sich dem Format an. Die Maße sind echte Millimeter und werden für A5 nicht verkleinert: A5 hat einfach weniger Zeilen.

Der Druck muss mit 100 % Skalierung erfolgen, der Dialog weist darauf hin. Der QR-Code zeigt immer auf `https://krakelkrone.prelldynamics.de`, auch beim lokalen Testen.

### Stufe 4: Blätter erkennen

- **Blattnummer:** Jedes gedruckte Blatt bekommt eine neue, zufällige Nummer. Sie steht zweimal auf dem Blatt, weil der Kameraabstand stark schwankt: in den gut sichtbaren Kästchen unten links für den Blick aufs ganze Blatt und im Punktraster für den Blick von nah. Das Raster trägt zusätzlich die Stelle auf dem Blatt. Jeder Ausschnitt von etwa 100 × 65 mm muss reichen, um Nummer und Lage zu lesen.
- **Lage:** Das Punktraster liefert Lage und Drehung, die Kronen helfen, wenn sie im Bild sind. Ein gedrehtes Blatt wird als dasselbe Blatt erkannt und zählt nichts doppelt. Neue Buchstaben auf einem gedrehten Blatt werden wie heute in Kamera-Richtung gelesen, das Bild wird nicht gerade gerechnet.
- **Gleiche Nummer:** Es ist dieselbe Vorlage. Passt die Handschrift zu einem bekannten Inhalt, ist es dieses Blatt, und nur Neues zählt, auch wenn es verrutscht ist oder Tage später wiederkommt. Bei einer Kopie mit anderem Inhalt beginnt ein neuer Inhalt unter derselben Nummer.
- **Andere Nummer:** Es ist immer ein neues Blatt, und es erscheint die bekannte Meldung „Neues Blatt erkannt!“.
- **Papierart:** Steht die Lineatur in den Einstellungen auf „Automatisch“, gilt die Papierart aus der Nummer. Eine fest eingestellte Lineatur bleibt bestehen.
- **Gedrucktes ausblenden:** Sobald die Lage bekannt ist, werden Kronen, Werbeecke und Punkte aus der Erkennung herausgerechnet.
- **Marken nicht lesbar:** Die App arbeitet wie heute über die Handschrift weiter. Kronen und Werbeecke dürfen auch dann keine Tiere erzeugen.
- **Normales Papier:** bleibt unverändert.

## Vom Entwurf getroffene Entscheidungen (nicht vom Nutzer bestätigt)

- **Kopien, wie es funktioniert:** Kopien sind regelmäßig zu erwarten und tragen alle dieselbe Nummer. Die Nummer sagt dann nur, welche Vorlage es ist, nicht welche Kopie. Unter einer Nummer merkt sich die App deshalb mehrere Inhalte: Passt die Handschrift zu einem bekannten Inhalt, ist es dieses Blatt, sonst ein neues. Der Kopierer verliert die hellen Punkte vermutlich. Kronen und Kästchen sollten überstehen. Das wird in Stufe 2 mit einer echten Kopie geprüft. Der Druckdialog sagt, dass frisch gedruckte Blätter besser erkannt werden als Kopien. Die Blattzahl im Druckdialog geht deshalb bis 30.
- **A5:** wird direkt auf A5 gedruckt, nicht zu zweit auf A4.
- **Druckknopf:** sitzt in den Einstellungen.
- **Handschrift-Prüfung bei gleicher Nummer:** Sie vergleicht nur den Teil des Blatts, der in beiden Aufnahmen zu sehen ist. Ein neu beschriebener Bereich desselben Blatts löst sie also nicht aus. Die heutige Regel in `GlyphMemory.match` wird dafür nicht unverändert übernommen.
- **Knopf „Neues Blatt“:** löscht bei Vordrucken nur das Gedächtnis des aktuellen Blatts.
- **Spiele:** Nummer und Gedächtnis gelten in den Welten mit Blatt-Erkennung. Duell, Riesenburg und Türme bleiben unverändert, Vordrucke sind dort nicht vorgesehen.
- **Mehrere Blätter im Bild:** werden nicht unterstützt. Zeigt ein Bild zwei Nummern, gilt das Blatt, das mehr Bildfläche einnimmt.
- **Gedächtnis:** Pro Spielstand merkt sich die App die letzten 30 Blätter, ältere fallen heraus.
- **Marken im Schreibbereich:** Die Punkte liegen auch unter der Schrift. Das ist die Folge von Variante B und wird in Stufe 2 mitgeprüft.
- **Text der Werbeecke:** „Weiter schreiben? Scannen!“ stammt aus dem Entwurf.

## Dem Bauenden überlassen

- Wie die Nummer im Raster steckt (zum Beispiel leicht versetzte Punkte), inklusive Fehlerkorrektur.
- Wie der QR-Code erzeugt wird. Eine kleine Bibliothek ist in Ordnung.
- Wie das Gedächtnis pro Blatt im Spielstand gespeichert wird.
- Wie die Papierart „kariert“ auf die Erkennung abgebildet wird. Die Einstellungen kennen kein Kariert, die Erkennung aber schon.

## Fertig ist es, wenn

- das Rechenmeer nirgends mehr auftaucht,
- alle sechs Papierarten in A4 und A5 gedruckt werden können,
- dasselbe Blatt nach Verschieben, Drehen und Näherrücken nichts doppelt zählt,
- zwei gleich beschriebene Blätter mit verschiedenen Nummern als zwei Blätter erkannt werden,
- die bestehenden Tests weiter laufen und normales Papier sich nicht verändert hat,
- ein Durchlauf mit echtem Ausdruck und echter Kamera gemacht wurde.
