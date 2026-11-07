# Klassen-Adventskalender – Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ein Adventskalender, dessen 24 Türchen die Klasse mit kleinen Schreibaufgaben öffnet; hinter jedem eine lustige Überraschung.

**Architecture:** Reines Modul `src/game/advent/advent.ts` (Tage, Aufgaben, Zählregel, Speicher). `AdventScene` in `src/scenes/advent.ts` erbt von `HabitatScene`: Buchstaben fliegen ins heutige Türchen statt Figuren zu werden. Der Kalender ist ein Eintrag `advent` im Welten-Zeitplan (Vorgabe 1.12.–24.12.) und eine Kachel wie die Saisonwelten.

**Tech Stack:** TypeScript, Canvas 2D, vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-adventskalender-design.md`

## Global Constraints

- Texte mit `t`/`tk`, Deutsch als Schlüssel, am Ende in alle 17 Sprachen; Witze dürfen in der Übersetzung durch gleichwertige ersetzt werden.
- Commit-Nachrichten Deutsch mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie `.claude/` oder `.superpowers/`.
- Speicher-Schlüssel `krakelkrone.advent`, Inhalt je Jahr.

## Review Focus

1. Zeichen, die nicht zählen dürfen (zurückgewiesen, gespiegelt, „schief“/„zerknittert“, falscher Buchstabe), und Groß/Klein – Tests in Task 1.
2. Tag außerhalb des Dezembers (Admin „immer an“): Kalender bleibt benutzbar – Test in Task 1.
3. Verpasste Tage: frühestes geschlossenes Türchen bis heute ist die Aufgabe; zukünftige bleiben zu – Test in Task 1.
4. Kaputter oder fremder Speicherinhalt, Jahreswechsel – Test in Task 1.
5. Schrift ohne lateinische Buchstaben – Test in Task 1.

### Task 1: Modell `src/game/advent/advent.ts`
Tage 1–24, `TASKS` (24 Aufgaben der Arten `letter`, `initial`, `nice`, `different`, `name`), `taskText`, `counts`, `needed`, `isDone`, `adventToday`, `currentDay`, `sleepsUntil`, Speicher `loadAdvent`/`saveAdvent`. Test `test/game/advent.test.ts` zuerst.

### Task 2: Einbau als Welt
`advent` in `WORLD_IDS`, `SEASON_IDS`/`SEASON_INFO`, `DEFAULT_PLAN` (12-01 bis 12-24), Server-`WORLD_IDS`, Admin-Farbe; `HabitatId`/`GameMode`; App startet `AdventScene` für `advent`, ohne Üben-Modus. Bestehende Tests anpassen (neun → zehn Einträge, wo sie Saisonwelten zählen).

### Task 3: Szene `src/scenes/advent.ts`
Haus mit 24 Türchen, Wichtel Flocke mit Sprechblase, Fortschritt, Aufspringen, 24 lustige Überraschungen mit Witz, Figur des Tages bleibt, Antippen von Türchen (Zukunft: „Nicht schummeln!“, verpasst: auswählen), Finale an Tag 24, Kachelbild. Test `test/game/adventScene.test.ts`: Buchstaben öffnen das heutige Türchen, falsche nicht, zukünftige Türchen bleiben zu, Speicher wird geschrieben, 30 s Laufzeit ohne NaN, Kachel und Hintergrund decken.

### Task 4: Übersetzungen, Prüfung im Browser, Durchsicht
