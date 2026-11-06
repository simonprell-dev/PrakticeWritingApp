# Vordrucke, Stufe 1 und 2: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Rechenmeer ausblenden und mit einem Testblatt samt Messwerkzeug klären, welche Punkte Drucker, Kopierer und Kamera des Nutzers wirklich hergeben.

**Architecture:** Ein Schalter `RECHENMEER` blendet das Spiel an allen sichtbaren Stellen aus. Das Testblatt ist ein reines SVG. Die Messung `probeDots` ist eine reine Funktion auf einem Bild und läuft im vorhandenen Vision-Labor (`lab.html`), das dafür ein Live-Bild und eine Serienaufnahme bekommt.

**Tech Stack:** Vite, TypeScript, vitest (`npx vitest run --no-file-parallelism`).

**Spec:** `docs/superpowers/specs/2026-11-06-vordrucke-design.md`

**Umfang:** Nur Stufe 1 und 2 der Spec. Stufe 3 und 4 hängen vom Messergebnis ab und bekommen danach einen eigenen Plan.

## Global Constraints

- Arbeit auf dem Branch `vordrucke-testblatt`, nicht auf master. Mergen und Pushen nur nach Freigabe durch den Nutzer.
- Commit-Nachrichten auf Deutsch, Abschluss `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nur benannte Dateien `git add`-en. `.claude/` und `.superpowers/` werden nie committet.
- Rechenmeer-Code, seine Tests und seine Übersetzungen bleiben.
- Das Labor ist nicht übersetzt: Texte dort stehen direkt auf Deutsch, keine neuen i18n-Schlüssel.
- Normales Papier und die Erkennung bleiben unverändert: keine Änderung an `src/vision/pipeline.ts`, `src/vision/dedup.ts`, `src/camera/camera.ts`.

## Review Focus

1. Ein gespeichertes automatisches Rechenmeer-Spiel ist das neueste: Der „Weiter“-Eintrag auf dem Startbildschirm (`src/app/app.ts:405`) darf es nicht anbieten, sondern nimmt das nächste sichtbare. Test in Task 1.
2. Eine exportierte Rechenmeer-Datei wird importiert: Sie wird wie eine fremde Datei abgelehnt. Test in Task 1.
3. Weißes Bild oder reines Kamerarauschen: `probeDots` meldet nicht lesbar und stürzt nicht ab. Test in Task 2.
4. Blatt liegt leicht schräg: Das Raster wird trotzdem gefunden. Test in Task 2.
5. Gedruckte Linien im Feld (liniert, kariert) dürfen nicht als Punkte zählen. Test in Task 2.

---

### Task 1: Rechenmeer ausblenden

**Files:**
- Create: `src/app/features.ts`
- Modify: `src/app/saves.ts` (`listSaves`, `readSaveFile`), `src/ui/startScreen.ts:122`, `src/ui/settingsPanel.ts:190-192`
- Test: `test/game/hiddenModes.test.ts`

**Interfaces:**
- Produces: `RECHENMEER: boolean` (false) in `src/app/features.ts`; `visibleSaves(list: SaveMeta[]): SaveMeta[]` und `modeAvailable(m: GameMode): boolean` in `src/app/saves.ts`.

- [ ] **Step 1: Branch anlegen:** `git checkout -b vordrucke-testblatt`. Spec und dieser Plan kommen als erster Commit auf den Branch.

- [ ] **Step 2: Failing test schreiben**

```ts
const meta = (mode: GameMode, savedAt: number) => ({ id: mode, name: mode, mode, savedAt, auto: true, summary: '' }) as SaveMeta;

