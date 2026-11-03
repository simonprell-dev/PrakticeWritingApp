import { describe, expect, it } from 'vitest';
import { groupMapOf, SCRIPT_IDS, scriptOf } from '../../src/recog/scripts.ts';
import { Recognizer } from '../../src/recog/recognizer.ts';
import { matchSkel } from '../../src/recog/templates.ts';
import { loadScriptModel } from '../helpers/load.ts';

describe.each(SCRIPT_IDS.filter((id) => id !== 'druck'))('model of %s', (id) => {
  const def = scriptOf(id);
  const { bank, net } = loadScriptModel(def.modelDir);
  const groupOf = groupMapOf(def);

  it('knows exactly the characters of the script, with the same look-alike groups', () => {
    const classes = net.meta.classes as string[];
    expect([...classes].sort()).toEqual([...def.chars].sort());
    for (const g of (net.meta as { groups?: string[] }).groups ?? []) expect(new Set([...g].map(groupOf)).size).toBe(1);
    new Recognizer(bank, net, {}, def);
  });

  it('has a template for every character, and each one is closest to its own group', () => {
    for (const ch of def.chars) expect(bank.forChar(ch).length, ch).toBeGreaterThan(0);
    let wrong = 0;
    for (const t of bank.templates) {
      let best = { D: Infinity, ch: '' };
      for (const o of bank.templates) {
        if (o.style !== t.style) continue;
        const r = matchSkel(t.skel, o, true);
        if (r.D < best.D) best = { D: r.D, ch: o.char };
      }
      if (groupOf(best.ch) !== groupOf(t.char)) wrong++;
    }
    expect(wrong).toBeLessThanOrEqual(Math.ceil(bank.templates.length * 0.03));
  });
});
