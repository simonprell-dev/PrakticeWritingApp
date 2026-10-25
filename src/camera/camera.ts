// Camera access: device choice (document camera preferred), orientation, region of interest, frame averaging.
import type { Settings } from '../app/settings.ts';
import { DETECT_SIZE } from '../vision/constants.ts';
import type { RGBAImage } from '../vision/types.ts';

const DOC_CAM = /ipevo|elmo|doc|visuali[sz]er|lumens|aver|hovercam|dokument|okiolabs|joyusing|ziggi|vzr|presenter|wolfvision/i;

export class CameraError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.hint = hint;
  }
}

function explain(err: unknown): CameraError {
  const name = (err as DOMException)?.name ?? '';
  if (!window.isSecureContext)
    return new CameraError('Die Kamera funktioniert nur über eine sichere Adresse.', 'Bitte die App über https:// (z. B. die Railway-Adresse) oder http://localhost öffnen.');
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return new CameraError(
      'Der Kamera-Zugriff wurde nicht erlaubt.',
      'Im Browser auf das Schloss neben der Adresse klicken und „Kamera: Zulassen“ wählen. Unter Windows zusätzlich: Einstellungen → Datenschutz → Kamera → Zugriff für Desktop-Apps erlauben.',
    );
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return new CameraError('Keine Kamera gefunden.', 'Ist die Dokumentenkamera per USB angeschlossen und eingeschaltet? Danach „Nochmal versuchen“.');
  if (name === 'NotReadableError' || name === 'AbortError')
    return new CameraError('Die Kamera ist gerade belegt.', 'Ein anderes Programm (Teams, Zoom, Kamera-App, Dokumentenkamera-Software) benutzt sie. Bitte dort schließen und nochmal versuchen.');
  return new CameraError('Die Kamera konnte nicht gestartet werden.', String((err as Error)?.message ?? err));
}

/** Laplacian variance on a sparse grid of the green channel (cheap focus measure). */
function sharpness(d: Uint8ClampedArray, w: number, h: number): number {
  const step = Math.max(2, Math.floor(Math.min(w, h) / 240));
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const g = (xx: number, yy: number) => d[(yy * w + xx) * 4 + 1];
      const l = 4 * g(x, y) - g(x - 1, y) - g(x + 1, y) - g(x, y - 1) - g(x, y + 1);
      s += l;
      s2 += l * l;
      n++;
    }
  }
  return n ? s2 / n - (s / n) ** 2 : 0;
}

export interface Grab {
  frame: RGBAImage;
  /** small copy for the polaroid animation */
  snapshot: HTMLCanvasElement;
}

