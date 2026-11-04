# Zauberland: Einhörner, Prinzessinnen und eine Burg, die wächst

Stand: 04.11.2026

## Worum es geht

Eine vierte Welt neben Meer, Weltraum und Savanne, gebaut auf derselben Habitat-Maschine
(`src/scenes/habitat.ts`). Kinder schreiben wie gewohnt mit Stift auf Papier. Aus jedem erkannten Buchstaben
entsteht etwas in einer Fantasiewelt aus Wiese, Himmel und Regenbögen mit einer Burg in der Mitte.

Das Kind schaut nur zu: Alles passiert von allein, so wie im Meer und in der Savanne. Antippen zeigt wie
überall nur die Karte mit dem Buchstaben, sonst nichts.

## Was aus einem Buchstaben wird (vom Nutzer entschieden: Zufall)

Jeder Buchstabe wird **per Zufall** zu einem von drei Dingen:

1. **Fabelwesen.** Meistens ein Einhorn. Seltener ein Pegasus (Flügel, ohne Horn) oder ein Glücksdrache
   (klein, rund, freundlich). Die Seltenheit ist meine Wahl.
2. **Prinzessin.**
3. **Burgteil.** Die Burg wächst damit um ein Zimmer, einen Turm, ein Tor, eine Brücke oder einen Fahnenmast.

Die Gewichtung ist meine Wahl: etwa 40 % Fabelwesen, 30 % Prinzessin und 30 % Burgteil. Ist die Burg
vollständig ausgebaut (siehe unten), wird nur noch zwischen Fabelwesen und Prinzessin gelost.

Wie in allen Welten gilt: **Je schöner geschrieben, desto prächtiger.** Die Genome-Stufen (zerknittert bis
prachtvoll) steuern Farbe, Glanz, Funkeln und Krone wie bisher. Dazu kommen hier:

- **Einhorn:** Je schöner geschrieben, desto länger und glänzender das Horn. Bei „prachtvoll“ hat es eine
  Regenbogenmähne.
- **Prinzessin:** Die Stufe wählt das Kleid, von schlicht bis glitzernd mit Schleppe. Ein Diadem gibt es ab
  „schön“, die große Krone bei „prachtvoll“.
- **Burgteil:** Form und Mauerwerk sind bei allen Teilen gleich, damit die Burg aus einem Guss wirkt. Die
  Stufe ändert nur die Ausschmückung, also Dachfarbe, Fahne, Blumenkasten am Fenster und Goldrand. Bei
  „zerknittert“ hängt die Fahne schlapp, bei „prachtvoll“ glänzt das Dach golden. Das ist meine Wahl.

Der Buchstabe des Kindes ist immer sichtbar, wie in den anderen Welten auf einem weißen Abzeichen:

| Was entsteht | Wo der Buchstabe sitzt |
|---|---|
| Fabelwesen | Flanke |
| Prinzessin | Kleid oder Brosche |
| Burgteil | Wappenschild über Fenster oder Tor |

Antippen öffnet die Buchstabenkarte wie überall, auch bei Burgteilen.

## Die Burg

- Die Burg steht auf einem Hügel in der Bildmitte hinten. Sie wird nicht in das feste Hintergrundbild gemalt,
  sondern jedes Mal neu gezeichnet, weil sie wächst.
- **Zu Beginn** steht ein kleiner Grundbau: Tor, ein Zimmer und ein Turm. Er zählt als 2 von 18 Plätzen, das
  sind das Zimmer und der Turm. So bekommt die erste Prinzessin gleich ein Zimmer. Das ist meine Wahl.
- **Wachstum:** Ein Burgteil fliegt wie ein schlüpfender Buchstabe zur Burg und setzt sich mit einem kurzen
  „Bau-Plopp“ samt Staubwölkchen an seinen Platz.
- **Feste Ausbaustufen:** Die Reihenfolge der Plätze ist fest und baut von unten nach oben, links und rechts
  im Wechsel. So sieht die Burg auf jeder Stufe stimmig aus und nie wie ein zufälliger Haufen. Die Art des
  nächsten Teils ergibt sich aus dem Platz:
  - unten Zimmer und Mauer;
  - an den Ecken Türme;
  - oben Dachzimmer und Spitztürme;
  - ganz oben Fahnen.
- **Statik:** Zimmer stehen nur auf dem Grund oder auf einem Zimmer darunter. Türme, Spitztürme und Fahnen
  sitzen auf einem gebauten Zimmer oder an einer Ecke der Mauer. So schwebt nichts in der Luft.
- **Zwei Wege beim Bauen:**
  - Ein **Burgteil** aus einem Buchstaben nimmt immer den nächsten freien Platz in der festen Reihenfolge,
    dessen Unterbau steht.
  - Ein **automatisch gebautes Zimmer** für eine Prinzessin nimmt den nächsten freien *Zimmer*platz, dessen
    Unterbau steht. Turm- oder Fahnenplätze, die es dabei überspringt, bleiben frei und werden später von
    Burgteilen gefüllt.
