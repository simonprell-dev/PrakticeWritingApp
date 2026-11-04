# Rechenmeer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine neue Welt „Rechenmeer“ für Klasse 1/2. Oben steht eine Zufallsaufgabe. Das Kind schreibt das Ergebnis auf Papier. Jede richtige Antwort setzt ein Meerestier oder eine Pflanze ins Meer. Nach 10 richtigen Antworten kommt ein Hai oder springen Delfine.

**Architecture:**
- **Reine Logik, canvasfrei und getestet:**
  - Aufgaben-Generator: `src/game/math/tasks.ts`
  - Zahl aus Ziffern lesen: `src/game/math/readNumber.ts`
- **Erkennung:** bekommt einen Ziffern-Modus (`digits`), durchgereicht von `VisionOptions` über `pipeline.ts` bis `Recognizer.analyze`.
- **Szene:** `RechenScene extends HabitatScene`, wie `ZauberScene`.
  - Sie ersetzt `handleScan`, weil eine Zahl aus mehreren Zeichen ein Wesen ergibt.
  - Sie ersetzt außerdem `renderCreatures`, `behave`, `saveState`/`restoreState` und `countText`.
- **Meerestiere:** farbig gefüllte Umrisse aus `src/game/paint/species.ts` mit den Bewegungen aus `motion.ts`.

**Tech Stack:** TypeScript, Canvas 2D, Vite, vitest (`npx vitest run --no-file-parallelism`), @napi-rs/canvas in Tests (`setCanvasFactory`).

**Spec:** `docs/superpowers/specs/2026-11-04-rechenmeer-design.md`

## Global Constraints

- **Kachel:** Habitat-Id `rechenmeer`, Titel „🐬 Rechenmeer“, Hinweis „Rechnen füllt das Meer“. Es gibt dann zehn Kacheln, das Raster muss mit zehn gut aussehen.
- **Aufgabenarten:** `plus20`, `minus20`, `pm100`, `mal` (Kernaufgaben: Reihen 1, 2, 5, 10, Quadratsätze bis 10·10, mal 0, beide Reihenfolgen) und `geteilt` (Umkehr der Kernaufgaben, ohne Rest, Divisor ≠ 0). Voreinstellung nur `plus20` und `minus20`. Mindestens eine Art bleibt angekreuzt.
- **Zahlenbereich:** Alle Zahlen und Ergebnisse liegen zwischen 0 und 100. Bei Plus und Minus bis 20 ist die Summe ≤ 20 bzw. der Minuend ≤ 20, und das Ergebnis ist nie negativ.
- **Abstand:** Eine Aufgabe kommt frühestens nach 15 anderen wieder. Eine Tauschaufgabe gilt als dieselbe. Die angekreuzten Arten kommen etwa gleich oft dran.
- **Antwort:** Nur das Ergebnis, 1 bis 3 Ziffern. Im Rechenmeer liefert die Erkennung nur Ziffern.
- **Schriften:** Ist die gewählte Schrift nicht `seg: 'latin'`, wird mit dem Modell `druck` erkannt.
- **Spiegelschrift:** Wird bemängelt, aber akzeptiert. Es gibt den Tipp „Andersrum!“ und eine niedrigere Stufe. `noMirror` gilt im Rechenmeer nicht.
- **Unklare Fälle:**
  - Ziffer unsicher gelesen: Das Spiel fragt nach, die Aufgabe bleibt stehen.
  - Mehrere Zahlen in einem Scan: Bitte, nur das Ergebnis zu schreiben. Es wird nichts gewertet.
  - Die neuen Ziffern sind Anfang oder Ende des richtigen Ergebnisses: Das Spiel wartet und setzt beim nächsten Scan zusammen.
- **Fehlversuche:**
  - 1. Fehlversuch: freundlicher Hinweis, die Aufgabe bleibt.
  - Ab dem 2. Fehlversuch: Rechenhilfe.
  - Nach dem 3. Fehlversuch: Das Spiel zeigt die Lösung mit der Rechenhilfe, dann kommt eine neue Aufgabe. Die alte Aufgabe kommt später wieder. Dafür gibt es keine Perle und kein Tier.
