# Klassen-Adventskalender

Stand 7.11.2026. Vom Nutzer bestätigt („Passt mach das“) nach einem Vorschlag des Bauenden; der Nutzer wollte keine Detailfragen („überlege dir selbst was, es soll immer lustig sein“). Mit „(meine Entscheidung)“ markierte Punkte hat der Bauende festgelegt.

## Worum es geht

Vom 1. bis 24. Dezember öffnet die Klasse jeden Tag ein Türchen, indem sie eine kleine Schreibaufgabe auf Papier löst. Hinter jedem Türchen wartet eine lustige Überraschung. Es soll immer lustig sein.

## Was die Klasse erlebt

- **Kachel** „🎁 Adventskalender“ auf dem Startbildschirm, im Admin geplant wie die Saisonwelten (Vorgabe 1.12.–24.12., Id `advent`).
- **Kalenderwand:** ein verschneites, großes Haus mit 24 nummerierten Türchen (Fenster, Läden, Tür, Dachluke …) bei Abendlicht, Schneefall. Das heutige Türchen wackelt und kichert. Offene Türchen zeigen ihre Figur.
- **Wichtel Flocke:** steht vor dem Haus, stellt die Aufgabe des Tages in einer Sprechblase, kommentiert frech (lobt, wenn etwas geklappt hat; „Fast!“ bei knapp daneben).
- **Aufgabe lösen:** Die Klasse schreibt, die Kamera scannt. Passende, ordentlich geschriebene Zeichen fliegen ins heutige Türchen; jedes lässt es mehr glitzern und rütteln, ein Fortschrittsband zeigt „3 von 5“. Ist die Aufgabe geschafft, springt das Türchen auf.
- **Überraschung:** Hinter jedem Türchen eine lustige Szene mit einer Figur aus den Winter- und Weihnachtswelten, z. B. ein Rentier niest Konfetti, der Schneemann verliert seine Karottennase und ein Hase klaut sie, ein Geschenk hüpft weg, ein Wichtel fällt in den Keksteig. Dazu ein kindgerechter Witz des Tages. Danach bleibt die Figur des Tages (mit dem schönsten Buchstaben der Aufgabe als Abzeichen) vor dem Haus und läuft dort herum.
- **Nicht schummeln:** Ein zukünftiges Türchen antippen → Flocke: „Nicht schummeln! Noch 3 Mal schlafen.“ (Zahl der Tage).
- **Nachholen:** Verpasste Tage (Wochenende) lassen sich antippen und als aktuelle Aufgabe wählen. Ohne Auswahl ist die Aufgabe die des frühesten noch geschlossenen Tages bis heute (meine Entscheidung: so holt die Klasse am Montag automatisch Samstag und Sonntag nach, einen nach dem anderen).
- **Türchen 24:** großes Finale, alle Figuren der offenen Türchen tanzen, Konfetti, Stern auf dem Dach leuchtet.
- **Speicherung:** Der Kalender merkt sich pro Gerät und Jahr, welche Türchen offen sind und mit welchem Buchstaben (Browser-Speicher, unabhängig von der Spielstand-Einstellung). Ein Gerät = eine Klasse.

## Aufgaben

24 feste Aufgaben, über den Dezember etwas schwerer (meine Entscheidung). Arten (die Art „Anfangsbuchstabe eines Weihnachtsworts“ ist entfallen, weil das Wort in jeder Sprache anders anfängt; meine Entscheidung):
- `letter`: „Schreib 3 schöne K“ – ein bestimmter Buchstabe (Groß/Klein egal), Anzahl n.
- `nice`: „Schreib 5 Buchstaben ganz schön“ – beliebige Zeichen mit Güte mindestens „schön“.
- `different`: „Schreib 4 verschiedene Buchstaben“ – n verschiedene Zeichen.
- `name`: „Schreib die Buchstaben von STERN“ – die Buchstaben eines (deutschen, in Großbuchstaben gezeigten) Wortes, jeder so oft wie im Wort, in beliebiger Reihenfolge.
Außerhalb des Dezembers (Admin „immer an“) dürfen alle Türchen auf (meine Entscheidung). Ein Zeichen zählt, wenn es nicht zurückgewiesen ist, nicht spiegelverkehrt und mindestens „nett“ ist (bei `nice` mindestens „schön“). In einer Schrift ohne lateinische Buchstaben (Schriften der Welt) gelten alle Aufgaben als `nice`/`different` mit gleicher Anzahl (meine Entscheidung), damit der Kalender überall geht.

## Nicht-Ziele

- Keine Synchronisation zwischen Geräten, keine Accounts.
- Keine Aufgaben aus dem Admin; die 24 Aufgaben stehen im Code.
- Kein Einfluss auf die Weihnachtswelt (die Figur bleibt im Kalender).

## Baustein-Entscheidungen

- Szene `AdventScene` erbt von `HabitatScene` (Scan, Flug der Buchstaben, Partikel, Album wie gewohnt); Buchstaben werden zu Türchen-Fortschritt statt zu Figuren. Kein Üben-Modus und keine Überraschungsblasen im Kalender.
- Reines Modul `src/game/advent/advent.ts` für Tage, Aufgaben, Prüfung, Speicher.
- Witze und Überraschungen: 24 Einträge, freundlich, für Grundschulkinder verständlich; Übersetzungen dürfen den Witz durch einen gleichwertigen kindgerechten Witz der Sprache ersetzen.
