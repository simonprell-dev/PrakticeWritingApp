# Mal-Aquarium: zwölf Meerestiere und Freiform-Karte – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Mal-Aquarium gets twelve animals plus a free-form card, printable as one sheet per animal, a free-form sheet and two fixed mixed sheets; the camera tells the animals apart and each one moves its own way.

**Architecture:** The single `FISH` object becomes one entry of a species register (`src/game/paint/species.ts`). Everything that today reads `FISH` (card art, print sheet, line samples, card detection, painted sprite) takes a `SpeciesId`. Card detection scores every species in every pose and only accepts a clear winner. The free-form card is cut out by colour/ink against the paper. Motion per species lives in one module used by `PaintScene`.

**Tech Stack:** TypeScript, Canvas 2D, Vite, Vitest with `@napi-rs/canvas` for synthetic card photos.

**Spec:** `docs/superpowers/specs/2026-10-29-mal-aquarium-meerestiere-design.md`

## Global Constraints

- Card size and frame stay: `CARD = { w: 94, h: 88, frame: 2.6, margin: 3 }`, 2 × 3 cards per A4 (`SHEET`).
- The existing fish keeps its exact paths and placement (`FISH_TO_CARD = { s: 0.82, x: 6, y: 12 }`) so already printed sheets are still recognised as `fisch`.
- Species ids and German names (UI text): `fisch` Fisch, `clownfisch` Clownfisch, `doktorfisch` Doktorfisch, `kugelfisch` Kugelfisch, `karpfen` Karpfen, `hecht` Hecht, `hai` Hai, `seepferdchen` Seepferdchen, `qualle` Qualle, `krake` Krake, `schildkroete` Schildkröte, `krebs` Krebs, `freiform` (eigenes Tier).
- Mixed sheet A = `clownfisch, doktorfisch, kugelfisch, karpfen, hecht, hai`; mixed sheet B = `fisch, seepferdchen, qualle, krake, schildkroete, krebs` (in this order).
- Doktorfisch is drawn as the real Paletten-Doktorfisch, never as a film character; no brands or logos.
- Free-form card: hint text „Mal dein eigenes Meerestier!“ at the top, an arrow with „Kopf nach hier →“, name line „Mein Tier heißt:“. Free-form animals are assumed to face right.
- Animal cards: name line „Mein <Name> heißt:“ (e.g. „Mein Seepferdchen heißt:“); text and line must fit inside the frame.
- Unsure card (best species too weak, or second best too close): not hatched; toast „Diese Karte erkenne ich nicht sicher – bitte flach und ganz ins Bild legen“.
- Saves without a species are `fisch`.
- Card detection may take at most about twice as long per photo as today.

## Review Focus