- **Abschnitt:** 10 richtige Antworten. Danach abwechselnd Hai und Delfine (3–5), 6–10 s lang. Während des großen Moments steht keine Aufgabe im Bild. Scans in dieser Zeit werden nicht gewertet, das Spiel sagt „Gleich geht's weiter!“.
- **Was ins Meer kommt:** Etwa jede dritte richtige Antwort wird eine Pflanze (Seegras, Koralle, Seeanemone).
  - Tiere: Seepferdchen, Clownfisch, Doktorfisch, Kugelfisch, Qualle, Krebs, Schildkröte, Krake und neu ein Seestern.
  - Für Tiere gilt `maxCreatures`. Pflanzen haben eine eigene Obergrenze von 12; ist sie erreicht, verschwindet die älteste Pflanze sanft.
- **Anti-Ziele:** Keine Zeitbegrenzung, kein Countdown, keine Strafe. Kein Tier geht wegen eines Fehlers. Der Hai ist freundlich.
- **Aus im Rechenmeer:** Buchstaben-Übungsmodus und Überraschungsblasen. `practiceTarget` liefert `undefined`, `bonusLetters()` liefert `[]`.
- **Übersetzung:** Alle sichtbaren Texte in `t()`/`tk()`, übersetzt in alle 17 Dateien unter `src/i18n/locales/` (`node tools/i18n-extract.ts`, `tools/i18n-apply.ts`). Rechenzeichen überall `+ − · :`.
- **Git:** Commits auf Deutsch, Ende `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `.claude/` nie committen. Pushen nur nach Freigabe.

## Review Focus

1. **Zweistellige Zahl in zwei Scans** („3“, dann „2“ links davor): Das ergibt 23 und zählt als richtig, ohne Fehlversuch. Test in Task 2 (reine Logik) und Task 5 (Szene).
2. **Ziffern, die wie Buchstaben aussehen** (O, l, S, Z, B): Im Ziffern-Modus kommt immer eine Ziffer heraus, die richtige Antwort wird nicht als falsch gewertet. Test in Task 3.
3. **Spiegelverkehrte 3 bei richtigem Ergebnis 13:** Das zählt als richtig, mit Tipp „Andersrum!“, auch wenn `noMirror` an ist. Test in Task 3 (Erkennung, `rejected` fehlt) und Task 5 (Szene).
4. **Nur Geteilt angekreuzt** (kleine Aufgabenmenge): Der Generator hängt nicht und wiederholt so selten wie möglich. Test in Task 1.
5. **Spielstand mitten im großen Moment oder mit halb gelesener Zahl:** Nach dem Laden stehen Aufgabe, Perlen, Tiere und Pflanzen wieder da. Der große Moment startet nicht noch einmal, die halbe Zahl ist verworfen. Test in Task 5.

---

### Task 1: Aufgaben-Generator

**Files:**
- Create: `src/game/math/tasks.ts`
- Test: `test/game/mathTasks.test.ts`

**Interfaces:**
- Produces:
  - `type TaskKind = 'plus20' | 'minus20' | 'pm100' | 'mal' | 'geteilt'`
  - `const TASK_KINDS: readonly TaskKind[]`
  - `interface MathTask { kind: TaskKind; a: number; b: number; op: '+' | '−' | '·' | ':'; result: number }`
  - `taskKey(t: MathTask): string`: gleich für Tauschaufgaben bei `+` und `·`, sonst `a op b`.
  - `taskText(t: MathTask): string`, zum Beispiel `'7 + 5'`.
  - `class TaskPicker`:
    - `constructor(rand: () => number, kinds: TaskKind[])`: leere `kinds` werden zu `['plus20']`.
    - `next(): MathTask`
    - `again(t: MathTask): void`: merkt eine aufgelöste Aufgabe vor. Sie kommt nach 5–8 anderen wieder, frühestens nach dem Abstand.
    - `recent: string[]`
    - `export()` / `static from(data, rand, kinds)` für Spielstände.
  - `const RECENT = 15`

- [ ] **Step 1: Write the failing tests**
  - `every kind stays in its bounds`: 2000 Ziehungen je Art.
    - `plus20`: `a + b ≤ 20`.
    - `minus20`: `a ≤ 20`, `result ≥ 0`.
    - `pm100`: alle Zahlen und Ergebnisse 0–100, mindestens 20 % Aufgaben mit Zehnerübergang.
    - `mal`: ein Faktor aus {0, 1, 2, 5, 10} oder `a === b`, Faktoren ≤ 10, beide Reihenfolgen kommen vor.
    - `geteilt`: `a % b === 0`, `b ≠ 0`, `a / b` ist eine Kernaufgabe.
    - Für alle gilt: `result` stimmt.
  - `no repeat within 15`: Bei `['plus20','minus20','pm100','mal']` hat jedes Fenster aus 16 aufeinanderfolgenden Keys lauter verschiedene Einträge, über 500 Ziehungen.
  - `kinds roughly balanced`: Bei drei Arten liegt jede nach 3000 Ziehungen zwischen 25 % und 42 %.
  - `small pool does not hang`: Nur `['geteilt']`: 200 Ziehungen dauern unter 200 ms. Der kleinste Abstand zwischen zwei gleichen Keys ist so groß, wie es die Menge zulässt (≥ Mengengröße − 1, höchstens 15).
  - `trivial tasks are rare`: `0 + 0`, `1 · 1`, `0 · 0`, `x − 0` und `x − x` zusammen ≤ 3 % bei `plus20`, `minus20` und `mal`.
  - `again brings the task back`: Nach `again(t)` taucht `taskKey(t)` innerhalb der nächsten 16–24 Ziehungen genau einmal auf.
  - `export/from round-trips recent and the again queue`.
- [ ] **Step 2: Run** `npx vitest run test/game/mathTasks.test.ts`. Expected: FAIL, Modul fehlt.
- [ ] **Step 3: Implement** `src/game/math/tasks.ts`.
  - Jede Art hat ihren eigenen Ziehungs-Algorithmus.
  - Die Art wird reihum aus einer gemischten Liste gezogen, das gibt die Balance.
  - Es wird neu gezogen, solange der Key in `recent` steht, höchstens 40-mal; danach gewinnt der älteste Treffer.
- [ ] **Step 4: Run** dieselben Tests. Expected: PASS.
- [ ] **Step 5: Commit** `Rechenmeer: Aufgaben-Generator für Klasse 1/2`.

### Task 2: Zahl aus Ziffern lesen

**Files:**
- Create: `src/game/math/readNumber.ts`
- Test: `test/game/readNumber.test.ts`

**Interfaces:**
- Consumes: `ScannedGlyph` (`src/vision/types.ts`)
- Produces:
  - Rückgabetyp von `readAnswer`:
    ```ts
    type Reading =
      | { kind: 'none' }
      | { kind: 'several' }
      | { kind: 'unsure'; glyphs: ScannedGlyph[] }
      | { kind: 'partial'; glyphs: ScannedGlyph[] }
      | { kind: 'number'; value: number; glyphs: ScannedGlyph[] }
    ```
    Bei `partial` und `number` sind die `glyphs` von links nach rechts sortiert.
  - `UNSURE_L = 0.35`: Eine Ziffer gilt als unsicher, wenn `score.parts.L < UNSURE_L` ist. Der Wert wird in Task 3 an echten Ziffern geprüft und darf dort angepasst werden; das kommt als Ruling ins Ledger.
  - `groupDigits(fresh: ScannedGlyph[]): ScannedGlyph[][]`: Ziffern bilden eine Gruppe, wenn sich ihre Boxen vertikal zu mindestens 50 % der kleineren Höhe überlappen. Außerdem darf die Lücke höchstens das 1,2-Fache der mittleren Ziffernhöhe betragen.
  - `readAnswer(fresh: ScannedGlyph[], expected: number, pending: ScannedGlyph[] | null): Reading`
    - `fresh` sind die neuen, nicht abgelehnten Zeichen.
    - `pending` ist der Rest eines vorigen `partial`. Er wird mit neuen Ziffern derselben Zeile zusammengesetzt, also wenn sie die Gruppenregel gegenüber `pending` erfüllen.
    - Eine Gruppe mit mehr als 3 Ziffern gilt als `several`.
    - `partial` gibt es nur, wenn die gelesene Ziffernfolge ein echter Anfang oder ein echtes Ende von `String(expected)` ist und `pending` leer war. Damit wird höchstens einmal gewartet.
  - `combineGlyphs(gs: ScannedGlyph[], id: number): ScannedGlyph`
    - Die Box ist die Vereinigung der Boxen.
    - `crop` setzt die Ziffern nebeneinander, mit 4 px Abstand.
    - `score.score` ist der Mittelwert, `tier` kommt von `tierOf` des Mittelwerts.
    - `char` und `scoredAs` sind die Zahl als Text.
    - `tip` ist der Tipp des schwächsten Zeichens, `mirrored` ist gesetzt, wenn eines gespiegelt ist.

- [ ] **Step 1: Write the failing tests.** Ziffern sind Test-Glyphen mit `box` und `score.char`, wie `glyph()` in `test/game/zauberScene.test.ts`.
  - `"1","2" side by side → number 12`, auch wenn die Reihenfolge in `fresh` vertauscht ist.
  - `two groups on different lines → several`; `four digits → several`.
  - `no fresh digits → none`.
  - `parts.L below UNSURE_L → unsure`.
  - `expected 23, fresh "3" → partial`. Danach `fresh "2"` links daneben mit `pending` → `number 23`.
  - `expected 23, fresh "3", then "2" far away on another line → number 2`. Das zählt als Antwort, nicht als `several`.
  - `expected 23, fresh "4" → number 4`. Kein `partial`, weil die Ziffer kein Teil der Lösung ist.
  - `expected 5, fresh "5" → number 5`. Ein Ergebnis mit einer Ziffer ist nie `partial`.
  - `combineGlyphs`: Die Breite von `crop` ist die Summe der Breiten plus die Abstände. `char` ist `'23'`, der Score ist der Mittelwert, `mirrored` wird übernommen.
- [ ] **Step 2: Run** `npx vitest run test/game/readNumber.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/game/math/readNumber.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Rechenmeer: Ziffern zu einer Zahl zusammensetzen`.

### Task 3: Ziffern-Modus der Erkennung

**Files:**
- Modify:
  - `src/vision/types.ts`: `VisionOptions.digits?: boolean`
  - `src/recog/recognizer.ts`: `ScoreOptions.digits?: boolean`, `analyze`
  - `src/vision/pipeline.ts:478,515`: `digits` an `analyze` und `finalize` durchreichen
- Test: `test/vision/pipeline.test.ts` (neuer `describe('digits mode')`)

**Interfaces:**
- Produces: Mit `digits: true` ist `score.char` immer eine Ziffer 0–9, `top3` bleibt unverändert. Im freien Zweig von `analyze` stehen als Kandidaten nur Gruppen, die eine Ziffer enthalten; ausgegeben wird die Ziffer der Gruppe.
  - Aus `0Oo` wird 0, aus `1Il` wird 1.
  - Liefert das Netz keine Ziffern-Gruppe unter den Top 4, werden alle Ziffern-Gruppen nach `gp` sortiert.
  - Die Umlaut- und i-Punkt-Regeln greifen nicht.
  - Die Spiegelprüfung betrachtet nur Ziffern-Gruppen.
  - `parts.L` ist die Wahrscheinlichkeit der gewählten Ziffern-Gruppe.

- [ ] **Step 1: Write the failing tests.** Seite mit `makePage` aus `test/helpers/synth.ts`, wie die vorhandenen Pipeline-Tests; das Modell muss vorhanden sein (`it.skipIf(!hasModel())`).
  - `digits mode reads 0–9`: Eine Seite mit „0123456789“ ergibt diese zehn Ziffern.
  - `digits mode never returns a letter`: Eine Seite mit „OlSZB“ ergibt nur Ziffern. O ergibt 0, l ergibt 1.
  - `a mirrored 3 is read as 3 with mirrored`: gespiegelte Vorlage. Mit `noMirror: true` und `digits: true` bleibt `rejected` leer. Dafür sorgt im Ziffern-Modus `pipeline.ts`.
  - `without digits nothing changes`: dieselbe „OlSZB“-Seite ohne `digits` liefert Buchstaben.
- [ ] **Step 2: Run** `npx vitest run test/vision/pipeline.test.ts`. Expected: die neuen Tests FAIL.
- [ ] **Step 3: Implement** wie oben beschrieben. Prüf an der „0123456789“-Seite, welche `parts.L` die Ziffern bekommen. Liegt eine sauber geschriebene Ziffer unter `UNSURE_L`, wird die Schwelle in `readNumber.ts` gesenkt; das kommt als Ruling ins Ledger.
- [ ] **Step 4: Run** `npx vitest run test/vision test/recog`. Expected: PASS, alte Tests unverändert grün.
- [ ] **Step 5: Commit** `Erkennung: Ziffern-Modus für das Rechenmeer`.

### Task 4: Meerestiere, Pflanzen und Besucher

**Files:**
- Create:
  - `src/game/creatures/seaLife.ts`: Tiere aus den Mal-Aquarium-Umrissen, farbig gefüllt, mit Seestern
  - `src/game/math/seaPlants.ts`: Seegras, Koralle, Seeanemone
  - `src/game/math/visitors.ts`: Hai und Delfine
- Test: `test/game/rechenSprites.test.ts`

**Interfaces:**
- Consumes: `SPECIES`, `type SpeciesId` (`src/game/paint/species.ts`), `Pose` und Bewegung aus `src/game/paint/motion.ts`, `Genome` und `makeGenome` (`src/game/creatures/genome.ts`), `Sprite` (`src/game/creatures/sprite.ts`).
- Produces:
  - `type SeaAnimal = 'seepferdchen' | 'clownfisch' | 'doktorfisch' | 'kugelfisch' | 'qualle' | 'krebs' | 'schildkroete' | 'krake' | 'seestern'`
  - `const SEA_ANIMALS: readonly SeaAnimal[]`
  - `seaSprite(kind: SeaAnimal, g: Genome, sticker: AnyCanvas | null): Sprite`
    - Jede Körperpartie wird in Farben aus `g` gefüllt, mit dicker Kontur im Stil von `parts.ts`. Das Abzeichen mit der Zahl sitzt wie bei den anderen Sprites.
    - Die Stufe bestimmt Farbkraft, Glanz, Funkeln und bei `prachtvoll` eine Perle oder kleine Krone.
    - Seestern, Krebs und Schildkröte haben einen Bodenmodus: Sie bewegen sich am Sand entlang.
  - `seaMotion(kind: SeaAnimal): Motion`
  - `type PlantKind = 'seegras' | 'koralle' | 'anemone'`
  - `interface Plant { kind: PlantKind; x: number; tier: Tier; seed: number; born: number; glyph: ScannedGlyph; sticker: AnyCanvas; fade?: number }`
  - `drawPlant(ctx, p: Plant, groundY: number, t: number, grow: number): void`
    - `grow` läuft von 0 bis 1 beim Wachsen.
    - Das Abzeichen mit der Zahl sitzt am Fuß der Pflanze.
  - `drawShark(ctx, x, y, s, t)`: freundlicher Hai, auf Grundlage des Umrisses `hai`.
  - `drawDolphin(ctx, x, y, s, angle, t)`: neu gezeichnet.

- [ ] **Step 1: Write the failing tests**
  - `every sea animal draws for every tier`: Jedes `SeaAnimal` wird für jede Stufe von `zerknittert` bis `prachtvoll` auf eine 300×300-Leinwand gezeichnet. Die Leinwand ist danach nicht leer, `radius` liegt zwischen 25 und 90, es gibt keine Ausnahme.
  - `prachtvoll looks richer`: Die Summe der Farbsättigung ist bei `prachtvoll` größer als bei `zerknittert`.
  - `plants grow`: Bei `grow = 0.2` sind weniger Pixel bedeckt als bei `grow = 1`.
  - `visitors draw`: Hai und Delfin zeichnen ohne Ausnahme und lassen die Leinwand nicht leer.
- [ ] **Step 2: Run** `npx vitest run test/game/rechenSprites.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Zum Prüfen ein Vorschauwerkzeug `tools/preview-rechen.ts` schreiben, nach dem Vorbild von `tools/preview-zauber.ts`. Es erzeugt ein PNG mit allen Tieren, Pflanzen und Besuchern. Das PNG ansehen und nachbessern, bis alles freundlich und gut lesbar ist.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Rechenmeer: Meerestiere, Pflanzen, Hai und Delfine`.

### Task 5: Szene `RechenScene`

**Files:**
- Create: `src/scenes/rechenmeer.ts`
- Modify: `src/scenes/habitat.ts`. Der Typ der Id erlaubt `'rechenmeer'`. Falls nötig kommt ein kleiner Hook dazu, z. B. `protected scanEnabled()`, und wird im Ledger begründet.
- Test: `test/game/rechenScene.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4. Für `HabitatScene` gelten `place`, `fx`, `particles`, `creatures`, `say` (Muster aus `handleScan`), `starCount` und `TIP_TEXT`.
- Produces:
  - `const rechenmeer: HabitatDef`:
    - `id: 'rechenmeer'`, `archetype: 'fish'`
    - `paint`: Hintergrund wie `aquarium.paint`, wiederverwendet
    - `count: [tk('{n} Tier'), tk('{n} Tiere')]`
  - `class RechenScene extends HabitatScene`:
    - `constructor(host: SceneHost, worldW: number, seed?: number)`
    - `task: MathTask | null`: `null` während eines großen Moments.
    - `misses: number`
    - `pearls: number` (0–9)
    - `section: number`
    - `pending: ScannedGlyph[] | null`
    - `plants: Plant[]`
    - `visitor: { kind: 'hai' | 'delfine'; t: number } | null`
    - `answer(fresh: ScannedGlyph[], stickers: Map<number, AnyCanvas>): 'right' | 'wrong' | 'unsure' | 'several' | 'partial' | 'none' | 'busy'`: Kern von `handleScan`, ohne Kamera testbar.
    - `get practiceTarget(): undefined`, `bonusLetters(): string[]` gibt `[]` zurück.
    - `countText()`: zum Beispiel „🐠 7 · 🌿 3 · ⭐ 4/10“.
    - `saveState(): RechenSave`, `restoreState(s: RechenSave): void`.
    - `RechenSave` erweitert `HabitatSave` um `picker`, `task`, `misses`, `pearls`, `section` und `plants` als `{ kind, x, tier, seed, glyph: SavedGlyph }[]`. Ein laufender Besuch wird nicht gespeichert.
