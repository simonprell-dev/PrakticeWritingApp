# Zauberland Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine vierte Habitat-Welt „Zauberland“, in der aus jedem Buchstaben per Zufall ein Fabelwesen, eine Prinzessin oder ein Burgteil wird, mit wachsender Burg, Prinzessinnen-Zimmern, Reiten und Herdenflug mit Regenbogen.

**Architecture:**
- Die reine Logik liegt in kleinen, canvasfreien Modulen und ist getestet:
  - die Burg als Plätze-Modell;
  - die Zimmervergabe;
  - der Herden-Zeitplan;
  - die Bogenbahn.
- Die Szene ist `ZauberScene extends HabitatScene`, so wie `PaintScene` die Habitat-Maschine erweitert. Sie ersetzt `addCreature`, `behave`, `render`, `tap`, `saveState`/`restoreState` und `countText` dort, wo die Welt abweicht.
- Die Zeichnung von Figuren und Burg folgt dem Stil von `src/game/creatures/*` (`parts.ts`).

**Tech Stack:** TypeScript, Canvas 2D, Vite, vitest (`npx vitest run --no-file-parallelism`), @napi-rs/canvas in Tests.

**Spec:** `docs/superpowers/specs/2026-11-04-zauberland-design.md`

## Global Constraints

- Habitat-Id `zauberland`, Kachel „🦄 Zauberland“, Untertitel „Einhörner, Prinzessinnen und eine Burg“.
- Zufall beim Schlüpfen: 40 % Fabelwesen, 30 % Prinzessin, 30 % Burgteil. Bei voller Burg gilt 4:3 zwischen Fabelwesen und Prinzessin; sind alle 12 Zimmer besetzt, wird nur noch Fabelwesen gelost.
- Fabelwesen-Arten: Einhorn (häufig), Pegasus und Glücksdrache (selten, je etwa 15 %).
- Burg: 18 Plätze, davon 12 Zimmer. Der Grundbau zählt 2 Plätze (Zimmer 0 und Eckturm). Der Zähler startet bei „2/18“.
- Burgteile zählen nicht zu `maxCreatures` und ziehen nie aus.
- Herde: mindestens 3 Fabelwesen. Abstand 40 bis 70 s. Frühestens 10 s nach dem Schlüpfen des dritten Wesens. Der Regenbogen steht etwa 20 s und verblasst dann. Es steht immer höchstens einer am Himmel.
- Eine Prinzessin bleibt höchstens 15 s in der Burg. Etwa alle 10 bis 20 s passiert irgendwo etwas Sichtbares.
- Bei Burgteilen steuert die Schönschrift-Stufe nur die Ausschmückung (Fahne, Dachfarbe, Blumenkasten, Goldrand), nie Form oder Mauerwerk.
- Alle sichtbaren Texte stehen in `t()`/`tk()` und werden in alle 17 Dateien in `src/i18n/locales/` übersetzt (`node tools/i18n-extract.ts`, `tools/i18n-apply.ts`).
- Figuren dürfen nicht an bekannte Marken (Film-Prinzessinnen, Pony-Serien) erinnern: runde Krakel-Formen, große Augen, dicke Konturen.
- Commits auf Deutsch, Ende `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `.claude/` nie committen. Pushen nur nach Freigabe durch den Nutzer.

## Review Focus

1. **Spielstand mitten im Geschehen:** Ein Spielstand wird gespeichert, während eine Prinzessin in der Burg ist, reitet oder die Herde fliegt. Beim Laden steht jedes Wesen wieder auf der Wiese, und jede Prinzessin hat ihr altes Zimmer. Test in Task 6.
2. **Höchstzahl erreicht:** Eine Prinzessin zieht aus, während sie in der Burg ist oder reitet. Sie kommt erst heraus beziehungsweise steigt ab und geht dann. Ihr Zimmer wird frei, das Einhorn ist wieder frei. Test in Task 5.
3. **Ein ausziehendes Fabelwesen trägt eine Reiterin:** Die Reiterin steigt vorher ab. Ein Wesen, das gerade auszieht, nimmt nicht am Herdenflug teil. Test in Task 5.
4. **Schmale Bildschirme (Weltbreite 1280):** Die Burg mit 18 Plätzen passt in die Breite, Fenster und Tor liegen im Bild. Test in Task 1.
5. **Viele Buchstaben auf einmal:** Mehrere Prinzessinnen in einem Foto bekommen verschiedene Zimmer, auch wenn dafür mehrere Zimmer neu gebaut werden müssen. Test in Task 1.

---

### Task 1: Burg-Modell (Plätze, Bauordnung, Zimmer)

**Files:**
- Create: `src/game/castle/castle.ts`
- Test: `test/game/castle.test.ts`

**Interfaces:**
- Produces:
  - `type SlotKind = 'room' | 'tower' | 'spire' | 'flag'`
  - `interface Slot { i: number; kind: SlotKind; col: number; row: number; on: number[] }`. Dabei sind `col`/`row` Rasterzellen und `on` die Plätze, die vorher stehen müssen.
  - `const SLOTS: readonly Slot[]`: 18 Einträge in fester Bauordnung. Darunter genau 12 `room`. Index 0 ist das Grundzimmer, Index 1 der Eckturm.
  - `interface BuiltPart { slot: number; q: number; tier: Tier; glyphId: number | null }`, mit `glyphId === null` bei automatisch gebauten Zimmern.
  - `class Castle`:
    - `constructor()`: legt die Plätze 0 und 1 mit `glyphId: null` und `q: 0.5` an.
    - `parts: BuiltPart[]`
    - `built(slot: number): boolean`
    - `full(): boolean`
    - `nextSlot(): number | null`: der nächste freie Platz in Bauordnung, dessen `on` alle gebaut sind.
    - `nextRoomSlot(): number | null`: das Gleiche, nur für `room`.
    - `add(slot: number, part: Omit<BuiltPart, 'slot'>): BuiltPart`
    - `rooms(): number[]`: gebaute Zimmerplätze.
    - `owner: Map<number, number>`: Zimmerplatz → Wesen-id.
    - `assignRoom(creatureId: number): { slot: number; built: boolean } | null`: das niedrigste freie gebaute Zimmer. Gibt es keines, wird über `nextRoomSlot()` gebaut (`built: true`). `null` nur, wenn alle 12 besetzt sind.
    - `freeRoom(creatureId: number): void`
    - `roomsFree(): number`: gebaute plus noch baubare freie Zimmer.
    - `export(): { parts: BuiltPart[]; owner: [number, number][] }` und `static from(data): Castle`.
  - `function castleLayout(worldW: number): { x0: number; y0: number; cell: number; cols: number; rows: number }`: die Rasterlage auf der Welt, mit der Burg mittig auf dem Hügel.
  - `function slotRect(L, s: Slot): { x: number; y: number; w: number; h: number }`, `function windowOf(L, slot: number): { x: number; y: number }`, `function doorOf(L): { x: number; y: number }`.

- [ ] **Step 1: Write the failing tests** in `test/game/castle.test.ts`:
  - `'starts with the base room and tower'`:
    - `new Castle().parts.map(p=>p.slot)` ist `[0,1]`;
    - `SLOTS.length === 18`;
    - `SLOTS.filter(s=>s.kind==='room').length === 12`.
  - `'builds in fixed order and never floats'`: Baue 16-mal `nextSlot()`. Erwartet:
    - für jeden Platz waren beim Bauen alle `on` gebaut;
    - danach ist `full()` wahr und `nextSlot()` gleich `null`.
  - `'every princess gets her own room, rooms are built when needed'`:
    - `assignRoom(10)` gibt `{slot:0, built:false}`;
    - `assignRoom(11)` gibt `built:true` mit einem `room`-Slot;
    - die Ids 12 bis 15 bekommen paarweise verschiedene Slots;
    - `owner.size === 6`.
  - `'a room skipped over leaves tower places free for later parts'`:
    - Nach mehreren `assignRoom` ist `nextSlot()` ein Nicht-Zimmer-Platz, falls einer übersprungen wurde.
    - Kein gebauter Platz hat ungebaute `on`.
  - `'twelve rooms, then no more'`:
    - Die Ids 1 bis 12 bekommen Zimmer.
    - `assignRoom(13)` ist `null`.
    - `freeRoom(5)` und danach `assignRoom(13)` geben das frei gewordene Zimmer mit `built:false`.
  - `'round trip'`: `Castle.from(JSON.parse(JSON.stringify(c.export())))` hat dieselben `parts` und `owner`.
  - `'fits 1280 and 1920 worlds'`: Für `castleLayout(1280)` und `castleLayout(1920)` gilt:
    - alle `slotRect` liegen in `0..W` und `0..WORLD_H`;
    - der Burgsockel steht auf dem Wiesenhorizont des Zauberlands (y 560 bis 640);
    - `doorOf` liegt im Bild.
- [ ] **Step 2: Run** `npx vitest run --no-file-parallelism test/game/castle.test.ts`. Expected: FAIL, das Modul fehlt.
- [ ] **Step 3: Implement `castle.ts`.** Raster mit 7 Spalten und 4 Reihen:
  - Reihe 0 ist der Boden mit dem Tor in der Mittelspalte. Zimmer stehen links und rechts im Wechsel, von innen nach außen.
  - Ecktürme sitzen an den Außenspalten.
  - Reihe 1 und 2 sind obere Zimmer, die jeweils auf dem Zimmer darunter stehen.
  - Spitztürme sitzen auf den obersten Zimmern, Fahnen auf den Türmen.
  - Die Reihenfolge ist fest im Array kodiert. Die Zählung ist 12 Zimmer, 3 Türme, 2 Spitztürme und 1 Fahne, zusammen 18.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git add src/game/castle/castle.ts test/game/castle.test.ts`, `git commit -m "Zauberland: Burg-Modell mit fester Bauordnung und Zimmervergabe"`.

