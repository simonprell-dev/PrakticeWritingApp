// Wires camera -> vision worker -> scenes and owns the screens (start, game, duel).
import { Camera, CameraError } from '../camera/camera.ts';
import { AutoScan, MotionProbe } from '../camera/motion.ts';
import { setSound, sfx, unlockAudio } from '../game/audio.ts';
import { Loop } from '../game/loop.ts';
import { Stage } from '../game/stage.ts';
import { withArticle } from '../recog/classes.ts';
import type { EngineInfo } from '../recog/engine.ts';
import { createVision, type VisionClient } from '../recog/workerClient.ts';
import { aquarium } from '../scenes/aquarium.ts';
import { DuelScene, type DuelResult } from '../scenes/duelScene.ts';
import { HabitatScene, type HabitatDef } from '../scenes/habitat.ts';
import { savanna } from '../scenes/savanna.ts';
import type { Scene, SceneHost } from '../scenes/scene.ts';
import { space } from '../scenes/space.ts';
import { openCameraSetup } from '../ui/cameraSetup.ts';
import { showDebug } from '../ui/debugView.ts';
import { button, clear, h, isModalOpen, modal } from '../ui/dom.ts';
import { openDuelLobby } from '../ui/duelLobby.ts';
import { openGlyphCard } from '../ui/glyphCard.ts';
import { LEGAL_PATHS, openLegal } from '../ui/legal.ts';
import { Hud } from '../ui/hud.ts';
import { openSettings } from '../ui/settingsPanel.ts';
import { renderStart } from '../ui/startScreen.ts';
import { openTargetPicker } from '../ui/targetPicker.ts';
import { toast } from '../ui/toast.ts';
import { confetti, openVictory } from '../ui/victoryScreen.ts';
import { PEN_PRESETS, SLIP_PRESETS } from '../vision/color.ts';
import type { ScanResult, VisionOptions } from '../vision/types.ts';
import { loadSettings, saveSettings, type HabitatId, type Settings } from './settings.ts';

const HABITATS: Record<HabitatId, HabitatDef> = { meer: aquarium, weltraum: space, savanne: savanna };
const DEBUG = new URLSearchParams(location.search).has('debug');