- **Verhalten:**
  - **`handleScan`:**
    - Ziel des Flugs:
      - bei richtigem Ergebnis die Stelle, an der das neue Wesen oder die Pflanze entsteht;
      - sonst die Aufgabentafel, dort zerplatzen die Ziffern.
    - Das Wesen entsteht erst beim Landen der letzten Ziffer.
  - **Richtig:**
    - Neues Tier oder neue Pflanze, mit `combineGlyphs` als Glyph. Das Abzeichen zeigt die Zahl.
    - Sterne und Stufentext erscheinen.
    - Ist eine Ziffer gespiegelt, kommt der Tipp „Andersrum!“.
    - Lob: „Richtig! 7 + 5 = 12“.
    - Eine Perle mehr. Bei der 10. Perle beginnt der Besuch, sonst kommt die nächste Aufgabe.
    - Ungefähr jede dritte Antwort wird eine Pflanze (Zufall). Die Tierart ist Zufall aus `SEA_ANIMALS`, ohne die beiden zuletzt gewählten.
  - **Falsch:**
    - Ein Hinweisfisch schwimmt mit „Fast! Schau noch mal: 7 + 5“ heran.
    - Ab `misses ≥ 2` zeigt die Tafel die Rechenhilfe:
      - Zwanzigerfeld mit Plättchen bei Plus und Minus bis 20,
      - Zehnerstangen und Einer bei `pm100`,
      - Punktfeld a × b bei `mal` und `geteilt`.
    - Beim 3. Fehlversuch steht die Lösung 4 s lang groß mit der Hilfe da. Danach folgt `picker.again(task)` und eine neue Aufgabe.
  - **`unsure`:** „Ich kann die Zahl nicht gut lesen. Schreib sie noch einmal deutlich!“
  - **`several`:** „Schreib nur das Ergebnis!“
  - **`partial`:** Der Rest wird in `pending` gemerkt, ohne Text. Ein Fehlversuch ist es nicht.
  - **`busy`:** Gilt, solange ein Besuch läuft. Text: „Gleich geht's weiter!“
  - **Besuch:** dauert 8 s.
    - **Hai:** Er schwimmt einmal quer durchs Bild, die Tiere drängen sich in seine Nähe.
    - **Delfine:** 3 bis 5 springen in Bögen über das Bild.
    - Danach geht es abwechselnd weiter, und es kommt eine neue Aufgabe.
  - **Pflanzen:** Sie stehen auf dem Sand (`sandLine`). Ist die 13. dazugekommen, wird die älteste Pflanze innerhalb von 2 s ausgeblendet.
  - **Tippen:** Ein Tippen auf eine Pflanze zeigt ihre Karte wie bei Tieren (`showCreature`-Muster).
  - **Polaroid:** Die Aufgabentafel steht oben in der Mitte. Darum rückt das Polaroid von `SpawnFx` nach unten (`fx.top`).