### Task 2: Herden-Zeitplan und Regenbogenbahn

**Files:**
- Create: `src/game/castle/herd.ts`
- Test: `test/game/herd.test.ts`

**Interfaces:**
- Produces:
  - `type HerdPhase = 'idle' | 'gather' | 'fly' | 'land'`
  - `class Herd`, mit Zufall über eine injizierte `Rand` aus `src/game/rng.ts`:
    - `constructor(rand: Rand)`
    - `phase: HerdPhase`
    - `t: number`
    - `members: number[]`
    - `update(dt: number, ready: number[], now: number, thirdArrivedAt: number | null): void`. Dabei ist `ready` die Liste der Wesen-ids, die nicht ausziehen.
    - `gatherPoint: { x: number; y: number }`
    - `arc: Arc | null`
    - `rainbow: { arc: Arc; born: number } | null`
  - `interface Arc { x0: number; x1: number; yBase: number; height: number }`
  - `function arcPoint(a: Arc, u: number): { x: number; y: number; angle: number }` mit u von 0 bis 1. Die Bahn ist ein Halbellipsen-Bogen.
  - `function rainbowAlpha(age: number): number`: 1 bis 20 s, dann linear auf 0 bei 23 s.
  - Konstanten:
    - `MIN_HERD = 3`
    - `GAP_MIN = 40`, `GAP_MAX = 70`
    - `AFTER_THIRD = 10`
    - `RAINBOW_LIFE = 20`
    - `GATHER_MAX = 8`: nach 8 s fliegt die Herde los, auch wenn noch nicht alle angekommen sind
    - `FLY_TIME = 6`