type Mode = { kind: 'start' } | { kind: 'habitat'; id: HabitatId } | { kind: 'duel' };

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

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ui = ui;
    this.stage = new Stage(canvas);
    this.stage.onResize(() => this.scene?.resize(this.stage.worldW));
    this.loop = new Loop(
      (dt) => this.scene?.update(dt),
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
      () => this.busy || isModalOpen() || this.mode.kind === 'start',
      () => this.scan('auto'),
    );
    this.auto.onChange = () => this.hud?.setAuto(this.auto.enabled, this.auto.progress);
    this.camera.onEnded = () => toast('Die Kamera wurde getrennt. Bitte wieder anschließen.', 'warn', 6000);
    setSound(this.settings.game.sound, this.settings.game.volume);

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.scene) return;
      const p = this.stage.toWorld(e.clientX, e.clientY);
      this.scene.tap(p.x, p.y);
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.mode.kind !== 'start') void this.requestWakeLock();
    });
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
      if (!this.camera.ready() && this.settings.camera.deviceId) void this.openCamera(this.settings.camera.deviceId).catch(() => undefined);
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
    try {
      await this.openCamera(this.settings.camera.deviceId);
    } catch {
      /* the start screen shows the camera status */
    }
    if (this.mode.kind === 'start') this.showStart();
  }

  save(): void {
    saveSettings(this.settings);
    setSound(this.settings.game.sound, this.settings.game.volume);
  }

  async openCamera(deviceId?: string): Promise<void> {
    await this.camera.open(deviceId);
    this.settings.camera.deviceId = this.camera.deviceId;
    this.settings.camera.label = this.camera.label;
    this.save();
  }

  private render(): void {
    const ctx = this.stage.begin();
    if (this.scene) this.scene.render(ctx, this.stage.worldW);
    else {
      ctx.fillStyle = '#fdf6ff';
      ctx.fillRect(0, 0, this.stage.worldW, 1080);
    }
  }

  // ---------------------------------------------------------------- screens

  showStart(): void {
    this.leaveGame();
    this.mode = { kind: 'start' };
    clear(this.ui);
    renderStart(this.ui, {
      settings: this.settings,
      save: () => this.save(),
      camera: () => ({ ok: this.camera.ready(), label: this.camera.label || this.settings.camera.label || 'Kamera' }),
      openCamera: () => this.cameraSetup(),
      openSettings: () => this.openSettingsPanel(),
      openPicker: (done) => openTargetPicker(this.settings, () => {
        this.save();
        done();
      }),
      startHabitat: (id) => this.startHabitat(id),
      openDuel: () =>
        openDuelLobby({
          settings: this.settings,
          save: () => this.save(),
          calibratePen: async () => {
            const f = await this.calibrationFrame();
            return f ? this.vision.calibrate(f, 'pen') : null;
          },
          calibrateSlip: async () => {
            const f = await this.calibrationFrame();
            return f ? this.vision.calibrate(f, 'slip') : null;
          },
          start: () => this.startDuel(),
          openCamera: () => this.cameraSetup(),
        }),
    });
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
        this.auto.setEnabled(this.settings.recog.autoScan && this.mode.kind !== 'start');
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
        testScan: async () => {
          const res = await this.scanOnce(true);
          return res?.res ?? null;
        },
      },
      () => {
        if (this.mode.kind === 'start') this.showStart();
      },
    );
  }

  private enterGame(): void {
    unlockAudio();
    clear(this.ui);
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    void this.requestWakeLock();
    void this.vision.reset();
  }

  startHabitat(id: HabitatId): void {
    this.enterGame();
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
      practice,
      onScan: () => void this.scan('manual'),
      onMenu: () => this.showStart(),
      onNewSheet: () => this.newSheet(),
      onToggleAuto: () => this.toggleAuto(),
      onFullscreen: () => this.toggleFullscreen(),
      onCamera: () => this.cameraSetup(),
    });
    this.updateProgress();
    this.auto.setEnabled(this.settings.recog.autoScan);
    if (!this.camera.ready()) toast('Keine Kamera – bitte oben rechts einrichten.', 'warn', 5000);
    else
      toast(
        practice ? `Schreibe ${this.settings.practice.count}× ${withArticle(this.settings.practice.target)} und drücke „Fertig!“` : 'Schreib Buchstaben oder Zahlen und drücke „Fertig!“',
        'info',
        4500,
      );
  }

  startDuel(): void {
    this.enterGame();
    this.mode = { kind: 'duel' };
    const scene = new DuelScene(this.host(), this.stage.worldW);
    this.scene = scene;
    this.hud = new Hud(this.ui, {
      title: '⚔️ Team-Duell',
      settings: this.settings,
      camera: this.camera,
      practice: false,
      onScan: () => void this.scan('manual'),
      onMenu: () => this.showStart(),
      onNewSheet: () => {
        void this.vision.reset();
        toast('Alle Zettel gelten wieder als neu.', 'info');
      },
      onToggleAuto: () => this.toggleAuto(),
      onFullscreen: () => this.toggleFullscreen(),
      onCamera: () => this.cameraSetup(),
    });
    this.hud.setCounter('');
    this.auto.setEnabled(this.settings.recog.autoScan);
    toast('Zettel unter die Kamera legen und „Fertig!“ drücken!', 'info', 4500);
  }

  private leaveGame(): void {
    this.auto.setEnabled(false);
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
      progress: () => this.updateProgress(),
      finished: (r) => this.duelFinished(r as DuelResult),
    };
  }

  private updateProgress(): void {
    const scene = this.scene;
    if (!(scene instanceof HabitatScene) || !this.hud) return;
    const n = scene.count();
    this.hud.setCounter(n ? `${n} ${n === 1 ? scene.def.word[0] : scene.def.word[1]}` : '');
    const p = this.settings.practice;
    if (p.mode !== 'ueben') return;
    this.hud.setTask(p.target, scene.practiceDone, p.count);
    if (scene.practiceDone >= p.count && !scene.goalReached) {
      scene.goalReached = true;
      setTimeout(() => this.goalReached(scene), 1800);
    }
  }

  private goalReached(scene: HabitatScene): void {
    if (this.scene !== scene) return;
    const p = this.settings.practice;
    sfx.fanfare();
    confetti(['#ffcf3d', '#ff6f91', '#4fb3ff', '#7ccf6b']);
    const content = h(
      'div',
      { style: 'text-align:center;max-width:620px' },
      h('div', { style: 'font-size:4rem' }, '🎉'),
      h('h2', null, `Super! ${p.count}× ${withArticle(p.target)} geschafft!`),
      h('p', { style: 'font-size:1.2rem' }, 'Willst du weiter üben oder einen neuen Buchstaben?'),
      h(
        'div',
        { class: 'actions', style: 'justify-content:center' },
        button('Weiter so', () => {
          scene.practiceDone = 0;
          scene.goalReached = false;
          m.close();
        }, 'btn'),
        button('Neuer Buchstabe', () => {
          m.close();
          openTargetPicker(this.settings, () => {
            this.save();
            scene.practiceDone = 0;
            scene.goalReached = false;
            this.updateProgress();
          });
        }, 'btn primary'),
      ),
    );
    const m = modal(content, () => this.updateProgress());
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
    const duel = this.mode.kind === 'duel';
    return {
      pen: s.recog.pen,
      ruled: s.recog.ruled,
      strictness: s.recog.strictness,
      style: s.recog.style,
      target: !duel && !forTest && s.practice.mode === 'ueben' && this.mode.kind === 'habitat' ? s.practice.target : undefined,
      team: duel
        ? {
            by: s.duel.by,
            calibs: s.duel.teams.map((t) => ({
              team: t.id,
              absorb: t.penCalib ?? PEN_PRESETS[t.pen]?.absorb ?? PEN_PRESETS.rot.absorb,
              slip: t.slipCalib ?? SLIP_PRESETS[t.slip]?.slip ?? SLIP_PRESETS.gelb.slip,
            })),
          }
        : undefined,
      dedup: duel ? 'slips' : 'sheet',
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
    const g = await this.camera.grab(this.settings.camera);
    const res = await this.vision.scan(g.frame, this.visionOptions(test));
    if (test) await this.vision.reset();
    if (DEBUG) showDebug(res);
    return { res, snapshot: g.snapshot };
  }

  async scan(trigger: 'manual' | 'auto'): Promise<void> {
    if (this.busy || !this.scene || isModalOpen()) return;
    if (!this.camera.ready()) {
      toast('Keine Kamera verbunden.', 'warn');
      this.cameraSetup();
      return;
    }
    this.busy = true;
    this.hud?.setBusy(true);
    try {
      if (trigger === 'manual') {
        await this.probe.waitStill(2500, () => toast('Hände weg – gleich mache ich ein Foto! 📸', 'info', 2000));
      }
      const out = await this.scanOnce();
      if (!out || !this.scene) return;
      const { res, snapshot } = out;
      const detW = res.frameW / res.scale;
      const detH = res.frameH / res.scale;
      this.scene.handleScan(res, { canvas: snapshot, detW, detH });
      this.auto.markScanned();
    } catch (e) {
      if (e instanceof CameraError) toast(`${e.message} ${e.hint}`, 'warn', 7000);
      else toast('Das hat nicht geklappt: ' + (e as Error).message, 'warn', 6000);
    } finally {
      this.busy = false;
      this.hud?.setBusy(false);
    }
  }

  private async calibrationFrame() {
    if (!this.camera.ready()) {
      toast('Zuerst die Kamera einrichten.', 'warn');
      return null;
    }
    await this.visionReady;
    return (await this.camera.grab(this.settings.camera, 2)).frame;
  }

  /** Escape (also sent by presenter clickers) asks before leaving, so no aquarium gets lost by accident. */
  private pause(): void {
    const content = h(
      'div',
      { style: 'text-align:center;min-width:min(460px,90vw)' },
      h('h2', null, '⏸ Pause'),
      h('p', { style: 'font-size:1.15rem' }, 'Zurück zum Menü? Die Wesen in diesem Spiel verschwinden dann.'),
      h(
        'div',
        { class: 'actions', style: 'justify-content:center' },
        button('Zum Menü', () => {
          m.close();
          this.showStart();
        }, 'btn'),
        button('Weiterspielen', () => m.close(), 'btn primary'),
      ),
    );
    const m = modal(content);
  }

  private newSheet(): void {
    void this.vision.reset();
    toast('Neues Blatt – alles gilt wieder als neu.', 'info');
  }

  private toggleAuto(): void {
    this.settings.recog.autoScan = !this.auto.enabled;
    this.save();
    this.auto.setEnabled(this.settings.recog.autoScan);
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

  private onKey(e: KeyboardEvent): void {
    if (isModalOpen() || this.mode.kind === 'start') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    switch (e.key) {
      case ' ':
      case 'Enter':
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
      case 'Escape':
        this.pause();
        break;
    }
  }
}