it('hidden modes do not appear in the saves', () => {
  expect(visibleSaves([meta('rechenmeer', 2), meta('meer', 1)]).map((m) => m.mode)).toEqual(['meer']);
});
it('the Rechenmeer is off, every other mode stays', () => {
  expect(modeAvailable('rechenmeer')).toBe(false);
  for (const m of Object.keys(MODES) as GameMode[]) if (m !== 'rechenmeer') expect(modeAvailable(m)).toBe(true);
});
it('a Rechenmeer save file is refused like a foreign file', async () => {
  const f = { text: async () => JSON.stringify({ format: FORMAT, version: 1, mode: 'rechenmeer', state: {} }) } as File;
  await expect(readSaveFile(f)).rejects.toThrow();
});
```

- [ ] **Step 3: Test laufen lassen:** `npx vitest run test/game/hiddenModes.test.ts --no-file-parallelism`. Expected: FAIL, `visibleSaves` fehlt.

- [ ] **Step 4: Umsetzen:** `listSaves` gibt `visibleSaves(all)` sortiert zurück, damit beide Aufrufer in `app.ts` erfasst sind. `readSaveFile` nimmt `!modeAvailable(g.mode)` in die erste Prüfung auf. Kachel und die drei Zeilen des Einstellungsabschnitts erscheinen nur bei `RECHENMEER`. Gespeicherte Spiele werden nicht gelöscht.

- [ ] **Step 5: Prüfen:** Der Test aus Step 2 ist grün, die ganze Suite ist grün, `npm run build` läuft durch. Bestehende Tests, die Rechenmeer-Spielstände speichern, dürfen dafür nicht geändert werden müssen. Wenn doch, ist `listSaves` die falsche Stelle: stoppen und prüfen.

- [ ] **Step 6: Im Browser ansehen:** Vite starten, Startbildschirm und Einstellungen bei breitem und schmalem Fenster prüfen. Die Kachel fehlt, das Kachelraster hat kein Loch. Falls doch, das Raster in `src/ui/styles.css` anpassen.

- [ ] **Step 7: Commit:** `Rechenmeer vorerst ausgeblendet`

---

### Task 2: Punkte messen

**Files:**
- Create: `src/vision/markProbe.ts`
- Test: `test/vision/markProbe.test.ts`

**Interfaces:**
- Consumes: `boxBlur(src: Float32Array, w, h, r)` aus `src/vision/filters.ts`, `RGBAImage`.
- Produces:

```ts
export interface DotProbe {
  /** Rasterabstand in Pixeln, 0 wenn keiner gefunden wurde */
  pitchPx: number;
  /** Anteil der Rasterstellen, an denen ein Punkt gefunden wurde */
  hitRate: number;
  /** Anteil der gefundenen Punkte, die nicht auf dem Raster liegen */
  falseRate: number;
  /** mittlere Tiefe der Punkte gegen den Hintergrund, 0..1 */
  contrast: number;
  readable: boolean;
}
export const MIN_HIT = 0.9;
export const MAX_FALSE = 0.1;
export function probeDots(img: RGBAImage): DotProbe;
```

- [ ] **Step 1: Failing tests schreiben.** Ein Helfer im Test malt in ein `RGBAImage`: Hintergrundfarbe, ein Punktraster (Abstand, Radius in Pixeln, Punktfarbe, Winkel), optional Linien, plus Rauschen aus `mulberry32`.

| Test | Bild | Erwartung |
|---|---|---|
| `finds a clear lattice` | 600 × 300, Abstand 24 px, Radius 3 px, Punkt 217 auf 255, Rauschen ±3 | `readable`, `pitchPx` 24 ± 1, `hitRate` ≥ 0.9 |
| `finds a tilted lattice` | wie oben, 6° gedreht | `readable` |
| `empty paper is not readable` | nur Weiß | `readable` false, `pitchPx` 0 |
| `noise is not readable` | Weiß mit Rauschen ±6 | `readable` false |
| `dots too faint for the noise` | Punkt 250 auf 255, Rauschen ±6 | `readable` false |
| `ruled lines are no dots` | Linien alle 24 px, ohne Punkte | `readable` false |
| `dots between ruled lines` | Raster und durchgehende Linien, die keine Punkte treffen | `readable` |

- [ ] **Step 2: Tests laufen lassen.** Expected: FAIL, Modul fehlt.

- [ ] **Step 3: `probeDots` umsetzen.** Vorgehen:
  1. Helligkeit bilden, je Zeile und Spalte durchgehende Strukturen abziehen (Median), damit Linien wegfallen.
  2. Hochpass: Helligkeit minus `boxBlur`. Rauschmaß aus der mittleren absoluten Abweichung.
  3. Kandidaten: lokale Minima tiefer als 4 Rauschmaße.
  4. Die zwei Rastervektoren aus den häufigsten Nachbarabständen bestimmen, weniger als 12 Kandidaten heißt: kein Raster.
  5. Raster an die Kandidaten anpassen, `hitRate` und `falseRate` mit einer Toleranz von 0,25 Abstand zählen.

- [ ] **Step 4: Tests laufen lassen.** Expected: alle PASS. Ganze Suite grün.

- [ ] **Step 5: Commit:** `Messung für Punktraster`

---

### Task 3: Testblatt

**Files:**
- Create: `src/lab/markTestSheet.ts`
- Test: `test/vision/markTestSheet.test.ts`

**Interfaces:**
- Produces:

```ts
export interface TestField { id: string; paper: 'weiss' | 'zeile' | 'band' | 'liniert' | 'kariert'; color: string; radius: number; page: 1 | 2 }
export const TEST_FIELDS: TestField[];
export function markTestSvg(page: 1 | 2): string;
```

Werte:
- **Punktfarben:** `#d9dde8` (Blass), `#c6cddd`, `#aab3c8`, `#8d879c`.
- **Radien:** 0,16, 0,22 und 0,30 mm.
- **Abstand:** 3 mm, Feld 58 × 20 mm.
- **Seite 1:** `weiss` (`#fff`), `zeile` (`#f8fafe`), `band` (`#e3edfa`), also 36 Felder in 12 Reihen zu 3.
- **Seite 2:** `liniert` (Linien `#b3c4de`, 8 mm), `kariert` (Linien `#c9d6e8`, 5 mm), also 24 Felder in 8 Reihen zu 3. Darunter eine Leiste mit Kästchenfeldern: 2-mm-Kästchen im Abstand 4 mm in `#8d879c` und `#6d6680`, IDs `kaestchen-hell` und `kaestchen-dunkel`, dazu eine Krone in `#6d6680`.
- **Beschriftung:** Jedes Feld trägt über sich klein seine `id`, zum Beispiel `band-blass-016`. Die Beschriftung liegt außerhalb der Punktfläche.