- [ ] **Step 1: Write the failing tests:**
  - `'no herd below three'`: Zwei Wesen, 200 s Simulation, `phase` bleibt `idle`.
  - `'first flight not before 10 s after the third and within the gap'`: Drei Wesen, das dritte bei `now=0`. Erwartet:
    - für `now < 10` und für `now < 40` keine Phase außer `idle`;
    - spätestens bei `now = 70` wird `gather` erreicht.
  - `'one rainbow at a time'`: Während `rainbow` lebt (Alter unter 23 s), wird kein neuer Flug gestartet.
  - `'leavers are dropped'`: Fällt ein Mitglied aus `ready` heraus, ist es nicht mehr in `members`.
  - `'arc is a bow'`:
    - `arcPoint(a,0).x === a.x0` und `arcPoint(a,1).x === a.x1`;
    - `arcPoint(a,0.5).y === a.yBase - a.height`;
    - die y-Werte sind symmetrisch.
  - `'rainbowAlpha'`: Werte 1 bei 0 und 19 s, zwischen 0 und 1 bei 21.5 s, 0 bei 23 s.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `herd.ts`.**
  - Phasenwechsel:
    - `gather` → `fly`, wenn alle Mitglieder angekommen sind (das meldet die Szene) oder `GATHER_MAX` erreicht ist;
    - `fly` → `land` nach `FLY_TIME`;
    - `land` → `idle`.
  - Bogen von links nach rechts oder umgekehrt, je nachdem, auf welcher Seite der Sammelpunkt liegt. `height` liegt bei 260 bis 360 px über `yBase`, damit der Bogen über der Burg bleibt.
  - Die Szene meldet die Ankunft über `herd.arrived(id)`. Die Methode gehört zum Interface: `arrived(id: number): void`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `"Zauberland: Herdenflug-Zeitplan und Regenbogenbahn"`.

