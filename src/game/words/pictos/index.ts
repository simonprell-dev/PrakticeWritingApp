// All pictures of the Wörter-Zoo by word (see picto.ts). Each group is drawn in a file of its own.
import type { Picto } from '../picto.ts';
import { gruppe2 } from './gruppe2.ts';
import { gruppe3 } from './gruppe3.ts';
import { gruppe4 } from './gruppe4.ts';

export const PICTOS: Record<string, Picto> = { ...gruppe2, ...gruppe3, ...gruppe4 };
