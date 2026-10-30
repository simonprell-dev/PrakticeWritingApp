// "Mal-Aquarium": no letters here. Children colour in an animal on a printed card, the camera finds the card,
// and the animal moves into the aquarium in the child's colours (with its handwritten name, if there is one).
import { dataURLToRGBA, encodeOnce, rememberEncoded, rgbaToDataURL } from '../app/imageCodec.ts';
import { sfx } from '../game/audio.ts';
import { makeGenome } from '../game/creatures/genome.ts';
import { animalPicture, nameCrop, paintedSprite } from '../game/creatures/paintedAnimal.ts';
import type { Sprite } from '../game/creatures/sprite.ts';
import { lerp } from '../game/math.ts';
import { behavePainted, OWN_STEERING } from '../game/paint/motion.ts';
import { SPECIES, type SpeciesId } from '../game/paint/species.ts';
import { hashBytes } from '../game/rng.ts';
import type { FxItem } from '../game/spawnFx.ts';
import { WORLD_H } from '../game/stage.ts';
import { tierOf } from '../recog/score.ts';
import { thumbDistance, type CardScan } from '../vision/cards.ts';
import type { RGBAImage } from '../vision/types.ts';
import { aquarium, sandLine } from './aquarium.ts';
import { HabitatScene, type Creature, type PaintedSkin } from './habitat.ts';
import type { SceneSave } from './saved.ts';
import type { SceneHost, Snapshot } from './scene.ts';

/** a card seen before: it does not hatch a second animal */
export interface KnownCard {
  thumb: number[];
  /** the animal on it: cards of different animals are never the same card */
  species: SpeciesId;
  /** where it lay in the photo (frame px) */
  cx: number;
  cy: number;
  size: number;
  /** creature id of its animal (0 = none in this session) */
  fish: number;
  /** number of the scan it was last seen in */
  seen: number;
}

/** the Mal-Aquarium in a saved game: the coloured cards (JPEG data URLs) */
export interface PaintSave {
  /** all animals (the name is from the time when there were only fish); no species = fisch */
  fish: { image: string; thumb: number[]; k: number; x: number; y: number; facing: 1 | -1; species?: SpeciesId }[];
  /** thumbnails of all cards seen, so they do not hatch again */
  known: number[][];
  /** the animal of each of them, parallel to `known` (same length and order; missing in old saves: fisch) */
  knownSpecies?: SpeciesId[];
  away: number;
}

const UNSURE = 'Diese Karte erkenne ich nicht sicher – bitte flach und ganz ins Bild legen';

/** a species from a saved game; old saves (and unknown animals) are the fish */
const savedSpecies = (sp: unknown): SpeciesId => (typeof sp === 'string' && Object.hasOwn(SPECIES, sp) ? (sp as SpeciesId) : 'fisch');

/** "Ein neuer Hai!", "Eine neue Qualle!", "3 neue Tiere!" */
function newText(n: number, sp: SpeciesId): string {
  if (n > 1) return `${n} neue Tiere!`;
  if (sp === 'freiform') return 'Ein neues Tier!';
  const { article, name } = SPECIES[sp];
  return `${article === 'der' ? 'Ein neuer' : article === 'die' ? 'Eine neue' : 'Ein neues'} ${name}!`;
}

/** colour thumbnails closer than this are the same card */
const SAME = 0.05;
/** the same card coloured in some more, lying where it lay in the scan before */
const RECOLOURED = 0.22;
/** a card with less of the animal coloured in is still blank */
const BLANK = 0.04;

export class PaintScene extends HabitatScene {
  known: KnownCard[] = [];
  private scans = 0;

  constructor(host: SceneHost, worldW: number) {
    super(aquarium, host, worldW);
    this.letters = false;
  }

  /** the skin and sprite of a coloured card; k = size (sprite px per animal unit), by default a bit random and as big as the animal is */
  makeSkin(image: RGBAImage, thumb: number[], k?: number, sp: SpeciesId = 'fisch', mask?: Uint8Array): { skin: PaintedSkin; sprite: Sprite } {
    const kk = k ?? 2.5 * (0.9 + Math.random() * 0.22) * SPECIES[sp].size;
    // the free-form animal is cut out along the mask the worker made (a saved one makes it once, here)
    const sprite = paintedSprite(sp, image, kk, undefined, mask);
    return { skin: { species: sp, image, thumb, name: nameCrop(image, sp), picture: animalPicture(sprite, 150), k: kk }, sprite };
  }