- **Höchstgröße:** 18 Plätze, davon 12 Zimmer mit Fenster. Diese Größe ist meine Wahl. Sie soll auf einem
  Beamer bei 1920 px Weltbreite noch gut aussehen. Danach ist die Burg vollständig ausgebaut.
- **Burgteile ziehen nie aus.** Sie zählen nicht zur Höchstzahl an Wesen (`maxCreatures`).

### Burgzimmer der Prinzessinnen (vom Nutzer: jede Prinzessin braucht eines)

- Jede Prinzessin bekommt **ihr eigenes Zimmer**. Die Wahl, welches Zimmer, ist meine: das niedrigste freie
  Zimmer. Ein Zimmer erkennt man an seinem Fenster.
- **Ist kein Zimmer frei**, baut die Burg sofort ein Zimmer dazu, auf dem nächsten freien Zimmerplatz. Der
  Bau läuft mit derselben Animation wie bei einem Burgteil, nur ohne eigenen Buchstaben. Es trägt ein leeres
  Wappenschild, und Antippen öffnet keine Karte. Im Spielstand steht es ohne Buchstabe. Diese Regeln sind
  meine Wahl.
- **Burg voll:** Ist die Burg vollständig ausgebaut und alle 12 Zimmer sind besetzt, wird keine weitere
  Prinzessin mehr gelost. Kommt trotzdem eine dazu, zum Beispiel aus einem Spielstand, wohnt sie mit im
  Zimmer der ältesten Prinzessin. Das ist meine Wahl für den Randfall.
- **Auszug:** Zieht eine Prinzessin wegen der Höchstzahl aus, wird ihr Zimmer wieder frei. Das Zimmer selbst
  bleibt stehen.

## Was die Prinzessinnen tun (vom Nutzer gewünscht)

Eine Prinzessin wechselt von allein zwischen diesen Zuständen:

- **Spazieren** über die Wiese vor der Burg.
- **Hineingehen:** Sie läuft zum Burgtor und verschwindet darin.
- **Aus dem Fenster schauen:** Kurz danach erscheint ihr Kopf mit Oberkörper im Fenster ihres Zimmers. Sie
  winkt oder schaut nach links und rechts. Danach verschwindet sie wieder.
- **Aus der Tür schauen:** Sie steht im offenen Burgtor, schaut heraus und kommt wieder heraus.
- **Reiten:** Sie geht zu einem freien Einhorn und steigt auf. Beide laufen oder traben zusammen eine Weile
  über die Wiese, dann steigt sie wieder ab. Ein Pegasus oder Drache kann auch geritten werden; diese
  Erweiterung ist meine Wahl.

Die Häufigkeiten stimmt der Builder so ab, dass etwa alle 10 bis 20 Sekunden irgendwo etwas Sichtbares
passiert. In der Burg bleibt sie höchstens 15 Sekunden, damit die Kinder sie wiederfinden.

## Was die Fabelwesen tun

- Fabelwesen grasen, laufen, traben und hüpfen auf der Wiese wie die Savannentiere: in der Tiefe gestaffelt
  und nach y sortiert.
- Pegasus und Drache flattern ab und zu kurz hoch.

### Die Herde und der Regenbogenflug (vom Nutzer gewünscht)

- **Wann:** Sind mindestens **3 Fabelwesen** da, sammelt sich die Herde. Das passiert alle 40 bis 70
  Sekunden, und frühestens 10 Sekunden nachdem das dritte Wesen geschlüpft ist. Die Zahl 3 und die Abstände
  sind meine Wahl.
- **Sammeln:** Alle Fabelwesen laufen zu einem Sammelpunkt auf der Wiese. Bilden sie dort einen engen Pulk,
  werfen sie kurz die Köpfe hoch.
- **Flug:** Gemeinsam heben sie ab und fliegen einen großen **Bogen** über den Himmel, hintereinander mit
  kleinem Versatz, von einer Seite zur anderen. Wesen ohne Flügel fliegen auch, mit Glitzerspur an den Hufen.
  Eine reitende Prinzessin fliegt mit.
- **Regenbogen:** Der Flugweg hinterlässt einen **Regenbogen**, der genau dem Bogen folgt. Er entsteht beim
  Fliegen Stück für Stück, bleibt etwa 20 Sekunden stehen und verblasst dann langsam. Gleichzeitig steht
  höchstens ein Regenbogen am Himmel, damit es nicht unruhig wird. Das ist meine Wahl.
- **Landen:** Nach dem Bogen landen sie auf der anderen Seite der Wiese und verteilen sich wieder.
- Die Farben des Regenbogens sind die üblichen sieben. Nur der Bogen ist Spektralfarbe, keine anderen Inhalte
  dieser Welt.

## Hintergrund und Stimmung

