# Saisonwelten und Zeitplan – Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neun Saisonwelten wie Savanne und Co., und ein Admin-Zeitplan, der alle Spiele des Startbildschirms nach Datum ein- und ausblendet.

**Architecture:** Ein reines Modul `src/app/worlds.ts` kennt alle Spiele, die Startzeiten und rechnet „aktiv heute?“. Der Server speichert den Plan als JSON in einer neuen Tabelle und gibt ihn öffentlich aus; die App holt ihn beim Start, merkt ihn sich und blendet danach Kacheln und Spielstände ein oder aus. Jede Saisonwelt ist eine eigene `HabitatDef` in `src/scenes/seasons/<id>.ts` mit Figuren in `src/game/creatures/seasons/<id>.ts`; die bestehende `HabitatScene` spielt sie ab.

**Tech Stack:** TypeScript, Vite, Canvas 2D, vitest mit @napi-rs/canvas, Node-Server mit Postgres (`pg`).

**Spec:** `docs/superpowers/specs/2026-11-07-saisonwelten-design.md`

## Global Constraints

- Commit-Nachrichten auf Deutsch, enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nie `.claude/` oder `.superpowers/` committen.
- Tests: `npx vitest run --no-file-parallelism`; Build: `npm run build`. Viele Dateien haben CRLF; beim Ersetzen mit Skripten die Zeilenenden erhalten.
- Alle sichtbaren Texte mit `t('…')` oder `tk('…')`, Deutsch als Schlüssel; am Ende in alle 17 Sprachen unter `src/i18n/locales/` (`node tools/i18n-extract.ts`, `node tools/i18n-apply.ts <lang> --check`).
- Welt-Ids: `weihnachten`, `winter`, `neujahr`, `ostern`, `fruehling`, `strand`, `herbst`, `halloween`, `martin`. Bestehende Spiele: `meer`, `weltraum`, `savanne`, `zauberland`, `duell`, `riesenburg`, `tuerme`, `malen` (`rechenmeer` bleibt außerhalb des Plans, solange `RECHENMEER` aus ist).
- Startzeiten exakt wie in der Spec-Tabelle; Ostern `{ before: 14, after: 1 }`.
- Datum: Ortszeit des Geräts, Anfang und Ende eingeschlossen.

## Review Focus

1. Zeitraum über Silvester (Neujahr 27.12.–6.1., Winter 1.12.–28.2.): am 31.12., 1.1. und 7.1. richtig aktiv/inaktiv — Test in Task 1.
2. Gespeicherter Plan vom Server mit fehlender, unbekannter oder kaputter Welt: Vorgabe greift, nichts stürzt ab — Tests in Task 1 und 2.
3. Server nicht erreichbar oder langsam: Startbildschirm erscheint sofort mit gemerktem Plan oder Vorgabe — Test in Task 3.
4. Spielstand einer gerade inaktiven Welt: nicht in der Liste, nicht bei „Weiterspielen“, bleibt aber gespeichert — Test in Task 3.
5. Ziehen in der Admin-Zeitleiste über das Jahresende und Mindestlänge 1 Tag — Test in Task 4.

---

### Task 1: Plan-Modell `src/app/worlds.ts`

**Files:** Create `src/app/worlds.ts`, `test/game/worlds.test.ts`

**Interfaces — Produces:**
- `type WorldId` (alle Ids oben außer `rechenmeer`), `WORLD_IDS: WorldId[]` (Reihenfolge: bestehende Spiele in Startbildschirm-Reihenfolge, dann Saisonwelten in Kalenderreihenfolge Neujahr, Winter, Frühling, Ostern, Strand, Herbst, Halloween, Martin, Weihnachten), `SEASONAL: Set<WorldId>`.
- `type WorldMode = 'plan' | 'on' | 'off'`; `interface WorldEntry { mode: WorldMode; from?: string; to?: string; easter?: { before: number; after: number } }` (`from`/`to` als `"MM-DD"`); `interface WorldPlan { version: 1; worlds: Record<WorldId, WorldEntry> }`.
- `DEFAULT_PLAN: WorldPlan`; `normalizePlan(raw: unknown): WorldPlan` (jede fehlende oder ungültige Welt bekommt die Vorgabe, unbekannte Ids fallen weg).
- `easterSunday(year: number): Date` (gregorianisch, anonymer Algorithmus).
- `rangeIn(entry: WorldEntry, year: number): { from: Date; to: Date }` (Ostern aus `easter`, sonst aus `from`/`to`; liegt `to` vor `from`, endet der Zeitraum im Folgejahr).
- `isActive(entry: WorldEntry, now: Date): boolean` und `activeUntil(entry: WorldEntry, now: Date): Date | null` (letzter Tag des laufenden Zeitraums, null bei `on`/`off`/inaktiv).