- [ ] **Step 1: Write the failing tests.** Szene wie `scene()` in `test/game/zauberScene.test.ts`. `PickerScene` überschreibt die Aufgabe, damit das Ergebnis bekannt ist.
  - `right answer adds a creature or plant and a pearl`.
  - `ten right answers start a visitor; scans are busy; afterwards a new task and pearls 0`.
  - `visitors alternate shark, dolphins`.
  - `wrong answer: no creature lost, misses 1, same task`.
  - `third miss shows the solution, then a new task; the old one comes back later; no pearl`.
  - `"3" then "2" for 23 is right with no miss` (Review Focus 1).
  - `mirrored digit with right result counts, tip is spiegel, even with settings.recog.noMirror` (Review Focus 3).
  - `unsure and several keep the task and count no miss`.
  - `plants stay at 12`.
  - `save during a visitor and with pending digits restores task, pearls, creatures, plants; no visitor; pending empty` (Review Focus 5).
  - `practiceTarget undefined, bonusLetters empty`.
- [ ] **Step 2: Run** `npx vitest run test/game/rechenScene.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/scenes/rechenmeer.ts`.
- [ ] **Step 4: Run** `npx vitest run --no-file-parallelism`. Expected: PASS.
- [ ] **Step 5: Commit** `Rechenmeer: Szene mit Aufgaben, Perlen, Rechenhilfe und großem Moment`.