- [ ] **Step 1: Failing tests schreiben:** Es gibt 60 Felder plus 2 Kästchenfelder mit eindeutiger `id`. Jede `id` steht im SVG ihrer Seite. Das SVG hat `width="210mm"` und `height="297mm"`. Ein Feld `blass` mit Radius 0,16 hat die Farbe `#d9dde8`. Kein Feld ragt über den Bereich 10 bis 200 mm und 10 bis 287 mm hinaus.

- [ ] **Step 2: Tests laufen lassen.** Expected: FAIL.

- [ ] **Step 3: `markTestSvg` umsetzen.** Die Liste `TEST_FIELDS` schließt die Kästchenfelder mit ein, sie brauchen dafür `kind?: 'dots' | 'boxes'`.

- [ ] **Step 4: Tests laufen lassen.** Expected: PASS. SVG als PNG rendern (`@napi-rs/canvas`, Vorlage `tools/preview-rechen.ts`) und ansehen: nichts überlappt, Beschriftung lesbar.

- [ ] **Step 5: Commit:** `Testblatt für Punktraster`

---

### Task 4: Messen im Labor

**Files:**
- Create: `src/lab/markSeries.ts`
- Modify: `lab.html`, `src/lab/lab.ts`
- Test: `test/vision/markSeries.test.ts`

**Interfaces:**
- Consumes: `probeDots`, `TEST_FIELDS`, `markTestSvg`.
- Produces:

