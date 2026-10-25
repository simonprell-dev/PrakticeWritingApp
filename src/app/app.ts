// Wires camera -> vision worker -> scenes and owns the screens (start, game, duel), and keeps the games
// (the last game of every mode automatically, others under a name or as a file).
import { Camera, CameraError, type Grab } from '../camera/camera.ts';
import { AutoScan, MotionProbe } from '../camera/motion.ts';
import { setSound, sfx, unlockAudio } from '../game/audio.ts';
import { Loop } from '../game/loop.ts';
import { Stage } from '../game/stage.ts';
import { withArticle } from '../recog/classes.ts';
import type { EngineInfo, SavedMemory } from '../recog/engine.ts';
import { createVision, type VisionClient } from '../recog/workerClient.ts';
import { aquarium } from '../scenes/aquarium.ts';
import { DuelScene, teamColor, type DuelResult } from '../scenes/duelScene.ts';
import { SiegeScene, type SiegeResult } from '../scenes/siegeScene.ts';
import { TowerScene, type TowerResult } from '../scenes/towerScene.ts';
import { HabitatScene, type HabitatDef } from '../scenes/habitat.ts';
import { PaintScene } from '../scenes/paintScene.ts';
import { savanna } from '../scenes/savanna.ts';
import type { Scene, SceneHost, Snapshot } from '../scenes/scene.ts';
import { space } from '../scenes/space.ts';
import { openCameraSetup } from '../ui/cameraSetup.ts';
import { showDebug } from '../ui/debugView.ts';
import { button, clear, h, isModalOpen, modal } from '../ui/dom.ts';
import { openDuelLobby } from '../ui/duelLobby.ts';
import { openGlyphCard } from '../ui/glyphCard.ts';
import { openPaintedCard, openPaintLobby } from '../ui/paintLobby.ts';
import { openContinue, openSaveDialog, openSavesList } from '../ui/savesPanel.ts';
import { LEGAL_PATHS, openLegal } from '../ui/legal.ts';
import { Hud } from '../ui/hud.ts';
import { openSettings } from '../ui/settingsPanel.ts';
import { renderStart } from '../ui/startScreen.ts';
import { openTargetPicker } from '../ui/targetPicker.ts';
import { toast } from '../ui/toast.ts';
import { openSiegeLobby } from '../ui/siegeLobby.ts';
import { openViewfinder } from '../ui/viewfinder.ts';
import { openTowerLobby } from '../ui/towerLobby.ts';
import { confetti, openSiegeResult, openTowerResult, openVictory } from '../ui/victoryScreen.ts';
import { PEN_PRESETS, SLIP_PRESETS } from '../vision/color.ts';
import { DETECT_SIZE } from '../vision/constants.ts';
import type { PlayerId, ScanResult, VisionOptions } from '../vision/types.ts';
import { packTyped, unpackTyped } from './imageCodec.ts';
import { autoId, defaultName, deleteSave, downloadSave, FORMAT, getMeta, listSaves, loadSave, MODES, newSaveId, putSave, readSaveFile, type GameMode, type SaveGame } from './saves.ts';
import { loadSettings, saveSettings, type CameraMode, type HabitatId, type Settings } from './settings.ts';

const HABITATS: Record<HabitatId, HabitatDef> = { meer: aquarium, weltraum: space, savanne: savanna };
/** the paper setting as the recognition sees it: Lineatur 1 and 2 have the same four-line shape */
const LINEATUR = { auto: 'auto', L1: 'school4', L2: 'school4', L3: 'school2', liniert: 'plain', blanko: 'none' } as const;
const DEBUG = new URLSearchParams(location.search).has('debug');

type Mode = { kind: 'start' } | { kind: 'habitat'; id: HabitatId } | { kind: 'paint' } | { kind: 'duel' } | { kind: 'siege' } | { kind: 'tower' };

/** a phone camera goes off this long after the last photo (battery; the next photo starts faster before) */
const HAND_CAMERA_OFF = 20_000;

/** keep the running game every so often, and soon after something new happened */
const AUTOSAVE_EVERY = 30_000;
const AUTOSAVE_AFTER = 2_500;

export class App {
  settings: Settings = loadSettings();
  stage: Stage;
  loop: Loop;
  camera = new Camera();
  vision: VisionClient = createVision();
  visionReady: Promise<EngineInfo>;
  engineInfo: EngineInfo | null = null;
  probe: MotionProbe;
  auto: AutoScan;
  scene: Scene | null = null;
  hud: Hud | null = null;
  mode: Mode = { kind: 'start' };
  ui: HTMLElement;
  busy = false;
  wakeLock: WakeLockSentinel | null = null;
  /** a saved game is being loaded into the scene: it does not move yet */
  frozen = false;
  private saveSoon = 0;
  private cameraOff = 0;
  private saveEvery = 0;
  private saving: Promise<void> | null = null;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ui = ui;
    this.stage = new Stage(canvas);
    this.stage.onResize(() => this.scene?.resize(this.stage.worldW));
    this.loop = new Loop(
      (dt) => {
        if (!this.frozen) this.scene?.update(dt);
      },
      () => this.render(),
    );
    this.loop.start();
    this.visionReady = this.vision.init().then(
      (info) => (this.engineInfo = info),
      (e) => {
        toast('Die Erkennung konnte nicht geladen werden: ' + (e as Error).message, 'warn', 8000);
        throw e;
      },
    );
    this.probe = new MotionProbe(this.camera, () => this.settings.camera);
    this.auto = new AutoScan(
      this.probe,
      () => this.settings.recog.autoDelay,
      () => this.busy || this.frozen || isModalOpen() || this.mode.kind === 'start',
      () => this.scan('auto'),
    );
    this.auto.onChange = () => this.hud?.setAuto(this.auto.enabled, this.auto.progress);
    this.camera.onEnded = () => toast('Die Kamera wurde getrennt. Bitte wieder anschließen.', 'warn', 6000);
    setSound(this.settings.game.sound, this.settings.game.volume);