1. An old printed sheet (today's fish) must still come out as `fisch`, never as a look-alike fish → test in Task 4.
2. Two cards of different animals coloured alike must not count as "kenne ich schon" → test in Task 6.
3. A free-form drawing that touches the frame, or a name written on the line, must not end up in the cut-out → test in Task 5.
4. Pale crayon (light yellow) on a free-form card still counts as painted → test in Task 5.
5. A card half covered by a hand is "unsure", not a wrong animal → test in Task 4.

---

### Task 1: Species register, existing fish moved into it

**Files:**
- Create: `src/game/paint/species.ts`
- Modify: `src/game/paint/fishCard.ts` (geometry helpers take a species), `src/game/paint/cardArt.ts`, `src/ui/printSheet.ts`, `src/vision/cards.ts`, `src/game/creatures/paintedFish.ts` (callers pass `'fisch'`)
- Test: `test/paint/species.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SpeciesId = 'fisch' | 'clownfisch' | 'doktorfisch' | 'kugelfisch' | 'karpfen' | 'hecht' | 'hai'
    | 'seepferdchen' | 'qualle' | 'krake' | 'schildkroete' | 'krebs' | 'freiform';
  export type Motion = 'swim' | 'dart' | 'puff' | 'bob' | 'pulse' | 'arms' | 'glide' | 'walk' | 'sway';
  export interface Eye { x: number; y: number; r: number; pupil: { x: number; y: number; r: number } }
  export interface SpeciesDef {
    id: SpeciesId;
    name: string;                 // 'Seepferdchen'
    article: 'der' | 'die' | 'das';
    /** closed outline parts, back to front, in the animal's own units */
    parts: { id: string; d: string }[];
    /** ids of the parts drawn as the separately animated limb (tail, fins, claws, arms); may be empty */
    moving: string[];
    /** pivot of the moving part (animal units) */
    pivot: { x: number; y: number };
    lines: string[];              // inner lines (colouring areas)
    strokes: string[];            // mouth and other open details
    eyes: Eye[];
    box: { x0: number; y0: number; x1: number; y1: number };
    /** animal units -> card mm */
    place: { s: number; x: number; y: number };
    motion: Motion;
    /** size in the aquarium relative to the fish (1) */
    size: number;
  }
  export const SPECIES: Record<SpeciesId, SpeciesDef>;
  export const ANIMALS: SpeciesId[]; // all but 'freiform', in the order of the table in the spec
  ```
  In `fishCard.ts`: `partPolygons(sp: SpeciesId)`, `onAnimal(sp: SpeciesId, x: number, y: number)`, `lineSamples(sp: SpeciesId, step?: number)`, `toCard(sp: SpeciesId, x: number, y: number): Pt` replace `partPolygons()`, `onFish`, `lineSamples(step)`, `fishToCard`. `CARD`, `SHEET`, `CARD_PX`, `LINE`, `sheetLayout`, `flatten`, `insidePolygon` stay.

- [ ] **Step 1: Write the failing test** `test/paint/species.test.ts`
  - `it('keeps the fish exactly as printed before')`: `SPECIES.fisch.place` equals `{ s: 0.82, x: 6, y: 12 }`; its `parts` ids are `['tail','dorsal','anal','pelvic','body','pectoral']`; `lineSamples('fisch', 1).length` equals the count of today's `lineSamples(1)` (print it once with the current code before changing anything and write it into the test as a literal).
- [ ] **Step 2: Run** `npx vitest run test/paint/species.test.ts` – Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `species.ts` with only `fisch` filled from today's `FISH` (other ids may point to `fisch` temporarily – Task 3 replaces them; `freiform` gets empty `parts`), and switch all callers to the species-taking helpers with `'fisch'`.
- [ ] **Step 4: Run** `npm test` – Expected: all tests pass (the card detection tests prove nothing changed).
- [ ] **Step 5: Commit** `git commit -m "Mal-Aquarium: Tier-Register, bisheriger Fisch als erster Eintrag"`

### Task 2: Cards and print sheets per species, free-form card, sheet choice

**Files:**
- Create: `src/game/paint/sheets.ts`
- Modify: `src/game/paint/fishCard.ts` (labels per species), `src/game/paint/cardArt.ts`, `src/ui/printSheet.ts`
- Test: `test/paint/sheets.test.ts`

**Interfaces:**
- Consumes: `SPECIES`, `SpeciesId`, `ANIMALS` (Task 1).
- Produces:
  ```ts
  export type SheetId = SpeciesId | 'mix-a' | 'mix-b';
  export const MIX_A: SpeciesId[]; export const MIX_B: SpeciesId[];
  export function sheetSpecies(id: SheetId): SpeciesId[];        // always 6
  export function sheetTitle(id: SheetId): string;                // 'Hai', 'Gemischt: Fische', 'Gemischt: Meerestiere', 'Eigenes Tier'
  export function labelsFor(sp: SpeciesId): { hint: Label; name: Label; line: { x0: number; x1: number; y: number }; nameBox: Box; arrow?: { x: number; y: number; text: string } };
  ```
  `CardLook` gets `species?: SpeciesId` (default `'fisch'`) and `fills` keyed by part id. `sheetSvg(id: SheetId)` and `printSheet(id: SheetId)`.

- [ ] **Step 1: Write the failing tests**
  - `sheetSpecies('mix-a')` → `['clownfisch','doktorfisch','kugelfisch','karpfen','hecht','hai']`; `sheetSpecies('mix-b')` → `['fisch','seepferdchen','qualle','krake','schildkroete','krebs']`; `sheetSpecies('hai')` → six `'hai'`.
  - `labelsFor('seepferdchen').name.text` is `'Mein Seepferdchen heißt:'`; `labelsFor('freiform').name.text` is `'Mein Tier heißt:'`, `.hint.text` is `'Mal dein eigenes Meerestier!'`, `.arrow.text` is `'Kopf nach hier →'`.
  - For every species: the name text measured with `@napi-rs/canvas` (`600 <size>px Fredoka`, fall back to sans-serif width × 1.1) ends at least 2 mm before `line.x0`, and `line.x1 - line.x0 >= 30`; `line.x1 <= CARD.w - CARD.frame - 2`.
  - `sheetSvg('mix-b')` contains six card groups (`<g transform="translate(`… count 6).
- [ ] **Step 2: Run** `npx vitest run test/paint/sheets.test.ts` – Expected: FAIL.
- [ ] **Step 3: Implement** sheets and labels; `drawCard` and `cardSvg` draw any species from its `parts`/`lines`/`strokes`/`eyes`; the free-form card draws hint, arrow and name line only. Name font may shrink for long names (min 3.0 mm) before the line gets shorter.
- [ ] **Step 4: Run** `npm test` – Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mal-Aquarium: Karten und Druckbögen pro Tier, gemischte Bögen, Freiform-Karte"`

### Task 3: Artwork of the eleven new animals

**Files:**
- Modify: `src/game/paint/species.ts`
- Test: `test/paint/species.test.ts`

**Interfaces:**
- Consumes/produces: `SPECIES` entries for all ids in `ANIMALS`, motions as in the spec table: clownfisch/doktorfisch/karpfen/hai `swim`, hecht `dart`, kugelfisch `puff`, seepferdchen `bob`, qualle `pulse`, krake `arms`, schildkroete `glide`, krebs `walk`; `freiform` `sway`.

- [ ] **Step 1: Write the failing tests** (loop over `ANIMALS`)
  - every part polygon placed on the card (`toCard`) lies inside the frame's inner edge minus 2 mm and above `labelsFor(sp).line.y - 6` (does not collide with the name line);
  - every colouring area is child-sized: each part's area ≥ 25 mm² on the card (flattened polygon area via `polygonArea`);
  - each eye lies inside a part; `moving` ids exist in `parts`; `pivot` is inside the box;
  - the animal faces right: the mean x of its eyes is right of the box centre (except `qualle`, `krake`, `krebs`, `seepferdchen`, which may look forward – for those only check eyes inside a part).
- [ ] **Step 2: Run** – Expected: FAIL for the placeholder entries.
- [ ] **Step 3: Draw** the eleven animals as SVG path strings in the style of the fish (thick simple outlines, 3–6 colouring areas, one big eye with pupil). Distinct silhouettes are required for Task 4 (no two animals may share the body outline). Look at them with a throwaway script that writes `sheetSvg('mix-a')` and `sheetSvg('mix-b')` to the scratchpad as `.svg` and open them; fix what looks wrong.
- [ ] **Step 4: Run** `npx vitest run test/paint` – Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mal-Aquarium: elf neue Tiere gezeichnet"`

### Task 4: Card detection tells the animals apart

**Files:**
- Modify: `src/vision/cards.ts`, `test/helpers/cardScene.ts` (looks with `species`)
- Test: `test/vision/cards.test.ts`

**Interfaces:**
- Consumes: `lineSamples(sp)`, `ANIMALS`, `SpeciesId`.
- Produces: `CardHit.species: SpeciesId`; `CardScan.unsure: number` (frames found whose species was not clear; they are not in `cards`). Free-form cards are found by their own samples (hint text box outline, arrow, name line) – `lineSamples('freiform')` returns samples on those printed elements.

- [ ] **Step 1: Write the failing tests**
  - `it('tells every animal apart, in any pose')`: for each species in `[...ANIMALS, 'freiform']`, a coloured card photographed in three poses (`pose()` helper, rotated 0°, 90°+perspective, 200°) → one card, `species` correct, upright (`diffToArt` below today's threshold).
  - `it('reads both mixed sheets')`: sheet photos of `MIX_A` and `MIX_B` → six cards, species in reading order equal the sheet lists.
  - `it('an old fish sheet stays a fish')`: today's sheet (`fisch` × 6) → all `fisch`.
  - `it('a card half covered by a hand is unsure, not a wrong animal')`: cover the right half of a `karpfen` card with a skin-coloured polygon → `cards` has no `karpfen` mislabeled; either `unsure === 1` or the card is found as `karpfen`.
  - Timing: `findCards` on the mixed sheet photo takes at most 2.2 × the time of the old fish sheet photo measured in the same test (median of 3 runs each).
- [ ] **Step 2: Run** `npx vitest run test/vision/cards.test.ts` – Expected: FAIL.
- [ ] **Step 3: Implement**: score `species × 8 poses` per frame candidate; precompute samples per species once; accept the best when `best >= MIN_MATCH` and `best - second >= MARGIN` (tune `MARGIN` with the tests; start at 0.04); otherwise count `unsure`. To stay within the time budget, score a coarse subset (every 4th sample) first and only the top 3 species in full.
- [ ] **Step 4: Run** `npm test` – Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mal-Aquarium: Kamera erkennt, welches Tier auf der Karte ist"`

### Task 5: Free-form cut-out and sprites for all animals

**Files:**
- Create: `src/game/paint/freeform.ts`, `src/game/creatures/paintedAnimal.ts` (replaces `paintedFish.ts`; keep `nameCrop`, `fishPicture` renamed `animalPicture`)
- Modify: `src/vision/cards.ts` (`colored` for free-form uses the cut-out), `src/game/creatures/sprite.ts`
- Test: `test/paint/freeform.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** 1 = painted pixel of the free-form animal (card image at CARD_PX), holes filled, crumbs and printed elements removed */
  export function freeformMask(img: RGBAImage): Uint8Array;
  export function paintedSprite(sp: SpeciesId, img: RGBAImage, k?: number, tex?: AnyCanvas): Sprite;
  export function animalPicture(s: Sprite, size: number): AnyCanvas;
  ```
  `Sprite.tail` keeps its shape and now carries the species' moving part; new optional `Sprite.motion?: Motion`.

- [ ] **Step 1: Write the failing tests**
  - a free-form card with a red blob in the middle and a pale yellow (`#fff3a0`) blob → mask covers ≥ 90 % of both blobs and < 1 % of the remaining paper;
  - a blob drawn touching the frame → frame pixels not in the mask; a name written on the line → not in the mask; hint text and arrow → not in the mask;
  - a blank free-form card → `colouredShare`-equivalent below `BLANK` (0.04) so it counts as „noch nicht ausgemalt“;
  - `paintedSprite('krebs', cardImage({ species: 'krebs', fills: … }))` has a `tail` (claws) and `motion === 'walk'`; `paintedSprite('freiform', img)` has no `tail`, no eyes, `motion === 'sway'`.
- [ ] **Step 2: Run** `npx vitest run test/paint/freeform.test.ts` – Expected: FAIL.
- [ ] **Step 3: Implement** the mask: paper level from the card margin, pixel painted when darker or more saturated than the paper by a threshold; clear a band of `frame + 1` mm, the hint/arrow boxes and the name box; morphological close, fill holes, drop components below 20 mm². The sticker edge is drawn around the mask outline.
- [ ] **Step 4: Run** `npm test` – Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mal-Aquarium: Freiform freistellen, Sprites für alle Tiere"`

### Task 6: Motion, scene and saves

**Files:**
- Create: `src/game/paint/motion.ts`
- Modify: `src/scenes/paintScene.ts`, `src/scenes/habitat.ts` (`drawCreature` asks the motion for a pose when `sprite.motion` is set)
- Test: `test/game/saveState.test.ts`, `test/paint/motion.test.ts`

**Interfaces:**
- Consumes: `Motion`, `SPECIES[sp].size`, `CardHit.species`, `CardScan.unsure`.
- Produces:
  ```ts
  export interface Pose { sx: number; sy: number; rot: number; dy: number; limb: number }
  /** how the animal looks at time t (seconds) while moving with speed vx */
  export function poseOf(m: Motion, t: number, phase: number, vx: number): Pose;
  /** steering: replaces the habitat's default swimming for this motion (walk keeps to the sand, bob drifts slowly, dart waits and shoots) */
  export function behavePainted(m: Motion, c: Creature, dt: number, bounds: Bounds, sandY: number): void;
  ```
  `PaintSave.fish[i].species?: SpeciesId`; `KnownCard.species: SpeciesId`; `PaintedSkin.species: SpeciesId`.

- [ ] **Step 1: Write the failing tests**
  - `poseOf('pulse', …)` varies `sy` by at least 0.1 over one second; `poseOf('swim', …)` keeps `sx === sy`; `poseOf('walk', …).rot === 0`.
  - `behavePainted('walk', …)` keeps `c.y` within 40 px of `sandY` after 10 s of updates.
  - Save/restore: a scene with a `hai` and a `freiform` restores both with their species; an old save object without `species` restores as `fisch`.
  - Known cards: a `karpfen` card and a `clownfisch` card with identical fills both hatch (not „kenne ich schon“).
- [ ] **Step 2: Run** – Expected: FAIL.
- [ ] **Step 3: Implement**; texts in `handleCards`: „Ein neuer Hai!“ / „Ein neues Seepferdchen!“ / „Eine neue Qualle!“ (article from `SPECIES`), plural „3 neue Tiere!“; free-form „Ein neues Tier!“; unsure → the toast from Global Constraints; „Keine Karte gefunden“ instead of „Keine Fisch-Karte gefunden“.
- [ ] **Step 4: Run** `npm test` – Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Mal-Aquarium: jedes Tier bewegt sich anders, Spielstände mit Tierart"`

### Task 7: Lobby – choose and print a sheet

**Files:**
- Modify: `src/ui/paintLobby.ts`, `src/ui/styles.css`
- Test: manual (build + look)

**Interfaces:**
- Consumes: `SheetId`, `sheetSpecies`, `sheetTitle`, `printSheet(id)`, `drawCard` with `species`.

- [ ] **Step 1: Implement** a chooser (segmented row: „Gemischt: Fische“, „Gemischt: Meerestiere“, „Eigenes Tier“, plus a select „Ein Tier: …“ with the twelve animals) above „🖨️ Vorlage drucken“; the preview shows the six cards of the chosen sheet small (3 × 2 grid, coloured with sample fills). Texts: „Sechs Tiere passen auf ein A4-Blatt“, „Jedes Kind malt ein Tier bunt an …“; remembered choice per viewer in `localStorage` (try/catch).
- [ ] **Step 2: Run** `npm run build` – Expected: built without errors; `npm test` PASS.
- [ ] **Step 3: Look**: run `npm run dev`, open the Mal-Aquarium lobby, switch through all sheets, open the print preview of „Gemischt: Meerestiere“ and „Eigenes Tier“; on a phone-width window the chooser wraps and nothing scrolls sideways.
- [ ] **Step 4: Commit** `git commit -m "Mal-Aquarium: Bogen auswählen und drucken"`