### Task 6: Einbau ins Spiel (Einstellungen, Kachel, Spielstände, Texte)

**Files:**
- **Einstellungen und Spielstände:**
  - `src/app/settings.ts`: `HabitatId` wird um `'rechenmeer'` erweitert. Dazu `Settings.math: { kinds: TaskKind[] }` mit Voreinstellung `['plus20','minus20']`. `loadSettings` stellt sicher, dass `kinds` nicht leer ist und nur gültige Arten enthält.
  - `src/app/saves.ts`: `GameMode` und `MODES` werden um `rechenmeer: { icon: '🐬', title: tk('Rechenmeer') }` erweitert.
- **App:** `src/app/app.ts`
  - `HABITATS`, Titel „🐬 Rechenmeer“, `RechenScene` für `id === 'rechenmeer'`.
  - `visionOptions()` setzt im Rechenmeer `digits: true` und `noMirror: false`.
  - Ist die gewählte Schrift nicht `seg: 'latin'`, wird `script: 'druck'` übergeben, und das Druckschrift-Modell muss geladen sein (`scriptReady`).
- **Oberfläche:**
  - `src/ui/settingsPanel.ts`: Abschnitt „Rechenmeer“ mit fünf Ankreuzfeldern.
    - Beschriftung: „Plus bis 20“, „Minus bis 20“, „Plus und Minus bis 100“, „Einmaleins (Kernaufgaben)“, „Geteilt (Umkehr der Kernaufgaben)“.
    - Das letzte angekreuzte Feld lässt sich nicht abwählen.
  - `src/ui/startScreen.ts`: Kachel `tile('rechenmeer', t('🐬 Rechenmeer'), t('Rechnen füllt das Meer'), …)`.
  - `src/ui/previews.ts`: `TileKind` wird um `'rechenmeer'` erweitert. Die Vorschau zeigt Tafel „7 + 5 = ?“, zwei Tiere und eine Pflanze.
  - `src/ui/styles.css`: Das Kachelraster sieht mit zehn Kacheln ausgewogen aus.