    // touch: no long-press menu on the game
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.scene) return;
      const p = this.stage.toWorld(e.clientX, e.clientY);
      this.scene.tap(p.x, p.y);
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.mode.kind !== 'start') void this.requestWakeLock();
      // the tab is closed or the laptop goes to sleep: keep the game
      if (document.visibilityState === 'hidden') void this.autosave();
    });
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
      if (!this.handheld && !this.camera.ready() && this.settings.camera.deviceId) void this.openCamera(this.settings.camera.deviceId).catch(() => undefined);
    });
    this.showStart();
    void this.boot();
  }

  private async boot(): Promise<void> {
    // direct links to the legal pages are always reachable, before anything else
    const legal = LEGAL_PATHS[location.pathname.replace(/\/$/, '')];
    if (legal) {
      void openLegal(legal, () => {
        history.replaceState(null, '', '/');
        void this.startup();
      });
      return;
    }
    await this.startup();
  }

  private async startup(): Promise<void> {
    if (!this.settings.firstRunDone) {
      this.settings.firstRunDone = true;
      this.save();
      this.cameraSetup();
      return;
    }
    // a phone or tablet only starts its camera for a photo
    if (!this.handheld) {
      try {
        await this.openCamera(this.settings.camera.deviceId);
      } catch {
        /* the start screen shows the camera status */
      }
    }
    if (this.mode.kind === 'start') this.showStart();
  }

  /** the camera is held in the hand (phone, tablet): photos through the viewfinder */
  get handheld(): boolean {
    return this.settings.camera.mode === 'hand';
  }

  /** the camera settings a photo is taken with: a camera in the hand is never turned or cut */
  private camConfig(): Settings['camera'] {
    const c = this.settings.camera;
    return c.mode === 'hand' ? { ...c, rotation: 0, mirror: false, roi: undefined } : c;
  }

  /** automatic scans need a camera that stands still */
  private autoAllowed(): boolean {
    return this.settings.recog.autoScan && !this.handheld;
  }

  /**
   * A photo: a fixed camera takes it right away, a phone or tablet opens the viewfinder first.
   * Null when the viewfinder was closed without a photo.
   */
  private async photo(maxSide: number, what: { title: string; hint: string; frame?: 'sheet' | 'card' }): Promise<Grab | null> {
    if (!this.handheld) return this.camera.grab(this.camConfig(), 2, maxSide);
    clearTimeout(this.cameraOff);
    const g = await openViewfinder({
      camera: this.camera,
      open: () => this.openCamera(this.settings.camera.deviceId),
      grab: () => this.camera.grab(this.camConfig(), 4, maxSide, true),
      ...what,
    });
    this.cameraOff = window.setTimeout(() => {
      if (this.handheld && !document.querySelector('.cam-setup')) this.camera.close();
    }, HAND_CAMERA_OFF);
    return g;
  }

  /** what the viewfinder asks for */
  private photoText(team?: PlayerId): { title: string; hint: string; frame?: 'sheet' | 'card' } {
    if (this.scene instanceof PaintScene) return { title: 'Fisch-Karte fotografieren', hint: 'Die ganze Karte mit dem schwarzen Rahmen ins Bild, dann auf den runden Knopf.', frame: 'card' };
    const name = team ? this.teamKeys().find((t) => t.id === team)?.name : undefined;
    return {
      title: name ? `Foto für ${name}` : 'Foto machen',
      hint: 'Alle Buchstaben in den Rahmen, dann auf den runden Knopf.',
    };
  }

  /** fixed camera <-> camera in the hand (from the start screen or the camera wizard) */
  setCameraMode(mode: CameraMode): void {
    if (this.settings.camera.mode === mode) return;
    this.settings.camera.mode = mode;
    // the other kind of camera: let the app choose again (document camera, or the back camera)
    this.settings.camera.deviceId = undefined;
    this.settings.camera.label = undefined;
    this.save();
    this.camera.close();
    if (this.mode.kind !== 'start') {
      this.hud?.setHandheld(this.handheld);
      if (this.handheld) this.probe.stop();
      else this.probe.start();
      this.auto.setEnabled(this.autoAllowed());
    }
  }

  save(): void {
    saveSettings(this.settings);
    setSound(this.settings.game.sound, this.settings.game.volume);
  }

  async openCamera(deviceId?: string): Promise<void> {
    await this.camera.open(deviceId, this.handheld);
    this.settings.camera.deviceId = this.camera.deviceId;
    this.settings.camera.label = this.camera.label;
    this.save();
  }

  private render(): void {
    this.hud?.root.classList.toggle('cinematic', !!this.scene?.cinematic);
    const ctx = this.stage.begin();
    if (this.scene) this.scene.render(ctx, this.stage.worldW);
    else {
      ctx.fillStyle = '#fdf6ff';
      ctx.fillRect(0, 0, this.stage.worldW, 1080);
    }
    this.stage.end();
  }

  // ---------------------------------------------------------------- screens

  showStart(): void {
    this.leaveGame();
    this.mode = { kind: 'start' };
    clear(this.ui);
    renderStart(this.ui, {
      settings: this.settings,
      save: () => this.save(),
      camera: () => ({ ok: this.handheld || this.camera.ready(), label: this.camera.label || this.settings.camera.label || 'Kamera', handheld: this.handheld }),
      setCameraMode: (mode) => {
        this.setCameraMode(mode);
        this.cameraSetup();
      },
      openCamera: () => this.cameraSetup(),
      openSettings: () => this.openSettingsPanel(),
      openPicker: (done) => openTargetPicker(this.settings, () => {
        this.save();
        done();
      }),
      startHabitat: (id) => this.choose(id, () => this.startHabitat(id)),
      openPaint: () => this.choose('malen', () => openPaintLobby(() => this.startPaint(), () => this.cameraSetup())),
      openDuel: () =>
        this.choose('duell', () =>
          openDuelLobby({
            ...this.colorDeps(),
            settings: this.settings,
            start: () => this.startDuel(),
            openCamera: () => this.cameraSetup(),
          }),
        ),
      openSiege: () =>
        this.choose('riesenburg', () =>
          openSiegeLobby(
            this.settings,
            () => this.save(),
            () => this.startSiege(),
            () => this.cameraSetup(),
          ),
        ),
      openTowers: () =>
        this.choose('tuerme', () =>
          openTowerLobby({
            ...this.colorDeps(),
            settings: this.settings,
            start: () => this.startTowers(),
            openCamera: () => this.cameraSetup(),
          }),
        ),
      lastGame: () => (this.settings.game.autosave ? listSaves().then((l) => l.find((m) => m.auto) ?? null) : Promise.resolve(null)),
      resume: (id) => void this.resume(id),
      openSaves: () => this.openSaves(),
    });
  }

  // ---------------------------------------------------------------- saved games

  /** the saved-game mode of what runs now */
  private gameMode(): GameMode | null {
    const m = this.mode;
    if (m.kind === 'habitat') return m.id;
    return m.kind === 'paint' ? 'malen' : m.kind === 'duel' ? 'duell' : m.kind === 'siege' ? 'riesenburg' : m.kind === 'tower' ? 'tuerme' : null;
  }

  /** A mode was chosen: if its last game is unfinished, ask whether to continue it. */
  private choose(mode: GameMode, fresh: () => void): void {
    if (!this.settings.game.autosave) return fresh();
    void getMeta(autoId(mode)).then(
      (m) => {
        if (!m) return fresh();
        openContinue(m, {
          resume: (id) => void this.resume(id),
          fresh,
          keep: async () => {
            const g = await loadSave(m.id);
            if (!g) throw new Error('weg');
            const id = newSaveId();
            await putSave({ ...g, id, auto: false, name: defaultName(mode, new Date(g.savedAt)) });
            await deleteSave(m.id);
            return id;
          },
        });
      },
      () => fresh(),
    );
  }

  /** settings a game depends on (they come back with the game) */
  private configFor(mode: GameMode): Record<string, unknown> {
    const s = this.settings;
    if (mode === 'meer' || mode === 'weltraum' || mode === 'savanne') return { practice: structuredClone(s.practice) };
    if (mode === 'duell') return { duel: structuredClone(s.duel) };
    if (mode === 'riesenburg') return { siege: structuredClone(s.siege) };
    if (mode === 'tuerme') return { tower: structuredClone(s.tower) };
    return {};
  }

  /** small picture of the running game for the list of saved games */
  private thumbnail(): string | undefined {
    try {
      const src = this.stage.canvas;
      const c = document.createElement('canvas');
      c.width = 240;
      c.height = Math.round((240 * src.height) / Math.max(1, src.width));
      c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return undefined;
    }
  }

  /** the running game as a saved game, or null while there is nothing worth keeping */
  private async snapshot(meta: { id: string; name: string; auto: boolean }): Promise<SaveGame | null> {
    const mode = this.gameMode();
    const scene = this.scene;
    if (!mode || !scene?.saveState || this.frozen) return null;
    // everything is taken right now (the scene may be left in a moment), the pictures are encoded after
    const memory = mode === 'malen' ? null : this.vision.getMemory().catch(() => null);
    const thumb = this.thumbnail();
    const config = this.configFor(mode);
    const s = await scene.saveState();
    if (!s) return null;
    const mem = await memory;
    return { format: FORMAT, version: 1, ...meta, mode, savedAt: Date.now(), summary: s.summary, thumb, config, memory: mem ? packTyped(mem) : undefined, state: s.state };
  }

  /** keeps the running game as "the last game" of its mode */
  autosave(): Promise<void> {
    clearTimeout(this.saveSoon);
    const mode = this.gameMode();
    if (!mode || !this.settings.game.autosave) return Promise.resolve();
    const snap = this.snapshot({ id: autoId(mode), name: MODES[mode].title, auto: true });
    // one write at a time, in order
    const run = (this.saving ?? Promise.resolve())
      .then(() => snap)
      .then((g) => (g ? putSave(g) : undefined))
      .catch((e) => console.warn('autosave', e));
    this.saving = run;
    return run;
  }

  private autosaveSoon(): void {
    clearTimeout(this.saveSoon);
    this.saveSoon = window.setTimeout(() => void this.autosave(), AUTOSAVE_AFTER);
  }

  /** a game was won: there is nothing left to continue */
  private forgetGame(): void {
    const mode = this.gameMode();
    clearTimeout(this.saveSoon);
    if (mode) void (this.saving ?? Promise.resolve()).then(() => deleteSave(autoId(mode))).catch(() => undefined);
  }

  /** In the game: save under a name or download as a file. */
  private openSaveGame(): void {
    const mode = this.gameMode();
    if (!mode) return;
    const take = async (name: string) => {
      const g = await this.snapshot({ id: newSaveId(), name, auto: false });
      if (!g) throw new Error('Es gibt noch nichts zu speichern – erst etwas schreiben oder malen.');
      return g;
    };
    openSaveDialog({
      mode,
      defaultName: defaultName(mode),
      save: async (name) => putSave(await take(name)),
      download: async (name) => downloadSave(await take(name)),
    });
  }

  private openSaves(): void {
    openSavesList({
      list: listSaves,
      load: (id) => void this.resume(id),
      download: async (id) => {
        const g = await loadSave(id);
        if (!g) throw new Error('Diesen Spielstand gibt es nicht mehr.');
        downloadSave(g);
      },
      remove: deleteSave,
      open: async (f) => {
        const g = await readSaveFile(f);
        await putSave(g);
        void this.resume(g.id);
      },
    });
  }

  /** Continues a saved game: its settings come back, then the scene is rebuilt. */
  async resume(id: string): Promise<void> {
    const g = await loadSave(id).catch(() => null);
    if (!g) {
      toast('Diesen Spielstand gibt es nicht mehr.', 'warn');
      return;
    }
    const c = g.config as Partial<Settings>;
    if (c.practice) this.settings.practice = { ...this.settings.practice, ...c.practice };
    if (c.duel) this.settings.duel = c.duel;
    if (c.siege) this.settings.siege = c.siege;
    if (c.tower) this.settings.tower = c.tower;
    this.save();
    const m = g.mode;
    // the new scene waits (frozen) until the saved game is inside
    if (m === 'meer' || m === 'weltraum' || m === 'savanne') this.startHabitat(m, true);
    else if (m === 'malen') this.startPaint(true);
    else if (m === 'duell') this.startDuel(true);
    else if (m === 'riesenburg') this.startSiege(true);
    else this.startTowers(true);
    const scene = this.scene;
    try {
      await scene?.restoreState?.(g.state);
      if (g.memory) await this.vision.setMemory(unpackTyped(g.memory) as SavedMemory);
      if (this.scene !== scene) return;
      this.updateProgress();
      if (m !== 'tuerme' && m !== 'riesenburg') toast(`Weiter geht’s: ${g.auto ? MODES[m].title : g.name}`, 'good', 3500);
    } catch (e) {
      toast('Der Spielstand ließ sich nicht ganz laden: ' + (e as Error).message, 'warn', 6000);
    } finally {
      if (this.scene === scene) this.frozen = false;
    }
  }

  /** saving and the photo to tap the team colours in, for the team cards of the lobbies */
  private colorDeps() {
    return {
      save: () => this.save(),
      photo: async () => {
        if (!this.handheld && !this.camera.ready()) {
          toast('Zuerst die Kamera einrichten.', 'warn');
          return null;
        }
        const g = await this.photo(DETECT_SIZE, { title: 'Farbe zeigen', hint: 'Einen Zettel oder ein Wort in der Farbe des Teams ins Bild halten.' });
        return g?.snapshot ?? null;
      },
    };
  }

  private openSettingsPanel(): void {
    const info = this.engineInfo;
    openSettings(
      {
        settings: this.settings,
        save: () => this.save(),
        openCamera: () => this.cameraSetup(),
        replace: (s) => {
          this.settings = s;
          this.save();
          this.showStart();
        },
        modelInfo: info?.hasModel
          ? `Handschrift-Modell geladen${info.accuracy ? ` (erkennt ${Math.round(info.accuracy.group * 100)} % der Test-Zeichen)` : ''}.`
          : 'Handschrift-Modell nicht gefunden – es wird nur mit Vorlagen verglichen.',
      },
      () => {
        if (this.mode.kind === 'start') this.showStart();
        this.auto.setEnabled(this.autoAllowed() && this.mode.kind !== 'start');
      },
    );
  }

  cameraSetup(): void {
    openCameraSetup(
      {
        camera: this.camera,
        settings: this.settings,
        save: () => this.save(),
        reopen: (id) => this.openCamera(id),
        setMode: (mode) => this.setCameraMode(mode),
        camConfig: () => this.camConfig(),
        testScan: async () => {
          const res = await this.scanOnce(true);
          return res?.res ?? null;
        },
      },
      () => {
        // a phone camera is off again until the next photo
        if (this.handheld) this.camera.close();
        if (this.mode.kind === 'start') this.showStart();
      },
    );
  }

  /** resuming: the scene stays frozen until the saved game is loaded into it */
  private enterGame(resuming = false): void {
    unlockAudio();
    this.leaveGame();
    this.frozen = resuming;
    this.saveEvery = window.setInterval(() => void this.autosave(), AUTOSAVE_EVERY);
    if (!this.handheld) this.probe.start();
    clear(this.ui);
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    void this.requestWakeLock();
    void this.vision.reset();
  }

  startHabitat(id: HabitatId, resuming = false): void {
    this.enterGame(resuming);
    this.mode = { kind: 'habitat', id };
    this.settings.game.habitat = id;
    this.save();
    const def = HABITATS[id];
    const practice = this.settings.practice.mode === 'ueben';
    const scene = new HabitatScene(def, this.host(), this.stage.worldW);
    this.scene = scene;
    this.hud = new Hud(this.ui, {
      title: { meer: '🐠 Meer', weltraum: '👽 Weltraum', savanne: '🦒 Savanne' }[id],
      settings: this.settings,
      camera: this.camera,
      handheld: this.handheld,
      practice,
      onScan: () => void this.scan('manual', { now: true }),
      onMenu: () => this.showStart(),
      onNewSheet: () => this.newSheet(),
      onToggleAuto: () => this.toggleAuto(),
      onFullscreen: () => this.toggleFullscreen(),
      onCamera: () => this.cameraSetup(),
      onSave: () => this.openSaveGame(),
      onTemplate: () => {
        if (scene.practiceTarget) scene.showDemo(scene.practiceTarget);
      },
    });
    this.updateProgress();
    this.auto.setEnabled(this.autoAllowed());
    // first show how the practice letter is written
    if (practice) setTimeout(() => this.scene === scene && scene.practiceTarget && scene.showDemo(scene.practiceTarget), 900);
    if (!this.handheld && !this.camera.ready()) toast('Keine Kamera – bitte oben rechts einrichten.', 'warn', 5000);
    else if (!resuming) toast(practice ? this.practiceIntro(scene) : 'Schreib Buchstaben oder Zahlen und drücke „Fertig!“', 'info', 5000);
  }

  private practiceIntro(scene: HabitatScene): string {
    const p = this.settings.practice;
    const first = `${p.count}× ${withArticle(scene.practiceTarget!)}`;
    if (p.targets.length === 1) return `Schreibe ${first} und drücke „Fertig!“`;
    const list = p.targets.slice(0, -1).join(', ') + ' und ' + p.targets[p.targets.length - 1];
    return `Heute üben wir ${list}. Zuerst ${first}!`;
  }

  startPaint(resuming = false): void {
    this.enterGame(resuming);
    this.mode = { kind: 'paint' };
    const scene = new PaintScene(this.host(), this.stage.worldW);
    this.scene = scene;
    this.hud = new Hud(this.ui, {
      title: '🎨 Mal-Aquarium',
      settings: this.settings,
      camera: this.camera,
      handheld: this.handheld,
      practice: false,
      newSheetLabel: '🗒 Neue Karten',
      onScan: () => void this.scan('manual', { now: true }),
      onMenu: () => this.showStart(),
      onNewSheet: () => this.newSheet(),
      onToggleAuto: () => this.toggleAuto(),
      onFullscreen: () => this.toggleFullscreen(),
      onCamera: () => this.cameraSetup(),
      onSave: () => this.openSaveGame(),
    });
    this.updateProgress();
    this.auto.setEnabled(this.autoAllowed());
    if (!this.handheld && !this.camera.ready()) toast('Keine Kamera – bitte oben rechts einrichten.', 'warn', 5000);
    else if (!resuming) toast('Ausgemalte Fisch-Karte unter die Kamera legen und „Fertig!“ drücken!', 'info', 5000);
  }

  startDuel(resuming = false): void {
    this.enterGame(resuming);
    this.mode = { kind: 'duel' };
    const scene = new DuelScene(this.host(), this.stage.worldW);
    this.scene = scene;
    this.hud = new Hud(this.ui, {
      title: '⚔️ Team-Duell',
      settings: this.settings,
      camera: this.camera,
      handheld: this.handheld,
      practice: false,
      teams: this.teamKeys(),
      onTeamScan: (id) => void this.scan('manual', { now: true, team: id }),
      onScan: () => void this.scan('manual', { now: true }),
      onMenu: () => this.showStart(),
      onNewSheet: () => {
        void this.vision.reset();
        toast('Alle Zettel gelten wieder als neu.', 'info');
      },
      onToggleAuto: () => this.toggleAuto(),
      onFullscreen: () => this.toggleFullscreen(),
      onCamera: () => this.cameraSetup(),
      onSave: () => this.openSaveGame(),
    });
    this.hud.setCounter('');
    this.auto.setEnabled(this.autoAllowed());
    if (!resuming) toast('Zettel unter die Kamera legen und „Fertig!“ drücken!', 'info', 4500);
  }

  startSiege(resuming = false): void {
    this.enterGame(resuming);
    this.mode = { kind: 'siege' };
    this.scene = new SiegeScene(this.host(), this.stage.worldW);
    this.hud = new Hud(this.ui, {
      title: '🏰 Riesenburg',
      settings: this.settings,
      camera: this.camera,
      handheld: this.handheld,
      practice: false,
      onScan: () => void this.scan('manual', { now: true }),
      onMenu: () => this.showStart(),
      onNewSheet: () => {
        void this.vision.reset();
        toast('Alles gilt wieder als neu.', 'info');
      },
      onToggleAuto: () => this.toggleAuto(),
      onFullscreen: () => this.toggleFullscreen(),
      onCamera: () => this.cameraSetup(),
      onSave: () => this.openSaveGame(),
    });
    this.hud.setCounter('');
    this.auto.setEnabled(this.autoAllowed());
  }

  startTowers(resuming = false): void {
    this.enterGame(resuming);
    this.mode = { kind: 'tower' };
    this.scene = new TowerScene(this.host(), this.stage.worldW);
    this.hud = new Hud(this.ui, {
      title: '🏗️ Türme bauen',
      settings: this.settings,
      camera: this.camera,
      handheld: this.handheld,
      practice: false,
      teams: this.teamKeys(),
      onTeamScan: (id) => void this.scan('manual', { now: true, team: id }),
      onScan: () => void this.scan('manual', { now: true }),
      onMenu: () => this.showStart(),
      onNewSheet: () => {
        void this.vision.reset();
        toast('Alle Zettel gelten wieder als neu.', 'info');
      },
      onToggleAuto: () => this.toggleAuto(),
      onFullscreen: () => this.toggleFullscreen(),
      onCamera: () => this.cameraSetup(),
      onSave: () => this.openSaveGame(),
    });
    this.hud.setCounter('');
    this.auto.setEnabled(this.autoAllowed());
  }

  private leaveGame(): void {
    // the game is kept before it goes (the scene's lists are read right away)
    if (this.scene) void this.autosave();
    clearInterval(this.saveEvery);
    clearTimeout(this.saveSoon);
    this.frozen = false;
    this.auto.setEnabled(false);
    this.probe.stop();
    this.scene?.destroy();
    this.scene = null;
    this.hud?.destroy();
    this.hud = null;
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  private host(): SceneHost {
    return {
      settings: this.settings,
      toast: (t, k) => toast(t, k),
      showCard: (info) => openGlyphCard(info, DEBUG),
      showPainted: (info) => openPaintedCard(info),
      progress: () => {
        this.updateProgress();
        if (!this.frozen) this.autosaveSoon();
      },
      finished: (r) => {
        this.forgetGame();
        if (this.mode.kind === 'siege') this.siegeFinished(r as SiegeResult);
        else if (this.mode.kind === 'tower') this.towerFinished(r as TowerResult);
        else this.duelFinished(r as DuelResult);
      },
    };
  }

  private updateProgress(): void {
    const scene = this.scene;
    if (!(scene instanceof HabitatScene) || !this.hud) return;
    this.hud.setCounter(scene.count() ? scene.countText() : '');
    const p = this.settings.practice;
    const target = scene.practiceTarget;
    if (!target) return;
    this.hud.setTask(target, scene.practiceDone, p.count, p.targets, scene.practiceIndex);
    if (scene.practiceDone >= p.count && !scene.goalReached) {
      scene.goalReached = true;
      setTimeout(() => this.letterDone(scene), 1800);
    }
  }

  /** one practice letter is done: on to the next one, or celebrate the whole list */
  private letterDone(scene: HabitatScene): void {
    if (this.scene !== scene) return;
    const p = this.settings.practice;
    const done = scene.practiceTarget!;
    sfx.fanfare();
    confetti(['#ffcf3d', '#ff6f91', '#4fb3ff', '#7ccf6b']);
    if (scene.nextTarget()) {
      toast(`Super, ${p.count}× ${withArticle(done)} geschafft! Jetzt kommt ${withArticle(scene.practiceTarget!)}.`, 'good', 5000);
      this.updateProgress();
      setTimeout(() => this.scene === scene && scene.practiceTarget && scene.showDemo(scene.practiceTarget), 1200);
      return;
    }
    const all = p.targets.length > 1;
    const content = h(
      'div',
      { style: 'text-align:center;max-width:620px' },
      h('div', { style: 'font-size:4rem' }, '🎉'),
      h('h2', null, all ? `Super! Alle ${p.targets.length} Buchstaben geschafft!` : `Super! ${p.count}× ${withArticle(done)} geschafft!`),
      all ? h('p', { class: 'practice-done' }, ...p.targets.map((c) => h('span', null, c))) : null,
      h('p', { style: 'font-size:1.2rem' }, all ? 'Nochmal von vorn oder neue Buchstaben aussuchen?' : 'Willst du weiter üben oder einen neuen Buchstaben?'),
      h(
        'div',
        { class: 'actions', style: 'justify-content:center' },
        button(all ? 'Nochmal von vorn' : 'Weiter so', () => {
          scene.restartPractice();
          m.close();
        }, 'btn'),
        button(all ? 'Neue Buchstaben' : 'Neuer Buchstabe', () => {
          m.close();
          openTargetPicker(this.settings, () => {
            this.save();
            scene.restartPractice();
            this.updateProgress();
          });
        }, 'btn primary'),
      ),
    );
    const m = modal(content, () => this.updateProgress());
  }

  private siegeFinished(r: SiegeResult): void {
    this.auto.setEnabled(false);
    openSiegeResult(
      r,
      () => this.startSiege(),
      () => this.showStart(),
    );
  }

  private towerFinished(r: TowerResult): void {
    this.auto.setEnabled(false);
    openTowerResult(
      r,
      () => this.startTowers(),
      () => this.showStart(),
    );
  }

  private duelFinished(r: DuelResult): void {
    this.auto.setEnabled(false);
    openVictory(
      r,
      () => this.startDuel(),
      () => this.showStart(),
    );
  }

  // ---------------------------------------------------------------- scanning

  private visionOptions(forTest = false): VisionOptions {
    const s = this.settings;
    const kind = this.mode.kind;
    // the colours that count: two duel teams or 2–8 towers
    const teams =
      kind === 'duel' ? { by: s.duel.by, list: s.duel.teams } : kind === 'tower' ? { by: s.tower.by, list: s.tower.players.slice(0, s.tower.count) } : null;
    return {
      pen: s.recog.pen,
      ruled: s.recog.lineatur === 'blanko' ? 'off' : 'auto',
      lineatur: LINEATUR[s.recog.lineatur],
      strictness: s.recog.strictness,
      style: s.recog.style,
      noMirror: s.recog.noMirror,
      target: !forTest && this.scene instanceof HabitatScene ? this.scene.practiceTarget : undefined,
      // a surprise letter floating in the scene may be written instead of the practice letter
      bonus: !forTest && s.practice.mode === 'ueben' && this.scene instanceof HabitatScene ? this.scene.bonusLetters() : undefined,
      team: teams
        ? {
            by: teams.by,
            calibs: teams.list.map((t) => ({
              team: t.id,
              absorb: t.penCalib ?? PEN_PRESETS[t.pen]?.absorb ?? PEN_PRESETS.rot.absorb,
              slip: t.slipCalib ?? SLIP_PRESETS[t.slip]?.slip ?? SLIP_PRESETS.gelb.slip,
            })),
          }
        : undefined,
      dedup: kind === 'duel' || kind === 'siege' || kind === 'tower' ? 'slips' : 'sheet',
      debug: DEBUG,
    };
  }

  /** Grabs a frame and runs the recognition. Test scans do not touch the duplicate memory. */
  private async scanOnce(test = false): Promise<{ res: ScanResult; snapshot: HTMLCanvasElement } | null> {
    try {
      await this.visionReady;
    } catch {
      return null;
    }
    const g = await this.camera.grab(this.camConfig());
    const res = await this.vision.scan(g.frame, this.visionOptions(test));
    if (test) await this.vision.reset();
    if (DEBUG) showDebug(res);
    return { res, snapshot: g.snapshot };
  }

  /**
   * Takes a photo and recognises it. `now`: no waiting for calm hands (Enter, the Fertig button, team
   * keys); `team`: every letter of this photo belongs to that team, whatever its colour.
   */
  async scan(trigger: 'manual' | 'auto', opt: { now?: boolean; team?: PlayerId } = {}): Promise<void> {
    if (this.busy || this.frozen || !this.scene || isModalOpen()) return;
    if (trigger === 'auto' && this.handheld) return;
    if (!this.handheld && !this.camera.ready()) {
      toast('Keine Kamera verbunden.', 'warn');
      this.cameraSetup();
      return;
    }
    this.busy = true;
    try {
      if (trigger === 'manual' && !opt.now && !this.handheld) {
        await this.probe.waitStill(1500, () => toast('Hände weg – gleich mache ich ein Foto! 📸', 'info', 2000));
      }
      if (this.scene instanceof PaintScene) {
        await this.scanCards(this.scene);
        return;
      }
      const g = await this.photo(DETECT_SIZE, this.photoText(opt.team));
      if (!g || !this.scene) return;
      // right after the start the handwriting recognition may still be waking up
      this.hud?.setBusy(true, this.engineInfo ? 'Schaue …' : 'Wache auf …');
      await this.visionReady;
      // show the photo right away; the recognition runs meanwhile in the worker
      const s = Math.min(1, DETECT_SIZE / Math.max(g.frame.width, g.frame.height));
      const snap: Snapshot = { canvas: g.snapshot, detW: Math.round(g.frame.width * s), detH: Math.round(g.frame.height * s) };
      this.scene.beginCapture?.(snap);
      let res: ScanResult;
      try {
        res = await this.vision.scan(g.frame, this.visionOptions());
      } catch (e) {
        this.scene?.cancelCapture?.();
        throw e;
      }
      if (DEBUG) showDebug(res);
      if (!this.scene) return;
      snap.detW = res.frameW / res.scale;
      snap.detH = res.frameH / res.scale;
      if (opt.team) for (const g of res.glyphs) g.team = opt.team;
      this.scene.handleScan(res, snap);
      const mirrored = res.glyphs.filter((g) => g.isNew && g.score.rejected).length;
      if (mirrored) {
        toast(
          mirrored === 1
            ? '🪞 Ein Zeichen ist spiegelverkehrt – das zählt nicht. Andersherum schreiben!'
            : `🪞 ${mirrored} Zeichen sind spiegelverkehrt – das zählt nicht. Andersherum schreiben!`,
          'info',
          4500,
        );
      }
      this.auto.markScanned();
    } catch (e) {
      if (e instanceof CameraError) toast(`${e.message} ${e.hint}`, 'warn', 7000);
      else toast('Das hat nicht geklappt: ' + (e as Error).message, 'warn', 6000);
    } finally {
      this.busy = false;
      this.hud?.setBusy(false);
    }
  }

  /** Mal-Aquarium: a sharper photo (the colours become the fish), the worker finds the cards in it. */
  private async scanCards(scene: PaintScene): Promise<void> {
    const g = await this.photo(1920, this.photoText());
    if (!g || this.scene !== scene) return;
    this.hud?.setBusy(true, 'Schaue …');
    const snap: Snapshot = { canvas: g.snapshot, detW: g.frame.width, detH: g.frame.height };
    scene.beginCapture(snap);
    try {
      const res = await this.vision.cards(g.frame);
      if (this.scene !== scene) return;
      snap.detW = res.frameW;
      snap.detH = res.frameH;
      scene.handleCards(res, snap);
      this.auto.markScanned();
    } catch (e) {
      scene.cancelCapture();
      throw e;
    }
  }

  /** Escape (also sent by presenter clickers) asks before leaving, so no aquarium gets lost by accident. */
  private pause(): void {
    const content = h(
      'div',
      { style: 'text-align:center;min-width:min(460px,90vw)' },
      h('h2', null, '⏸ Pause'),
      h(
        'p',
        { style: 'font-size:1.15rem' },
        this.settings.game.autosave
          ? 'Zurück zum Menü? Das Spiel wird gemerkt – ihr könnt es später weiterspielen.'
          : 'Zurück zum Menü? Die Wesen in diesem Spiel verschwinden dann (außer ihr speichert es).',
      ),
      h(
        'div',
        { class: 'actions', style: 'justify-content:center' },
        button('Zum Menü', () => {
          m.close();
          this.showStart();
        }, 'btn'),
        button('💾 Speichern', () => {
          m.close();
          this.openSaveGame();
        }, 'btn'),
        button('Weiterspielen', () => m.close(), 'btn primary'),
      ),
    );
    const m = modal(content);
  }

  private newSheet(): void {
    if (this.scene instanceof PaintScene) {
      this.scene.forgetCards();
      toast('Alle Karten gelten wieder als neu.', 'info');
      return;
    }
    void this.vision.reset();
    toast('Neues Blatt – alles gilt wieder als neu.', 'info');
  }

  private toggleAuto(): void {
    if (this.handheld) {
      toast('Automatisch geht nur mit einer Kamera, die fest steht.', 'info', 3000);
      return;
    }
    this.settings.recog.autoScan = !this.auto.enabled;
    this.save();
    this.auto.setEnabled(this.autoAllowed());
    toast(this.auto.enabled ? 'Automatisch scannen: an 👁' : 'Automatisch scannen: aus', 'info', 2000);
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  private async requestWakeLock(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* not supported */
    }
  }

  /** teams that the number keys (and the team buttons) choose: duel 1–2, towers 1–8 */
  private teamKeys(): { id: PlayerId; name: string; color: string }[] {
    const s = this.settings;
    if (this.mode.kind === 'duel') return s.duel.teams.map((t) => ({ id: t.id, name: t.name, color: teamColor(t, s.duel.by) }));
    if (this.mode.kind === 'tower') return s.tower.players.slice(0, s.tower.count).map((t) => ({ id: t.id, name: t.name, color: teamColor(t, s.tower.by) }));
    return [];
  }

  private onKey(e: KeyboardEvent): void {
    if (isModalOpen() || this.mode.kind === 'start') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const digit = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
    if (digit) {
      const team = this.teamKeys()[digit - 1];
      if (team || this.mode.kind === 'siege') {
        e.preventDefault();
        void this.scan('manual', { now: true, team: team?.id });
      }
      return;
    }
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        void this.scan('manual', { now: true });
        break;
      case ' ':
      case 'PageDown':
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        void this.scan('manual');
        break;
      case 'PageUp':
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'n':
      case 'N':
        this.newSheet();
        break;
      case 'a':
      case 'A':
        this.toggleAuto();
        break;
      case 'f':
      case 'F':
        this.toggleFullscreen();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        this.openSaveGame();
        break;
      case 'Escape':
        this.pause();
        break;
    }
  }
}