### Task 3: Figuren-Sprites (Fabelwesen, Prinzessin)

**Files:**
- Create: `src/game/creatures/fable.ts`, `src/game/creatures/princess.ts`
- Modify: `src/game/creatures/genome.ts`: neuer Archetyp `'fable'`. Er setzt `variant` 0 = Einhorn (70 %), 1 = Pegasus (15 %), 2 = Drache (15 %) und Farben aus einer Pastell-Palette.
- Test: `test/game/zauberSprites.test.ts`

**Interfaces:**
- Consumes: `Genome`, `Sprite`, `P.*` aus `parts.ts`, `makeCanvas`.
- Produces:
  - `fableSprite(g: Genome, sticker: AnyCanvas | null): Sprite`. Seitenansicht, schaut nach rechts.
    - Der Buchstabe sitzt als `badge` auf der Flanke.
    - `sprite.top` ist der Sattelpunkt, an dem eine Reiterin sitzt.
    - Einhorn: Die Hornlänge wächst mit `g.q`; bei `g.tier === 'prachtvoll'` hat es eine Regenbogenmähne.
    - Pegasus: Flügel als `tail`-Teil, damit sie animiert flattern.
  - `princessSprite(g: Genome, sticker: AnyCanvas | null): Sprite`. Stehend, schaut nach vorne mit leichter Seitwendung.
    - Der Buchstabe sitzt als `badge` auf dem Kleid.
    - Die Stufe wählt das Kleid. Ab „schön“ trägt sie ein Diadem, bei „prachtvoll“ die große Krone samt Schleppe.
  - `princessBust(g: Genome): AnyCanvas`: Kopf und Oberkörper für den Fensterblick. Die Breite passt in ein Fenster von 0.5 × `cell`.
  - `princessSeated(g: Genome, sticker): Sprite`: die Sitzhaltung zum Reiten.
- [ ] **Step 1: Write the failing tests** (mit @napi-rs/canvas, `setCanvasFactory` wie in den bestehenden Sprite-Tests; ein Muster liefert `test/paint/species.test.ts`). Für alle 5 Stufen und alle drei Varianten gilt:
  - der Sprite hat `canvas.width > 0`;
  - `badge` liegt innerhalb des Canvas;
  - `top` liegt innerhalb des Canvas;
  - bei „prachtvoll“ hat das Einhorn mehr bunte Pixel in der Mähne als bei „nett“.
  - Prüfung: Farbton-Streuung über einen Mähnen-Ausschnitt.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** beide Dateien und den Archetyp in `genome.ts`. Die bestehenden `makeGenome`-Zweige bleiben unverändert, damit alte Wesen gleich aussehen.
- [ ] **Step 4: Run tests** plus `npx vitest run --no-file-parallelism` (alle). Expected: PASS.
- [ ] **Step 5: Look at them.** Ein Vorschaubogen mit allen Varianten und Stufen kommt über ein kleines `tools/preview-zauber.ts` (Muster: `tools/preview-strokes.ts`) als PNG in den Scratchpad. Bild ansehen und prüfen:
  - die Figuren erinnern an keine Marke;
  - die Buchstaben sind lesbar.
- [ ] **Step 6: Commit** `"Zauberland: Einhorn, Pegasus, Glücksdrache und Prinzessin"`.

### Task 4: Burg zeichnen und Hintergrund

**Files:**
- Create: `src/game/castle/castleDraw.ts`
- Create: `src/scenes/zauberland.ts`. In diesem Schritt nur das `HabitatDef` `zauberland` mit `paint`, `init`, `ambient`, `renderBack`, `renderFront`, `bounds` und einem vorläufigen `behave` aus der Savanne.
- Modify: `src/scenes/habitat.ts:83`: `id` um `'zauberland'` erweitern.

**Interfaces:**
- Consumes:
  - aus Task 1: `Castle`, `SLOTS`, `castleLayout`, `slotRect`, `windowOf`, `doorOf`;
  - `Tier` aus `vision/types.ts`.