- [ ] Test zuerst: `easterSunday(2026)` = 5.4.2026, `easterSunday(2027)` = 28.3.2027; Neujahr aktiv am 31.12.2026 und 1.1.2027 und 6.1.2027, nicht am 7.1.2027 und 26.12.2026; Weihnachten aktiv am 1.12. und 26.12., nicht am 27.12.; Ostern 2027 aktiv am 14.3. und 29.3., nicht am 13.3. und 30.3.; `off` nie aktiv, `on` immer; `activeUntil(neujahr, 31.12.2026)` = 6.1.2027; `normalizePlan({worlds:{weihnachten:{mode:'kaputt'}, foo:{}}})` gibt für Weihnachten die Vorgabe und hat kein `foo`; `normalizePlan(null)` = Vorgabe; Winter 29.2.2028 aktiv.
- [ ] Laufen lassen, FAIL sehen; implementieren; PASS; Commit „Welten: Zeitplan-Modell mit Startzeiten und Ostern“.

### Task 2: Server – Plan speichern und ausgeben

**Files:** Modify `server/db.js` (Migration 4: `CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`; `getSetting(key)`, `setSetting(key, value)`), `server/validate.js` (`WORLD_IDS`, `validateWorlds(body)`), `server/api.js` (Routen), Test `test/server/worlds.test.ts`.

**Interfaces — Produces:** `GET /api/worlds` → `200 { plan: WorldPlan | null }` (null ohne Datenbank oder ohne gespeicherten Plan; `Cache-Control: no-store`); `POST /api/admin/worlds` (angemeldet, gleiche Herkunft) mit Body `WorldPlan` → `200 { ok: true }`, ungültig → 400.

- [ ] Test zuerst: `validateWorlds` akzeptiert `DEFAULT_PLAN` aus Task 1; lehnt ab: unbekannte Id, Modus `'x'`, `"13-01"`, `"02-30"`, `"2-1"`, Ostern `before: 61` oder `-1`, fehlendes `worlds`; nimmt `"02-29"` an. `WORLD_IDS` aus `server/validate.js` ist gleich `WORLD_IDS` aus `src/app/worlds.ts` (als Mengen).
- [ ] FAIL, implementieren, PASS. Routen in `api.js` wie die bestehenden (`needDb()`, `jsonBody`, `HttpError`). Commit „Welten: Zeitplan auf dem Server speichern“.

### Task 3: App – Plan holen, Kacheln und Spielstände danach

**Files:** Create `src/app/worldPlan.ts`; Modify `src/app/saves.ts`, `src/ui/startScreen.ts`, `src/app/app.ts`; Test `test/game/worldPlan.test.ts`, `test/game/hiddenModes.test.ts`.

**Interfaces — Produces:**
- `worldPlan.ts`: `currentPlan(): WorldPlan` (gemerkter Plan aus `localStorage` Schlüssel `krakelkrone.worlds`, sonst Vorgabe; Fehler beim Lesen → Vorgabe), `loadPlan(fetcher = fetch, timeoutMs = 2500): Promise<WorldPlan>` (holt `/api/worlds`, merkt und gibt zurück; bei Fehler, Zeitüberschreitung oder `plan: null` den bisherigen `currentPlan()`), `worldActive(id: WorldId, now = new Date()): boolean`.
- `saves.ts`: `modeAvailable(m)` = Rechenmeer-Regel und `worldActive` für Ids im Plan.
- `startScreen.ts`: Kacheln aus einer Liste `{ id, label, hint, open }`; nur aktive; aktive Saisonwelten vorn mit Kennzeichen `t('bis {date}', { date: 'T.M.' })` aus `activeUntil`.
- `app.ts`: beim Start `loadPlan()`; kommt ein anderer Plan an und ist der Startbildschirm offen, wird er neu gezeichnet.

- [ ] Test zuerst: `loadPlan` mit Fetcher, der nie antwortet → nach Timeout gemerkter Plan; mit `{plan:null}` → Vorgabe; mit gültigem Plan → gemerkt in `localStorage` (Test-Stub). `visibleSaves` blendet einen Spielstand von `halloween` am 7.11. aus und am 20.10. ein (Datum per Parameter oder fake timers).
- [ ] FAIL, implementieren, PASS, Build. Commit „Welten: Startbildschirm und Spielstände folgen dem Zeitplan“.

### Task 4: Admin – Zeitleiste

**Files:** Create `src/admin/worldsPanel.ts`, `src/admin/timeline.ts` (reine Rechnung); Modify `src/admin/main.ts`, `src/admin/admin.css`; Test `test/game/timeline.test.ts`.

**Interfaces — Produces:** `timeline.ts`: `dayOfYear("MM-DD"): number` (0..364, 29.2. wie 28.2.), `mmdd(day: number): string`, `dragRange(r: {from:number; to:number}, kind: 'start'|'end'|'move', deltaDays: number): {from:number; to:number}` (über das Jahresende umlaufend; Anfang und Ende nie mehr als 364 Tage auseinander; mindestens 1 Tag, also bei `start`/`end` nie über das andere Ende hinaus). Ostern: Ziehen ändert `before`/`after` (0–60).