export class Camera {
  readonly video: HTMLVideoElement;
  stream: MediaStream | null = null;
  deviceId: string | undefined;
  label = '';
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private small = document.createElement('canvas');
  private smallCtx = this.small.getContext('2d', { willReadFrequently: true })!;
  onEnded: (() => void) | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
  }

  static async devices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const list = await navigator.mediaDevices.enumerateDevices();
    return list.filter((d) => d.kind === 'videoinput');
  }

  static isDocCam(label: string): boolean {
    return DOC_CAM.test(label);
  }

  ready(): boolean {
    return !!this.stream && this.video.readyState >= 2 && this.video.videoWidth > 0;
  }

  /**
   * Opens a camera. Without a device: a document camera if there is one, or (handheld) the back camera
   * of the phone or tablet.
   */
  async open(deviceId?: string, handheld = false): Promise<void> {
    this.close();
    if (!navigator.mediaDevices?.getUserMedia) throw explain(new DOMException('', 'NotFoundError'));
    const want = (id?: string): MediaStreamConstraints => ({
      audio: false,
      video: {
        ...(id ? { deviceId: { exact: id } } : handheld ? { facingMode: { ideal: 'environment' } } : {}),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: handheld ? 30 : 15, max: 30 },
      },
    });
    try {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(want(deviceId));
      } catch (e) {
        if (!deviceId) throw e;
        this.stream = await navigator.mediaDevices.getUserMedia(want());
      }
      // without a remembered device: prefer a document camera once labels are known
      if (!deviceId && !handheld) {
        const devs = await Camera.devices();
        const doc = devs.find((d) => Camera.isDocCam(d.label));
        const current = this.stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (doc && doc.deviceId !== current) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = await navigator.mediaDevices.getUserMedia(want(doc.deviceId));
        }
      }
    } catch (e) {
      throw explain(e);
    }
    const track = this.stream.getVideoTracks()[0];
    this.deviceId = track?.getSettings().deviceId;
    this.label = track?.label ?? 'Kamera';
    track?.addEventListener('ended', () => {
      this.stream = null;
      this.onEnded?.();
    });
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => undefined);
    await new Promise<void>((resolve) => {
      if (this.video.readyState >= 2) resolve();
      else this.video.addEventListener('loadeddata', () => resolve(), { once: true });
      setTimeout(resolve, 4000);
    });
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  /** Oriented size (after rotation). */
  size(rotation: number): { w: number; h: number } {
    const vw = this.video.videoWidth || 1280;
    const vh = this.video.videoHeight || 720;
    return rotation === 90 || rotation === 270 ? { w: vh, h: vw } : { w: vw, h: vh };
  }

  /** Draws the oriented full frame into the internal canvas. */
  private drawOriented(cam: Settings['camera']): { w: number; h: number } {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    const { w, h } = this.size(cam.rotation);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(w / 2, h / 2);
    if (cam.mirror) c.scale(-1, 1);
    c.rotate((cam.rotation * Math.PI) / 180);
    c.drawImage(this.video, -vw / 2, -vh / 2, vw, vh);
    c.setTransform(1, 0, 0, 1, 0, 0);
    return { w, h };
  }

  /** Draws the oriented frame (no ROI) scaled into a preview canvas, keeping the aspect ratio. */
  preview(target: HTMLCanvasElement, cam: Settings['camera'], maxW: number): boolean {
    if (!this.ready()) return false;
    const { w, h } = this.drawOriented(cam);
    const s = maxW / w;
    const tw = Math.round(w * s);
    const th = Math.round(h * s);
    if (target.width !== tw || target.height !== th) {
      target.width = tw;
      target.height = th;
    }
    target.getContext('2d')!.drawImage(this.canvas, 0, 0, tw, th);
    return true;
  }

  roiPx(cam: Settings['camera']): { x: number; y: number; w: number; h: number } {
    const { w, h } = this.size(cam.rotation);
    const r = cam.roi ?? { x: 0, y: 0, w: 1, h: 1 };
    const x = Math.round(Math.max(0, r.x) * w);
    const y = Math.round(Math.max(0, r.y) * h);
    return { x, y, w: Math.max(32, Math.round(Math.min(1, r.w) * w)), h: Math.max(32, Math.round(Math.min(1, r.h) * h)) };
  }

  /** Waits for the next video frame (falls back to a short timeout). */
  private nextFrame(): Promise<void> {
    const v = this.video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 70);
      v.requestVideoFrameCallback?.(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** the torch (lamp) of a phone camera, if it has one */
  hasTorch(): boolean {
    const t = this.stream?.getVideoTracks()[0];
    return !!(t?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch;
  }

  async setTorch(on: boolean): Promise<void> {
    const t = this.stream?.getVideoTracks()[0];
    await t?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => undefined);
  }

  /**
   * Captures `frames` consecutive frames and averages the sharp ones (less noise, steadier pencil strokes).
   * `sharpest`: a camera in the hand moves, so only the single sharpest frame is used.
   */
  async grab(cam: Settings['camera'], frames = 2, maxSide = DETECT_SIZE, sharpest = false): Promise<Grab> {
    if (!this.ready()) throw new CameraError('Die Kamera ist noch nicht bereit.', 'Einen Moment warten oder die Kamera neu verbinden.');
    const roi = this.roiPx(cam);
    // the graphics card scales straight to detection size (the recognition does not need more)
    const s = Math.min(1, maxSide / Math.max(roi.w, roi.h));
    const ow = Math.max(1, Math.round(roi.w * s));
    const oh = Math.max(1, Math.round(roi.h * s));
    if (this.small.width !== ow || this.small.height !== oh) {
      this.small.width = ow;
      this.small.height = oh;
    }
    const sctx = this.smallCtx;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    const shots: { data: Uint8ClampedArray; sharp: number }[] = [];
    for (let k = 0; k < frames; k++) {
      if (k) await this.nextFrame();
      this.drawOriented(cam);
      sctx.drawImage(this.canvas, roi.x, roi.y, roi.w, roi.h, 0, 0, ow, oh);
      const id = sctx.getImageData(0, 0, ow, oh);
      shots.push({ data: id.data, sharp: sharpness(id.data, ow, oh) });
    }
    // a refocusing camera delivers blurry frames: only average the sharp ones
    const best = Math.max(...shots.map((x) => x.sharp));
    const use = sharpest ? [shots.find((x) => x.sharp === best)!] : shots.filter((x) => x.sharp >= best * 0.7);
    let out: Uint8ClampedArray;
    if (use.length === 1) out = use[0].data;
    else {
      const acc = new Uint16Array(use[0].data.length);
      for (const x of use) for (let i = 0; i < acc.length; i++) acc[i] += x.data[i];
      out = new Uint8ClampedArray(acc.length);
      for (let i = 0; i < out.length; i++) out[i] = acc[i] / use.length;
    }
    const frame: RGBAImage = { width: ow, height: oh, data: out };
    const snapshot = document.createElement('canvas');
    const ss = Math.min(1, 720 / Math.max(ow, oh));
    snapshot.width = Math.round(ow * ss);
    snapshot.height = Math.round(oh * ss);
    snapshot.getContext('2d')!.drawImage(this.small, 0, 0, snapshot.width, snapshot.height);
    return { frame, snapshot };
  }

  /** Small grey frame of the raw video for motion detection (orientation does not matter there). */
  probe(_cam: Settings['camera'], ctx: CanvasRenderingContext2D, w: number, h: number): ImageData | null {
    if (!this.ready()) return null;
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // orientation is irrelevant for motion, the ROI is approximated on the raw frame
    ctx.drawImage(this.video, 0, 0, vw, vh, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }
}