- Produces:
  - `drawCastle(ctx: Ctx, castle: Castle, L: Layout, stickers: Map<number, AnyCanvas>): void`. Zeichnet die ganze Burg mit leeren Fenstern und geschlossenem Tor.
  - `class CastleCache`:
    - `get(castle, worldW, stickers): AnyCanvas`. Zeichnet nur neu, wenn sich `castle.parts.length` oder `worldW` ändern.
  - `drawBuildPop(ctx, rect, k: number)`: die Bau-Animation; `k` läuft von 0 bis 1 und lässt das Teil hochploppen.
  - `drawDoorOpen(ctx, L, open: number)`
  - `drawWindowLight(ctx, L, slot, on: boolean)`
- Bounds der Wiese: `x0: 140, x1: W-140, y0: 640, y1: 930`. Horizont bei 600.
- Teile mit Buchstabe tragen ein Wappenschild mit Sticker; automatisch gebaute Zimmer bekommen ein leeres Wappen.
- [ ] **Step 1: Write the failing test** `test/game/castleDraw.test.ts`:
  - `CastleCache.get` gibt bei unveränderter Burg dasselbe Canvas-Objekt zurück und nach `castle.add` ein neu gezeichnetes;
  - das Bild hat bei 18 Teilen deckende Pixel in jedem `slotRect`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** Burgzeichnung und Hintergrund:
  - Hintergrund: Pastellhimmel von Violett zu Rosa, Hügel, Blumenwiese; Wolken, Glitzersterne und Schmetterlinge als Ambient.
  - Kein fester Regenbogen im Hintergrund.
  - Die Stufe der Burgteile wirkt sich nur auf die Ausschmückung aus (Global Constraints).
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Look at it.** Mit `tools/preview-zauber.ts --castle` je ein Bild mit 2, 9 und 18 Teilen bei 1280 und 1920 Breite rendern und ansehen. Die Burg muss auf jeder Stufe stimmig wirken.
- [ ] **Step 6: Commit** `"Zauberland: Burg zeichnen und Hintergrund"`.

### Task 5: ZauberScene: Schlüpfen, Prinzessinnen, Reiten, Herde

**Files:**
- Modify: `src/scenes/zauberland.ts`: dazu kommt `export class ZauberScene extends HabitatScene`.
- Modify: `src/scenes/habitat.ts`, nur so viel wie nötig, als `protected`-Haken:
  - `addCreature` bekommt einen überschreibbaren Punkt für Genome und Sprite;
  - `render` bekommt `protected renderCreatures(ctx, list)`.
  
  Keine Verhaltensänderung für die anderen Welten.
- Test: `test/game/zauberScene.test.ts`

**Interfaces:**
- Consumes: Task 1 bis 4; aus `HabitatScene` die Felder `creatures`, `place()`, `particles`, `fx`, `t`, `host`, `bounds`.
- Produces:
  - `type ZKind = 'fable' | 'princess' | 'part'`
  - `rollKind(r: number, castle: Castle): ZKind`, eine reine Funktion. `r` ist ein Wert von 0 bis 1 aus `mulberry32(seed)`. Sie wendet die Gewichte der Global Constraints an.
  - `ZauberScene`:
    - `castle: Castle`
    - `herd: Herd`
    - `kindOf: Map<number, ZKind>`
    - `rider: Map<number, number>`: Prinzessin-id → Wesen-id
  - Prinzessinnen-Zustände in `c.state`: `'idle' | 'walk' | 'toDoor' | 'inside' | 'window' | 'atDoor' | 'toMount' | 'riding' | 'dismount'`.
  - Fabelwesen-Zustände: wie in der Savanne, dazu `'herdGather' | 'herdFly' | 'herdLand'` und das Flattern von Pegasus und Drache.
