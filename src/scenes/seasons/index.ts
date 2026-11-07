// The seasonal worlds that are built. Each is a HabitatDef of its own file; the start screen offers a world
// only when it is built and its time has come (src/app/worlds.ts).
import type { SeasonId } from '../../app/worlds.ts';
import type { HabitatDef } from '../habitat.ts';
import { fruehling } from './fruehling.ts';
import { neujahr } from './neujahr.ts';
import { ostern } from './ostern.ts';
import { weihnachten } from './weihnachten.ts';
import { winter } from './winter.ts';

export const SEASON_DEFS: Partial<Record<SeasonId, HabitatDef>> = { neujahr, winter, fruehling, ostern, weihnachten };