- **Texte:** `src/i18n/source.json` und alle 17 `src/i18n/locales/*.json`.
- **Tests:**
  - `test/game/saveState.test.ts`: `describe('saved Rechenmeer')`
  - Neu: `test/game/mathSettings.test.ts`

- [ ] **Step 1: Write the failing tests**
  - `loadSettings fills math.kinds; empty or unknown kinds fall back to the default`.
  - `saved Rechenmeer` übersteht den Weg durch `saves.ts` (Export und Import wie beim Zauberland-Test): Aufgabe, Perlen, Pflanzen und Tiere bleiben erhalten.
  - `visionOptions in the Rechenmeer`: `digits: true`, `noMirror: false`, und bei `script: 'arabisch'` wird `'druck'` übergeben. Testbar über eine kleine exportierte Hilfsfunktion `rechenVisionPatch(settings)` in `src/scenes/rechenmeer.ts`, die `app.ts` benutzt.
- [ ] **Step 2: Run** `npx vitest run test/game/mathSettings.test.ts test/game/saveState.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Texte mit `node tools/i18n-extract.ts` sammeln, in alle 17 Sprachen übersetzen und mit `tools/i18n-apply.ts` eintragen.
- [ ] **Step 4: Run** `npx vitest run --no-file-parallelism` und `npm run build`. Expected: alles grün, Build sauber.
- [ ] **Step 5: Live-Check.**
  - `npx vite --port 3091`, dann Edge headless über puppeteer-core, `?debug` und `window.__app.scene`, wie beim Zauberland.
  - Aufgaben und Antworten über `scene.answer(...)` einspielen.
  - Screenshots prüfen: Kachel, Tafel, Rechenhilfe, Tier mit Zahl, Pflanze, Hai, Delfine.
  - Keine Konsolenfehler, etwa 60 fps.
- [ ] **Step 6: Commit** `Rechenmeer: Kachel, Einstellungen, Spielstände und Übersetzungen`.