- Zartvioletter bis rosa Himmel mit Wolken, die vorbeiziehen, und ein paar Glitzersternen.
- Hügel in Pastellfarben, eine Blumenwiese und ab und zu Schmetterlinge oder Glühwürmchen.
- Ein kleiner fester Regenbogen ist **nicht** im Hintergrund, damit der Herdenflug etwas Besonderes bleibt.
- Geräusche: die vorhandenen `sfx` wiederverwenden. Für den Regenbogenflug darf der Builder einen neuen
  kurzen Glitzerklang synthetisieren, wenn `audio.ts` das ohne neue Dateien hergibt.

## Was sonst wie in den anderen Welten bleibt

- **Üben-Modus:** Er funktioniert unverändert, einschließlich Vorschreib-Animation, Fortschritt und
  Überraschungsblase mit Buchstaben.
- **Einschlüpf-Animation:** Polaroid und Buchstabe fliegen ins Bild wie in den anderen Welten.
- **Höchstzahl an Wesen:** Fabelwesen und Prinzessinnen zählen zu `maxCreatures`. Die ältesten gehen:
  - Fabelwesen galoppieren oder fliegen zum Rand hinaus;
  - Prinzessinnen gehen zum Rand hinaus.
- **Spielstände:**
  - Gespeichert werden die Art jedes Wesens, die Zimmerzuordnung der Prinzessinnen und alle Burgteile mit
    Platz und Buchstabe.
  - Ein gespeichertes Spiel lädt wieder genau diese Burg.
  - Ältere Spielstände der anderen Welten bleiben unberührt.
- **Zähler oben:** zum Beispiel „5 Einhörner · 3 Prinzessinnen · Burg 7/18“. Er zeigt, was **gerade da**
  ist; Ausgezogene zählen nicht mit. Das ist meine Wahl und braucht keine Zählung pro Art im Spielstand. Für
  die Spielstand-Liste (`summary`) und den allgemeinen Zähler gilt weiter die Gesamtzahl wie in den anderen
  Welten. Die genaue Form ist dem Builder überlassen.
- **Startbildschirm:** neue Kachel „🦄 Zauberland“ mit „Einhörner, Prinzessinnen und eine Burg“. Die Vorschau
  in `previews.ts` zeigt die Burg, ein Einhorn und eine Prinzessin. Den Namen „Zauberland“ habe ich gewählt.
- **Übersetzung:** Alle neuen Texte bekommen `t()`/`tk()` und werden in alle 17 Sprachdateien übersetzt, wie
  bei den anderen Welten.

## Ziele

- Es entsteht eine Welt, in der Kinder minutenlang gern zuschauen, weil immer wieder etwas passiert.
- Kinder finden „ihre“ Prinzessin und „ihr“ Burgstück am Buchstaben wieder.
- Die Burg sieht auf jeder Ausbaustufe hübsch und stimmig aus.
- Der Herdenflug mit Regenbogen ist der Höhepunkt und klar erkennbar ein Bogen.
- Die Bildrate auf einem Schul-Laptop bleibt so gut wie in der Savanne. Die Burg ändert sich nur beim
  Wachsen, deshalb wird sie zwischengespeichert und nur dann neu gezeichnet.

## Nicht-Ziele

- Das Kind steuert nichts, nur Zuschauen und Antippen für die Karte.
- Kein Einbau in den Vorstellungsfilm in diesem Schritt (kann später folgen).
- Keine Innenansicht der Burg und kein Hineinzoomen in Zimmer.
- Keine Malkarten für diese Welt.

## Was es zum Scheitern bringen würde (Anti-Ziele)

- Figuren erinnern erkennbar an bekannte Marken, zum Beispiel an bestimmte Film-Prinzessinnen oder
  Pony-Serien. Prinzessinnen und Einhörner müssen eigene, schlichte Figuren im Stil der vorhandenen
  Krakel-Wesen sein: runde Formen, große Augen, dicke Konturen.
- Die Burg wächst zu einem unordentlichen Haufen oder aus dem Bild hinaus.
- Eine Prinzessin hat kein Zimmer, oder zwei teilen sich ein Zimmer, obwohl noch Platz ist.
- Wesen verschwinden plötzlich vor den Augen der Kinder.
- Es gibt so viel Glitzer und Bewegung, dass das Bild auf dem Beamer unruhig wirkt.

## Dem Builder überlassen

- Die genaue Zeichnung von Figuren, Burgteilen und Hintergrund, im Stil von `src/game/creatures/*`.
- Wie die Art (Fabelwesen, Prinzessin oder Burgteil) technisch in `HabitatDef` und `HabitatScene` kommt, zum
  Beispiel über `genome.variant` oder ein eigenes Feld.
- Zeitwerte der Zustände, solange die Häufigkeiten oben ungefähr stimmen.
- Tests: mindestens
  - Zimmervergabe (jede Prinzessin hat ein Zimmer, kein Doppelzimmer solange frei);
  - Reihenfolge und Grenzen des Burgwachstums;
  - wann die Herde startet;
  - Speichern und Laden im Kreis.