```ts
export interface Shot { field: string; source: 'druck' | 'kopie'; view: 'nah' | 'ganz'; probe: DotProbe; glyphs: number; pxPerMm: number }
export interface FieldResult { field: string; source: Shot['source']; view: Shot['view']; shots: number; passed: number; ok: boolean }
export function summarize(shots: Shot[]): FieldResult[];
```

Ein Schuss besteht, wenn `probe.readable` gilt und `glyphs === 0`. `ok` gilt ab 10 Aufnahmen mit mindestens 9 bestandenen, wie in der Spec. `pxPerMm` ist `pitchPx / 3`, bei Kästchenfeldern `pitchPx / 4`.

- [ ] **Step 1: Failing tests schreiben:** 10 Schüsse, davon 9 bestanden, ergibt `ok`. 8 bestanden ergibt nicht `ok`. 9 Schüsse ergeben nie `ok`. Ein Schuss mit `glyphs: 1` zählt nicht als bestanden. Druck und Kopie sowie nah und ganz werden getrennt gezählt.

- [ ] **Step 2: Tests laufen lassen.** Expected: FAIL.

- [ ] **Step 3: `summarize` umsetzen.** Tests grün.

- [ ] **Step 4: Labor erweitern.** Neuer Abschnitt in `lab.html`:
  - Knopf **Testblatt drucken**: beide Seiten in einem nur beim Druck sichtbaren Element, mit `@page { size: A4; margin: 0 }` und Seitenumbruch.
  - Live-Vorschau der Kamera mit einem Rahmen in der Bildmitte. Die Messung nutzt nur diesen Rahmen, in voller Kameraauflösung.
  - Auswahl für Feld, Quelle (Druck, Kopie) und Abstand (nah, ganz).
  - Knopf **10 Aufnahmen**: 10 Bilder im Abstand von 300 ms. Je Bild `probeDots` auf dem Rahmen und `engine.scan` für `glyphs`.
  - Ergebnistabelle aus `summarize`.
  - Knopf **Ergebnis kopieren**: die Schüsse als JSON in die Zwischenablage.

- [ ] **Step 5: Im Browser prüfen:** Testblatt am Bildschirm abfotografieren ist kein Ersatz für Papier, reicht aber für die Funktion: `npm run lab`, Kamera an, Serie läuft, Tabelle füllt sich, JSON lässt sich kopieren, Druckvorschau zeigt zwei A4-Seiten ohne Laborseite. Ohne Kamera mit Edge headless und Fake-Kamera (`--use-fake-device-for-media-stream`).

- [ ] **Step 6: Commit:** `Labor: Serienmessung fürs Testblatt`

---

### Task 5: Messung durch den Nutzer

Hier wird nichts gebaut. Der Nutzer führt das aus, der Ausführende bereitet es vor und wertet aus.

- [ ] **Step 1:** Ganze Suite und `npm run build` laufen lassen. Dem Nutzer sagen, wie das Labor zu erreichen ist: `npm run lab` am PC. Soll ein Handy oder Tablet messen, braucht es die Live-Seite. Das setzt Merge und Push voraus, deshalb vorher fragen.
- [ ] **Step 2:** Der Nutzer druckt beide Seiten mit 100 % Skalierung und macht von jeder eine Kopie.
- [ ] **Step 3:** Der Nutzer misst nah: die Felder `…-blass-016` auf allen fünf Papierarten, auf Ausdruck und Kopie. Falls „Blass“ durchfällt, die nächstkräftigeren Felder.
- [ ] **Step 4:** Der Nutzer misst das ganze Blatt im Bild: die beiden Kästchenfelder, auf Ausdruck und Kopie. Liest die Kamera die Kästchen so nicht, gilt der Plan für den Blick aufs ganze Blatt nicht.
- [ ] **Step 5:** JSON auswerten und dem Nutzer vorlegen: welche Stufe besteht, auf welcher Papierart, was es für Kopien heißt. Bei Durchfallen die Spec-Alternativen zeigen. Der Nutzer entscheidet.
- [ ] **Step 6:** Ergebnis in die Spec eintragen, dann Plan für Stufe 3 und 4 schreiben.
