// Zauberland castle: 18 places on a grid, built in a fixed order so the castle looks tidy at every stage.
// Rooms stand on the ground or on a room; towers, spires and the flag sit on what is built below them.
import type { Tier } from '../../vision/types.ts';

export type SlotKind = 'room' | 'tower' | 'spire' | 'flag';

export interface Slot {
  i: number;
  kind: SlotKind;
  col: number;
  /** 0 = ground row */
  row: number;
  /** rows tall (corner towers are 2) */
  rows: number;
  /** places that must stand first */
  on: number[];
}

const S = (i: number, kind: SlotKind, col: number, row: number, on: number[], rows = 1): Slot => ({ i, kind, col, row, rows, on });

/** columns 0..6, the gate is in column 3 of the ground row */
export const SLOTS: readonly Slot[] = [
  S(0, 'room', 2, 0, []),
  S(1, 'tower', 6, 0, [], 2),
  S(2, 'room', 4, 0, []),
  S(3, 'tower', 0, 0, [], 2),
  S(4, 'room', 1, 0, []),
  S(5, 'room', 5, 0, []),
  S(6, 'room', 2, 1, [0]),
  S(7, 'room', 4, 1, [2]),
  S(8, 'room', 3, 1, [0, 2]),
  S(9, 'room', 1, 1, [4]),
  S(10, 'room', 5, 1, [5]),
  S(11, 'room', 3, 2, [8]),
  S(12, 'room', 2, 2, [6]),
  S(13, 'room', 4, 2, [7]),
  S(14, 'spire', 2, 3, [12]),
  S(15, 'spire', 4, 3, [13]),
  S(16, 'tower', 3, 3, [11]),
  S(17, 'flag', 3, 4, [16]),
];

export const COLS = 7;
export const ROWS = 5;
export const GATE_COL = 3;

export interface BuiltPart {
  slot: number;
  /** handwriting quality 0..1, only the decoration follows it */
  q: number;
  tier: Tier;
  /** the child's letter, null for a room built for a princess */
  glyphId: number | null;
}

export interface CastleData {
  parts: BuiltPart[];
  owner: [number, number][];
}

export class Castle {
  parts: BuiltPart[] = [];
  /** room place -> creature id of the princess living there */
  owner = new Map<number, number>();

  constructor() {
    this.parts.push({ slot: 0, q: 0.5, tier: 'nett', glyphId: null }, { slot: 1, q: 0.5, tier: 'nett', glyphId: null });
  }

  built(slot: number): boolean {
    return this.parts.some((p) => p.slot === slot);
  }

  full(): boolean {
    return this.parts.length >= SLOTS.length;
  }

  private next(kind?: SlotKind): number | null {
    for (const s of SLOTS) if (!this.built(s.i) && (!kind || s.kind === kind) && s.on.every((o) => this.built(o))) return s.i;
    return null;
  }

  nextSlot(): number | null {
    return this.next();
  }

  nextRoomSlot(): number | null {
    return this.next('room');
  }

  add(slot: number, part: Omit<BuiltPart, 'slot'>): BuiltPart {
    const p = { slot, ...part };
    this.parts.push(p);
    return p;
  }

  part(slot: number): BuiltPart | undefined {
    return this.parts.find((p) => p.slot === slot);
  }

  rooms(): number[] {
    return this.parts.filter((p) => SLOTS[p.slot].kind === 'room').map((p) => p.slot);
  }

  roomOf(creatureId: number): number | null {
    for (const [slot, id] of this.owner) if (id === creatureId) return slot;
    return null;
  }

  /** the lowest free room; builds one when none is free; null when all 12 are taken */
  assignRoom(creatureId: number): { slot: number; built: boolean } | null {
    const free = this.rooms()
      .filter((r) => !this.owner.has(r))
      .sort((a, b) => a - b)[0];
    if (free !== undefined) {
      this.owner.set(free, creatureId);
      return { slot: free, built: false };
    }
    const slot = this.nextRoomSlot();
    if (slot === null) return null;
    this.add(slot, { q: 0.5, tier: 'nett', glyphId: null });
    this.owner.set(slot, creatureId);
    return { slot, built: true };
  }

  freeRoom(creatureId: number): void {
    const r = this.roomOf(creatureId);
    if (r !== null) this.owner.delete(r);
  }

  /** free built rooms plus rooms that can still be built */
  roomsFree(): number {
    const builtFree = this.rooms().filter((r) => !this.owner.has(r)).length;
    const unbuilt = SLOTS.filter((s) => s.kind === 'room' && !this.built(s.i)).length;
    return builtFree + unbuilt;
  }

  export(): CastleData {
    return { parts: this.parts.map((p) => ({ ...p })), owner: [...this.owner] };
  }

  static from(data: CastleData): Castle {
    const c = new Castle();
    c.parts = data.parts.map((p) => ({ ...p }));
    c.owner = new Map(data.owner);
    return c;
  }
}

export interface Layout {
  /** left edge of column 0 */
  x0: number;
  /** ground line (bottom of row 0) */
  y0: number;
  cell: number;
  rowH: number;
  cols: number;
  rows: number;
}

/** the horizon of the Zauberland meadow; the castle stands just below it on its hill */
export const CASTLE_GROUND = 620;

export function castleLayout(worldW: number): Layout {
  const cell = Math.min(120, (worldW * 0.6) / COLS);
  return { x0: worldW / 2 - (COLS * cell) / 2, y0: CASTLE_GROUND, cell, rowH: cell * 0.86, cols: COLS, rows: ROWS };
}

export function slotRect(L: Layout, s: Slot): { x: number; y: number; w: number; h: number } {
  const h = L.rowH * s.rows;
  return { x: L.x0 + s.col * L.cell, y: L.y0 - L.rowH * s.row - h, w: L.cell, h };
}

/** where a princess looks out of her room */
export function windowOf(L: Layout, slot: number): { x: number; y: number } {
  const r = slotRect(L, SLOTS[slot]);
  return { x: r.x + r.w / 2, y: r.y + r.h * 0.5 };
}

/** the middle of the gate at ground level */
export function doorOf(L: Layout): { x: number; y: number } {
  return { x: L.x0 + (GATE_COL + 0.5) * L.cell, y: L.y0 };
}