- [ ] Test zuerst: `dragRange({from:360,to:5},'move',10)` → `{from:5,to:15}`; `dragRange({from:10,to:12},'start',5)` → `{from:12,to:12}`; `mmdd(dayOfYear('12-31'))` = `'12-31'`.
- [ ] FAIL, implementieren, PASS. Panel nach dem Vorbild des Entwurfs `.superpowers/brainstorm/36629-1794068167/content/zeitleiste.html`: Gruppen „Immer da“ und „Jahreszeiten und Feste“, Schalter, Balken, rote Heute-Linie, Datumstext, „Speichern“/„Zurücksetzen“, Meldung bei 503/400. Im Browser prüfen. Commit „Admin: Zeitleiste für Welten“.

### Task 5: Grundlage für Saisonwelten

**Files:** Modify `src/game/creatures/genome.ts` (Archetyp `'season'`: `variant = floor(r()*12)`, `hue` frei 0–360), `src/scenes/habitat.ts` (`HabitatDef.id` um die neun Ids erweitern; optional `tile?(ctx, W, H): void` für die Vorschaukachel), `src/app/settings.ts` (`HabitatId`), `src/app/saves.ts` (`GameMode`, `MODES` mit Icon und Titel), `src/app/app.ts` (`HABITATS`, Titel), `src/ui/previews.ts` (`TileKind`, ruft `def.tile`), Create `src/scenes/seasons/index.ts` (`SEASON_DEFS: Record<SeasonId, HabitatDef>`, `SEASON_INFO: Record<SeasonId, { icon; title; hint }>`).

- [ ] Test zuerst in `test/game/seasons.test.ts`, für jede Def in `SEASON_DEFS`: `makeSprite` liefert für jede Stufe (`zerknittert` … `prachtvoll`) und Varianten 0–11 eine Leinwand mit sichtbaren Pixeln; `paint` füllt 1920×1080 ohne Fehler; eine `HabitatScene` mit 12 geschlüpften Figuren läuft 30 s in 1/30-s-Schritten, alle Figuren bleiben in `bounds` (mit 40 px Spiel) und nichts wird `NaN`. Der Test läuft über alle Einträge, er wächst mit jeder Welt.
- [ ] Platzhalter-Def nur für `weihnachten`, damit der Test läuft; Commit „Saisonwelten: Grundlage“.

### Tasks 6–14: je eine Welt (Reihenfolge: Weihnachten, Winter, Neujahr, Ostern, Frühling, Strand, Herbst, Halloween, Sankt Martin)

**Files je Welt:** Create `src/game/creatures/seasons/<id>.ts` (Sprites, 3–4 Arten, Seitenansicht, schaut nach rechts, Stil von `src/game/creatures/savanna.ts` mit `parts.ts`: Umriss, Augen, Glanz, Krone und Aura nach Genom), `src/scenes/seasons/<id>.ts` (`HabitatDef`: `paint`, `init`/`ambient`/`renderBack`/`renderFront` für Bewegung im Hintergrund, `behave`, `bounds`, `tile`, `word`/`count`); Eintrag in `src/scenes/seasons/index.ts`.

Inhalt je Welt aus der Spec-Tabelle. Bewegung: Bodenfiguren laufen wie in der Savanne (`sortY`, Tiefe); fliegende Figuren (Möwen, Bienen, Vögel, Hexen, Drachen) fliegen im Himmelsbereich, Fledermäuse sind nur Hintergrund; Laternen ziehen in einer Reihe; Feuerwerk steigt beim Schlüpfen auf, blüht als Funkenkreis auf und schwebt dann als leuchtende Blüte.

- [ ] Der Test aus Task 5 deckt die neue Def ab: erst eintragen, Test laufen lassen (FAIL, solange Sprite oder Def fehlen), dann bauen, PASS.
- [ ] Vorschau rendern (`tools/preview-scenes.ts` um die Welt erweitern) und als PNG ansehen; nachbessern, bis es im Stil der vorhandenen Welten freundlich und lesbar ist.
- [ ] Commit „Saisonwelt <Titel>“.

### Task 15: Übersetzungen

- [ ] `node tools/i18n-extract.ts`, für jede der 17 Sprachen die fehlenden Texte übersetzen und mit `tools/i18n-apply.ts` einspielen, `--check` für jede Sprache ohne Fehler. Commit „Saisonwelten: Übersetzungen“.

### Task 16: Gesamtprüfung

- [ ] Ganze Suite, Build, App im Browser: Startbildschirm am 7.11. (Herbst und Sankt Martin sichtbar mit Kennzeichen), mit vorgestelltem Datum 24.12. (Weihnachten, Winter), Admin-Zeitleiste ziehen und speichern gegen lokalen Server (`npm run dev:api`, falls Datenbank verfügbar; sonst Route mit Testdoppel). Jede Welt einmal mit echten Glyphen spielen (E2E-Werkzeug `tools/e2e.ts` oder Vorschau).