- Verhalten:
  - **Burgteil:**
    - `addCreature` legt bei einem Burgteil kein `Creature` an. Der Buchstabe fliegt zum Platz `castle.nextSlot()` (über das `to`-Ziel in `fx.start`), dann `castle.add` mit Bau-Plopp und `sfx.hatch`.
    - Die Sticker der Teile liegen in `partStickers: Map<number, { glyph: ScannedGlyph; sticker: AnyCanvas }>`. Antippen eines Burgteils mit Buchstabe zeigt die Karte, ein automatisches Zimmer reagiert nicht.
  - **Prinzessin:** `assignRoom` beim Schlüpfen. Wurde gebaut, folgt der Bau-Plopp des Zimmers.
  - **Ausziehen:**
    - Eine Prinzessin in `'inside'`/`'window'` kommt erst zum Tor heraus.
    - Eine reitende Prinzessin steigt erst ab.
    - Danach `freeRoom`.
    - Ein Fabelwesen mit Reiterin lässt sie vorher absteigen.
  - **Rendern:** Die Burg aus dem `CastleCache` liegt hinter allen Wesen. Prinzessinnen im Fenster sind `princessBust` im Fensterrahmen. Reiterinnen werden auf `sprite.top` des Reittiers gezeichnet, als Teil desselben y-sortierten Eintrags.
  - **Herde:**
    - `herd.update` in `update()` mit `ready` = Fabelwesen, die nicht ausziehen.
    - Im Flug folgen die Wesen `arcPoint` mit 0.08 Versatz pro Mitglied; Reiterinnen fliegen mit.
    - Hinter dem Leitwesen wird der Regenbogen als sieben farbige Bänder entlang der Bahn bis zum aktuellen `u` gezeichnet, danach mit `rainbowAlpha`.
    - Wesen ohne Flügel ziehen Glitzerpartikel an den Hufen.
  - **Klang:** die vorhandenen `sfx` nutzen. Für den Regenbogenflug darf in `src/game/audio.ts` ein kurzer synthetisierter `sfx.rainbow()` dazukommen, ohne neue Dateien.
  - **Zähler:**
    - `countText()` zeigt die Gesamtzahl wie in den anderen Welten, mit `count` = `[tk('{n} Wesen'), tk('{n} Wesen')]`.
    - Dazu kommt `liveText(): string`, zum Beispiel „5 Einhörner · 3 Prinzessinnen · Burg 7/18“. Der HUD-Titelzähler nutzt ihn, falls `scene instanceof ZauberScene`.
    - Das HUD liest den Zähler heute über `host.progress()`. Ein passender Haken in `src/ui/hud.ts` wird nur hinzugefügt, wenn kein bestehender Zähler-Weg passt.
- [ ] **Step 1: Write the failing tests.** Szene mit Fake-`SceneHost` (`settings: structuredClone(DEFAULTS)`, Noop-Callbacks), Glyphen über `test/helpers/synth.ts` oder minimale `ScannedGlyph`-Objekte, `dt = 1/30`.
  - `'rollKind weights'`: Die Häufigkeiten über 10 000 `r` sind
    - bei leerer Burg ≈ 0.4/0.3/0.3 (±0.02);
    - bei voller Burg mit freien Zimmern 0 Burgteile;
    - bei 12 besetzten Zimmern nur `fable`.
  - `'a princess walks in and looks out of her own window within 60 s'`:
    - Eine Prinzessin hinzufügen und simulieren.
    - Zustand `'window'` tritt auf.
    - In dem Moment ist `castle.owner` für ihren Zimmerplatz ihre id.
    - Kein `'inside'`/`'window'`-Block dauert länger als 15 s.
  - `'a princess rides a free unicorn'`:
    - Eine Prinzessin und ein Einhorn, 120 s.
    - `rider` hat zu einem Zeitpunkt einen Eintrag.
    - Das Reittier ist zu dem Zeitpunkt kein Mitglied eines anderen Ritts.
  - `'leaving princess comes out, dismounts and frees her room'`:
    - `maxCreatures = 1`, eine Prinzessin im Zustand `'inside'` und dann ein neues Wesen.
    - Sie verlässt die Burg erst über `'atDoor'`.
    - Danach ist `owner` ohne ihre id.
  - `'leaving unicorn drops its rider and skips the herd'`.
  - `'herd of three flies an arc and leaves one rainbow'`:
    - Drei Einhörner, 90 s.
    - `herd.rainbow` ist gesetzt.
    - Während des Flugs liegen alle Mitglieder innerhalb von 40 px auf `arcPoint`.
  - `'castle parts are not creatures and never leave'`:
    - 20 Burgteile bei `maxCreatures = 2`.
    - `castle.parts.length === 18`.
    - `creatures.length` bleibt 0.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Die Zeitwerte der Prinzessinnen-Zustände wählt der Builder innerhalb der Global Constraints.
- [ ] **Step 4: Run alle Tests.** Expected: PASS. Die Habitat-Tests der anderen Welten bleiben grün.
- [ ] **Step 5: Commit** `"Zauberland: Szene mit Prinzessinnen, Reiten und Herdenflug"`.

### Task 6: Speichern und Laden