  handleCards(res: CardScan, snap: Snapshot): void {
    this.scans++;
    const B = this.bounds;
    const items: FxItem[] = [];
    let hatched = 0;
    let hatchedAs: SpeciesId = 'fisch';
    let recoloured = 0;
    let again = 0;
    let blank = 0;
    for (const card of res.cards) {
      const xs = card.quad.map((p) => p[0]);
      const ys = card.quad.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const size = Math.max(box.w, box.h);
      if (card.colored < BLANK) {
        blank++;
        items.push({ box, isNew: false });
        continue;
      }
      const same = this.known.find((k) => k.species === card.species && thumbDistance(k.thumb, card.thumb) < SAME);
      if (same) {
        Object.assign(same, { cx, cy, size, seen: this.scans });
        again++;
        items.push({ box, isNew: false });
        continue;
      }
      // coloured in some more and shown again: the animal gets its new colours
      const before = this.known.find(
        (k) => k.species === card.species && k.seen === this.scans - 1 && Math.hypot(k.cx - cx, k.cy - cy) < 0.3 * size && thumbDistance(k.thumb, card.thumb) < RECOLOURED,
      );
      const fish = before ? this.creatures.find((c) => c.id === before.fish && !c.leaving && c.painted) : undefined;
      if (before && fish) {
        Object.assign(before, { thumb: card.thumb, cx, cy, size, seen: this.scans });
        recoloured++;
        const { skin, sprite } = this.makeSkin(card.image, card.thumb, fish.painted!.k, card.species, card.mask);
        items.push({ box, isNew: true, fly: { sticker: skin.picture, to: { x: fish.x, y: fish.y }, onLand: () => this.recolour(fish, skin, sprite) } });
        continue;
      }
      hatched++;
      hatchedAs = card.species;
      const entry: KnownCard = { thumb: card.thumb, species: card.species, cx, cy, size, fish: 0, seen: this.scans };
      this.known.push(entry);
      const { skin, sprite } = this.makeSkin(card.image, card.thumb, undefined, card.species, card.mask);
      const to = { x: lerp(B.x0 + 160, B.x1 - 160, Math.random()), y: lerp(B.y0 + 80, B.y1 - 80, Math.random()) };
      items.push({
        box,
        isNew: true,
        fly: {
          sticker: skin.picture,
          to,
          onLand: () => {
            entry.fish = this.addPainted(skin, sprite, to.x, to.y, true).id;
          },
        },
      });
    }
    const parts = [
      hatched ? newText(hatched, hatchedAs) : '',
      recoloured ? 'Neue Farben!' : '',
      again ? `${again} kenne ich schon` : '',
      blank ? `${blank} noch nicht ausgemalt` : '',
    ].filter(Boolean);
    // a card that was there but not clear is no „Keine Karte“
    const nothing = res.unsure > 0 ? 'Karte nicht erkannt' : 'Keine Karte gefunden';
    this.fx.show(snap, this.W, parts.length ? parts.join(' · ') : nothing, items);
    // one toast per scan at most: a card that was not clear matters most (it did not hatch)
    if (res.unsure > 0) this.host.toast(UNSURE, 'warn');
    else if (!res.cards.length) this.host.toast('Ich sehe keine Karte. Liegt sie ganz im Bild, mit dem schwarzen Rahmen?', 'warn');
    else if (!hatched && !recoloured && blank && !again) this.host.toast('Dieses Tier ist noch ganz weiß – erst bunt ausmalen!', 'info');
    else if (!hatched && !recoloured && again) this.host.toast('Dieses Tier kenne ich schon! Leg eine neue Karte unter die Kamera.', 'info');
    if (this.known.length > 300) this.known.splice(0, this.known.length - 300);
  }

