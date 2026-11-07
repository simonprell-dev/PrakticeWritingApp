// Which sentence of a door's story is on screen. The speaker says when it starts a line; a line it really read
// stays until the next one starts, a line nobody could hear (sound off, no speech, missing file) stays for a
// fixed time, so the subtitles also run on their own.
import type { Line } from '../voice/speaker.ts';
import { STORIES } from './story.ts';

/** seconds a sentence stays on screen when it is not read aloud */
export const SILENT_LINE = 3.5;
/** a line the speaker was done with faster than this was not really heard */
const HEARD = 0.5;
/** the last sentence stays a little after it was read */
const LINGER = 1.5;
/** no sentence is read longer than this (should the speaker hang) */
const LONGEST = 20;

/** the story of a door as lines for the speaker: title and narration, the figure, then Flocke */
export function storyLines(day: number): Line[] {
  const s = STORIES[day - 1];
  return [
    { key: s.title, voice: 'erzaehler' },
    ...s.narration.map((key): Line => ({ key, voice: 'erzaehler' })),
    { key: s.figure, voice: 'wesen' },
    { key: s.flocke, voice: 'flocke' },
  ];
}

export class Telling {
  readonly lines: Line[];
  /** the line on screen */
  shown = 0;
  /** seconds it has been on screen */
  shownT = 0;
  /** all lines were shown */
  done = false;
  private clock = 0;
  /** when the speaker started each line */
  private heard: number[] = [];
  private ended: number | null = null;

  readonly day: number;

  constructor(day: number) {
    this.day = day;
    this.lines = storyLines(day);
  }

  /** the speaker starts line i */
  heardLine(i: number): void {
    this.heard[i] = this.clock;
  }

  /** the speaker is through (or gave up) */
  end(): void {
    this.ended ??= this.clock;
  }

  private live(k: number): boolean {
    const a = this.heard[k];
    return a !== undefined && this.heard[k + 1] === undefined && this.ended === null && this.clock - a < LONGEST;
  }

  private voiced(k: number): boolean {
    const a = this.heard[k];
    if (a === undefined) return false;
    return (this.heard[k + 1] ?? this.ended ?? this.clock) - a >= HEARD;
  }

  /** true when another line came on screen */
  update(dt: number): boolean {
    if (this.done) return false;
    this.clock += dt;
    this.shownT += dt;
    // the speaker is ahead: follow it
    for (let k = this.lines.length - 1; k > this.shown; k--) if (this.live(k)) return this.go(k);
    if (this.live(this.shown)) return false;
    const last = this.shown === this.lines.length - 1;
    const wait = this.voiced(this.shown) ? last && this.clock - (this.ended ?? this.heard[this.shown] + LONGEST) < LINGER : this.shownT < SILENT_LINE;
    if (wait) return false;
    if (last) {
      this.done = true;
      return false;
    }
    return this.go(this.shown + 1);
  }

  private go(k: number): boolean {
    this.shown = k;
    this.shownT = 0;
    return true;
  }
}
