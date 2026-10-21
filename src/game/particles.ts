// Simple pooled particles in world coordinates.
import { bubbleSprite } from './creatures/bubble.ts';
import { sparkleStar } from './creatures/parts.ts';
import { TAU } from './math.ts';

export type ParticleKind = 'bubble' | 'spark' | 'puff' | 'drop' | 'confetti' | 'ring' | 'text' | 'heart';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  gravity: number;
  text?: string;
}

const MAX = 600;

export class Particles {
  list: Particle[] = [];

  add(p: Partial<Particle> & { kind: ParticleKind; x: number; y: number }): void {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      vx: 0,
      vy: 0,
      life: 0,
      max: 1,
      size: 10,
      color: '#fff',
      rot: 0,
      vr: 0,
      gravity: 0,
      ...p,
    });
  }

  burst(kind: ParticleKind, x: number, y: number, n: number, opts: Partial<Particle> & { speed?: number; colors?: string[] } = {}): void {
    const sp = opts.speed ?? 200;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = sp * (0.4 + Math.random() * 0.6);
      this.add({
        ...opts,
        kind,
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 8,
        color: opts.colors ? opts.colors[i % opts.colors.length] : (opts.color ?? '#fff'),
        size: (opts.size ?? 10) * (0.6 + Math.random() * 0.8),
        max: (opts.max ?? 1) * (0.7 + Math.random() * 0.6),
      });
    }
  }

  update(dt: number): void {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life += dt;
      if (p.life >= p.max) {
        l.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.kind === 'bubble') p.vx += Math.sin(p.life * 5 + p.rot) * 30 * dt;
      if (p.kind === 'confetti') {
        p.vx *= 0.99;
        p.vy = Math.min(p.vy, 260);
      }
      if (p.kind === 'puff') {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const t = p.life / p.max;
      const a = p.kind === 'text' ? Math.min(1, (1 - t) * 3) : 1 - t;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      switch (p.kind) {
        case 'bubble': {
          const s = bubbleSprite(Math.max(3, Math.round(p.size)), p.rot * 30);
          ctx.globalAlpha = Math.min(1, (1 - t) * 4) * 0.9;
          ctx.drawImage(s as CanvasImageSource, p.x - s.width / 2, p.y - s.height / 2);
          break;
        }
        case 'spark':
          sparkleStar(ctx, p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(t * Math.PI)), p.color);
          break;
        case 'puff':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.6 + t), 0, TAU);
          ctx.fill();
          break;
        case 'drop':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, TAU);
          ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 4 * (1 - t));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + t), 0, TAU);
          ctx.stroke();
          break;
        case 'confetti':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.abs(Math.cos(p.life * 6 + p.rot)));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        case 'heart':
          ctx.translate(p.x, p.y);
          ctx.scale(p.size / 20, p.size / 20);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, 6);
          ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8);
          ctx.bezierCurveTo(8, -16, 14, -4, 0, 6);
          ctx.fill();
          break;
        case 'text':
          ctx.font = `700 ${p.size}px Fredoka, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = Math.max(3, p.size / 7);
          ctx.strokeStyle = 'rgba(40,20,60,0.85)';
          ctx.lineJoin = 'round';
          ctx.strokeText(p.text ?? '', p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? '', p.x, p.y);
          break;
      }
      ctx.restore();
    }
  }
}