  /** a painted animal comes in; `hello` = it was just scanned (greets with its name) */
  addPainted(skin: PaintedSkin, sprite: Sprite, x: number, y: number, hello: boolean): Creature {
    const seed = hashBytes(skin.image.data, 997);
    // every animal gets its own temper: some are faster, some do loops
    const score = 62 + (seed % 33);
    const genome = makeGenome(score, tierOf(score), seed, 'fish');
    genome.sparkle = false;
    genome.wobble = 0.1;
    const c = this.place({ painted: skin, genome, sprite }, x, y);
    if (hello) {
      sfx.hatch(85);
      this.particles.burst('puff', x, y, 12, { color: 'rgba(255,255,255,0.85)', size: 30, speed: 180, max: 0.6 });
      this.particles.burst('spark', x, y, 12, { color: '#fff6a8', size: 14, speed: 280, max: 0.9 });
      c.bubble = skin.name ? { text: 'Hallo, ich bin', t: 0, good: true, image: skin.name } : { text: 'Hallo! Blubb blubb!', t: 0, good: true };
      this.host.progress();
    }
    return c;
  }

  private recolour(c: Creature, skin: PaintedSkin, sprite: Sprite): void {
    if (!this.creatures.includes(c)) return;
    c.painted = skin;
    c.sprite = sprite;
    c.special = 1;
    sfx.sparkle();
    this.particles.burst('spark', c.x, c.y, 16, { colors: ['#fff6a8', '#ff9fd0', '#9fe8ff'], size: 14, speed: 260, max: 1 });
    c.bubble = { text: 'Juhu, neue Farben!', t: 0, good: true };
  }

  protected showCreature(c: Creature): void {
    const p = c.painted;
    if (!p) return super.showCreature(c);
    this.host.showPainted?.({
      picture: animalPicture(c.sprite, 460),
      name: p.name,
      release: () => {
        c.leaving = true;
        c.bubble = { text: 'Tschüss!', t: 0, good: true };
        this.host.progress();
      },
    });
  }

  async saveState(): Promise<SceneSave | null> {
    const living = this.creatures.filter((c) => !c.leaving && c.painted);
    const away = this.album.length + this.awayBefore;
    if (!living.length && !away) return null;
    const summary = this.countText();
    const known = this.known.map((k) => k.thumb);
    const knownSpecies = this.known.map((k) => k.species);
    const fish = await Promise.all(
      living.map(async (c) => {
        const p = c.painted!;
        const image = await encodeOnce(p.image, () => rgbaToDataURL(p.image, 'image/jpeg', 0.86));
        return { image, thumb: p.thumb, k: p.k, x: Math.round(c.x), y: Math.round(c.y), facing: c.facing, species: p.species };
      }),
    );
    const state: PaintSave = { fish, known, knownSpecies, away };
    return { state, summary };
  }

  async restoreState(raw: unknown): Promise<void> {
    const s = raw as PaintSave;
    const images = await Promise.all(s.fish.map((f) => dataURLToRGBA(f.image)));
    s.fish.forEach((f, i) => {
      rememberEncoded(images[i], f.image);
      const { skin, sprite } = this.makeSkin(images[i], f.thumb, f.k, savedSpecies(f.species));
      this.settle(this.addPainted(skin, sprite, f.x, f.y, false), f);
    });
    this.known = s.known.map((thumb, i) => ({ thumb, species: savedSpecies(s.knownSpecies?.[i]), cx: -1e9, cy: -1e9, size: 0, fish: 0, seen: -10 }));
    this.awayBefore = s.away;
  }

  /** "12 Tiere" (there are not only fish) */
  countText(): string {
    const n = this.count();
    return `${n} ${n === 1 ? 'Tier' : 'Tiere'}`;
  }

  /** the crab walks, the pike darts, the jellyfish pulses …; the fish swim the aquarium's way */
  protected behave(c: Creature, dt: number): void {
    const m = c.sprite.motion;
    if (c.painted && m && OWN_STEERING.has(m)) behavePainted(m, c, dt, this.bounds, sandLine(WORLD_H));
    else super.behave(c, dt);
  }

  update(dt: number): void {
    super.update(dt);
    // a few animals are big, a whole class of animals a bit smaller, so everybody still finds their own
    const n = this.creatures.filter((c) => !c.leaving).length;
    const size = n <= 6 ? 1.12 : n >= 26 ? 0.78 : lerp(1.12, 0.78, (n - 6) / 20);
    for (const c of this.creatures) c.depth = lerp(c.depth, size, Math.min(1, dt * 1.5));
  }

  /** "Neues Blatt": all cards count as new again */
  forgetCards(): void {
    this.known = [];
  }
}