**Files:**
- Modify: `src/scenes/zauberland.ts`
- Test: `test/game/saveState.test.ts`, mit einem neuen `it`

**Interfaces:**
- Produces: `interface ZauberSave extends HabitatSave` mit:
  - `kinds: ZKind[]`, parallel zu `creatures`;
  - `variants: number[]`;
  - `rooms: (number | null)[]`, der Zimmerplatz jeder Prinzessin;
  - `castle: { parts: { slot: number; q: number; tier: Tier; glyph: SavedGlyph | null }[] }`.
- Beim Laden:
  - Wesen kommen auf die Wiese zurück, im Zustand `idle`, ohne Ritt und ohne Herdenphase.
  - Prinzessinnen bekommen ihr gespeichertes Zimmer.
  - Burgteile kommen ohne Bau-Animation zurück.
  - Die Glyph-Ids laufen über `restoredId` wie in den anderen Szenen.
- [ ] **Step 1: Write the failing test** `'a Zauberland game comes back with its castle, rooms and riders on the meadow'`:
  - Burgteile, 2 Prinzessinnen (eine im Zustand `'window'`, eine `'riding'`) und 3 Einhörner mitten im Herdenflug.
  - Durch `saveState` → `JSON.parse(JSON.stringify(...))` → `restoreState` in einer neuen Szene mit `worldW = 1600`.
  - Erwartet:
    - gleiche Burgteil-Plätze;
    - jede Prinzessin hat dasselbe Zimmer;
    - alle Wesen liegen innerhalb von `bounds`;
    - `herd.phase === 'idle'`;
    - `rider.size === 0`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `saveState`/`restoreState` überschreiben. `saveState` gibt auch dann einen Stand zurück, wenn nur Burgteile gebaut sind.
- [ ] **Step 4: Run alle Tests.** Expected: PASS.
- [ ] **Step 5: Commit** `"Zauberland: Spielstände mit Burg und Zimmern"`.

### Task 7: Einbau in die App, Kachel, Vorschau, Übersetzungen

**Files:**
- Modify:
  - `src/app/settings.ts:8`: `HabitatId` um `'zauberland'` erweitern.
  - `src/app/saves.ts`: `GameMode` und `MODES.zauberland = { icon: '🦄', title: tk('Zauberland') }`.
  - `src/app/app.ts`:
    - `HABITATS` erweitern;
    - in Zeile 444/557 die Habitat-Prüfung über `id in HABITATS`;
    - in `startHabitat`: `id === 'zauberland' ? new ZauberScene(...) : new HabitatScene(...)`;
    - Titel `t('🦄 Zauberland')`.
  - `src/ui/startScreen.ts`: eine Kachel nach der Savanne, `tile('zauberland', t('🦄 Zauberland'), t('Einhörner, Prinzessinnen und eine Burg'), () => d.startHabitat('zauberland'))`.
  - `src/ui/previews.ts`: `TileKind` erweitern. Die Vorschau zeigt Pastellhimmel, eine kleine Burg mit 6 Teilen (über `drawCastle` mit verkleinertem Layout), ein Einhorn und eine Prinzessin.
  - `src/i18n/source.json` und alle 17 `src/i18n/locales/*.json`: alle neuen Texte übersetzen.
  - `src/promo` bleibt unverändert (Nicht-Ziel).
- [ ] **Step 1: Run** `npx tsc --noEmit`. Expected: keine Fehler.
- [ ] **Step 2: Run** `node tools/i18n-extract.ts`. Danach Übersetzungen für jede Sprache über `tools/i18n-apply.ts` einspielen und erneut ausführen. Expected: Keine Sprache meldet fehlende Texte.
- [ ] **Step 3: Run** `npx vitest run --no-file-parallelism`. Expected: alle Tests PASS.
- [ ] **Step 4: In der laufenden App ansehen.** Mit dem run-Skill bzw. `npm run dev` und dem Browser:
  - Kachel und Vorschau prüfen.
  - Zauberland starten und über die Test- oder Lab-Eingabe Buchstaben einspielen, so wie die anderen Welten im Lab getestet werden.
  - Screenshots von Burg-Wachstum, Fensterblick, Ritt und Regenbogenflug ansehen.
  - Bildrate grob mit der Savanne vergleichen.
- [ ] **Step 5: Commit** `"Zauberland: neue Welt mit Einhörnern, Prinzessinnen und wachsender Burg"`. Pushen erst nach Freigabe.
