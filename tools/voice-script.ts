// Collects every text the game says or asks the children to do (speech bubbles, hints, banners, tips)
// straight from the source code and writes the recording script:
//   voice/SPRECHERTEXT.md  – to read from (speaker, direction, where in the game, file name)
//   voice/lines.json       – the same for the recording page (voice.html)
// Usage: npm run voice
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRACTICE_SETS, withArticle } from '../src/recog/classes.ts';
import { voiceId } from '../src/game/voiceId.ts';
import { ALIEN_NAMES } from '../src/scenes/towerScene.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

type Speaker = 'erzaehler' | 'zork' | 'riese' | 'wesen' | 'blase' | 'ausruf' | 'buchstaben';

export interface VoiceLine {
  id: string;
  text: string;
  speaker: Speaker;
  /** where it comes up in the game */
  where: string;
  /** a part of a text with a gap ({das X}, {Teamname}, {Zahl}): the whole text */
  partOf?: string;
}

const SPEAKERS: Record<Speaker, { title: string; direction: string }> = {
  erzaehler: { title: 'Erzählerin / Erzähler – Anweisungen und Hinweise', direction: 'freundlich, ruhig, deutlich und eher langsam – für Kinder, die noch nicht lesen können' },
  wesen: { title: 'Die Wesen (Fische, Aliens, Tiere) – Tipps und Freude', direction: 'niedlich, fröhlich, kindlich; Tipps aufmunternd, nie tadelnd' },
  zork: { title: 'Alien Zork und seine Klone (Türme bauen)', direction: 'hell, quirlig, ein bisschen frech; gern mit kleinen Alien-Geräuschen' },
  riese: { title: 'Riese Rumpel (Klasse gegen Riesenburg)', direction: 'tief und polternd, aber gutmütig – nie wirklich böse' },
  blase: { title: 'Die Überraschungsblase', direction: 'geheimnisvoll-fröhlich, sprudelnd' },
  ausruf: { title: 'Kurze Ausrufe', direction: 'kurz, lautmalerisch, mit viel Ausdruck' },
  buchstaben: { title: 'Buchstaben und Zahlen (für die Lücke {das X})', direction: 'deutlich und neutral, wie beim Diktat; Buchstaben mit ihrem Namen („das Be“)' },
};

// ---------------------------------------------------------------- a tiny source scanner

interface Literal {
  /** the text with ${...} turned into readable gaps */
  text: string;
  /** name of the function call the literal is an argument of (say, talk, toast, h, ...) */
  call: string;
  /** first string argument of that call (h('h2', ...) -> 'h2') */
  callFirst: string;
  /** object key the literal is the value of (text, title, sub, ...) */
  key: string;
  /** name of the const the enclosing object belongs to (TIP_TEXT, ...) */
  constName: string;
  /** the gag id before it (gags.ts) */
  near: string;
  /** the method it is in */
  method: string;
  returned: boolean;
}

/** readable gap for a template expression */
function gap(expr: string): string {
  if (/withArticle/.test(expr)) return '{das X}';
  if (/this\.name\(/.test(expr)) return '{Alienname}';
  if (/^first$/.test(expr.trim())) return '{Zahl}× {das X}';
  if (/^fresh$/.test(expr.trim())) return '{Zahl} neue Zeichen!';
  if (/name|Name/.test(expr)) return '{Teamname}';
  if (/list/.test(expr)) return '{Buchstaben}';
  if (/length|metres|count|toGoal|Count|goal|\bw\b|\bn\b|left|duplicates|neutral|walls|known|mirrored|k \+ 1/.test(expr)) return '{Zahl}';
  if (/char|target|done/.test(expr)) return '{Buchstabe}';
  return '{…}';
}

/** method or function that starts before every offset (for "where in the game") */
function methodsAt(src: string): (offset: number) => string {
  const marks: [number, string][] = [];
  const re = /^ {2}(?:private |protected |async |static |get )*([a-zA-Z_][\w]*)\s*\(|^(?:export )?function ([a-zA-Z_][\w]*)/gm;
  for (let m = re.exec(src); m; m = re.exec(src)) marks.push([m.index, m[1] ?? m[2]]);
  return (o) => {
    let name = '';
    for (const [at, n] of marks) if (at <= o) name = n;
    return name;
  };
}

function scan(src: string): Literal[] {
  const methodAt = methodsAt(src);
  const out: Literal[] = [];
  const stack: { kind: string; name: string; first: string; key: string; constName: string }[] = [];
  let i = 0;
  let lastIdent = '';
  let lastWord = '';
  let pendingKey = '';
  let near = '';
  const top = () => stack[stack.length - 1];
  const readString = (q: string): string => {
    let s = '';
    i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') {
        s += src[i + 1] === 'n' ? ' ' : src[i + 1];
        i += 2;
        continue;
      }
      if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
        let depth = 1;
        let j = i + 2;
        while (j < src.length && depth) {
          if (src[j] === '{') depth++;
          else if (src[j] === '}') depth--;
          else if (src[j] === '`' || src[j] === "'" || src[j] === '"') {
            const qq = src[j];
            j++;
            while (j < src.length && src[j] !== qq) j += src[j] === '\\' ? 2 : 1;
          }
          j++;
        }
        s += gap(src.slice(i + 2, j - 1));
        i = j;
        continue;
      }
      s += src[i++];
    }
    i++;
    return s;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2) + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const t = top();
      const text = readString(c);
      if (t && t.kind === 'call' && !t.first) t.first = text;
      const lit: Literal = {
        text,
        call: t?.kind === 'call' ? t.name : (stack.slice().reverse().find((s) => s.kind === 'call')?.name ?? ''),
        callFirst: stack.slice().reverse().find((s) => s.kind === 'call')?.first ?? '',
        key: pendingKey || (t?.kind === 'obj' ? t.key : ''),
        constName: stack.slice().reverse().find((s) => s.kind === 'obj' && s.constName)?.constName ?? '',
        near,
        method: methodAt(i),
        returned: lastWord === 'return',
      };
      out.push(lit);
      if (/^id$/.test(lit.key)) near = text;
      lastWord = '';
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      lastIdent = src.slice(i, j);
      lastWord = lastIdent;
      i = j;
      // "key:" inside an object
      let k = i;
      while (src[k] === ' ') k++;
      if (src[k] === ':' && src[k + 1] !== ':' && top()?.kind === 'obj') pendingKey = lastIdent;
      if (/^(private|function)$/.test(lastIdent)) {
        let m = k;
        while (/[\s]/.test(src[m])) m++;
        const fn = /^[A-Za-z_$][\w$]*/.exec(src.slice(m))?.[0];
        if (fn) near = fn;
      }
      continue;
    }
    if (c === '(') stack.push({ kind: 'call', name: lastIdent, first: '', key: '', constName: '' });
    else if (c === '{') {
      const before = src.slice(Math.max(0, i - 120), i);
      const constName = /const\s+([A-Z_][A-Z0-9_]*)\b[^=]*=\s*$/.exec(before)?.[1] ?? '';
      stack.push({ kind: 'obj', name: '', first: '', key: '', constName });
    } else if (c === '[') stack.push({ kind: 'arr', name: '', first: '', key: '', constName: '' });
    else if (c === ')' || c === '}' || c === ']') stack.pop();
    else if (c === ',' && top()?.kind === 'obj') pendingKey = '';
    if (!/\s/.test(c)) {
      if (c !== '.') lastIdent = c === '(' ? lastIdent : '';
      lastWord = '';
    }
    i++;
  }
  return out;
}

const speechLike = (s: string) =>
  /[A-Za-zÄÖÜäöüß]/.test(s) && (/\s/.test(s.trim()) || /[!?…]$/.test(s.trim())) && !/^(rgba?|hsla?|#|\d+px|https?:)/.test(s) && !/Fredoka|system-ui|sans-serif|\bpx\b/.test(s);

// ---------------------------------------------------------------- what is spoken where

/** what a method means for the people playing */
const PLACES: Record<string, string> = {
  runSeq: 'Zwischensequenz (Anfang oder Sieg)',
  handleScan: 'nach einem Foto',
  onEvent: 'während des Spiels',
  spawnGuards: 'Riese schickt Wächter',
  showDemo: 'Vorführung: so schreibt man den Buchstaben',
  drawDemo: 'Vorführung: so schreibt man den Buchstaben',
  spawnWish: 'Überraschungsblase erscheint',
  drawWish: 'Überraschungsblase wartet',
  popWish: 'Überraschungsblase geplatzt',
  startHabitat: 'Spielstart',
  practiceIntro: 'Spielstart beim Üben',
  startDuel: 'Spielstart Duell',
  startSiege: 'Spielstart Riesenburg',
  startTowers: 'Spielstart Türme bauen',
  letterDone: 'Übungsbuchstabe geschafft',
  scan: 'beim Foto',
  newSheet: 'Neues Blatt',
  toggleAuto: 'Automatisch scannen',
  constructor: 'jederzeit',
  colorDeps: 'Farbe anlernen',
  popFighter: 'eine Figur zerplatzt',
  capture: 'Foto wird ausgewertet',
  start: 'Foto ausgewertet',
};
const place = (l: Literal, mode: string) => `${mode} – ${Object.hasOwn(PLACES, l.method) ? PLACES[l.method] : l.method}`;

interface Rule {
  file: string;
  /** decides whether a literal is spoken, and by whom */
  pick: (l: Literal) => Speaker | null;
  where: (l: Literal) => string;
}

const RULES: Rule[] = [
  {
    file: 'src/game/tower/gags.ts',
    pick: (l) => (l.call === 'say' && speechLike(l.text) ? 'zork' : null),
    where: (l) => (l.near && l.near !== 'mischiefPose' ? `Türme bauen – lustige Panne „${l.near}“` : 'Türme bauen – Schabernack'),
  },
  {
    file: 'src/scenes/towerScene.ts',
    pick: (l) => (!speechLike(l.text) ? null : l.call === 'talk' || (l.key === '' && /Arbeit|Komme|Huch/.test(l.text)) ? 'zork' : l.call === 'toast' ? 'erzaehler' : l.key === 'title' || l.key === 'sub' ? 'erzaehler' : l.key === 'text' && l.call === 'add' ? 'ausruf' : null),
    where: (l) => place(l, 'Türme bauen'),
  },
  {
    file: 'src/scenes/siegeScene.ts',
    pick: (l) => (!speechLike(l.text) ? null : l.call === 'say' || l.near === 'spawnGuards' ? 'riese' : l.key === 'title' || l.key === 'sub' ? 'erzaehler' : null),
    where: (l) => place(l, 'Riesenburg'),
  },
  {
    file: 'src/scenes/habitat.ts',
    pick: (l) =>
      !speechLike(l.text)
        ? null
        : l.call === 'toast'
          ? 'erzaehler'
          : /Schreib mich|Fast|Andersrum/.test(l.text)
            ? 'blase'
            : l.key === 'text' && l.call === 'add'
              ? 'ausruf'
              : l.key === 'text' || /schreibt man|sehe aus wie/.test(l.text)
                ? /schreibt man/.test(l.text)
                  ? 'erzaehler'
                  : 'wesen'
                : null,
    where: (l) => place(l, 'Meer, Weltraum, Savanne'),
  },
  {
    file: 'src/scenes/duelScene.ts',
    pick: (l) => (!speechLike(l.text) ? null : l.call === 'toast' ? 'erzaehler' : l.key === 'text' ? 'ausruf' : null),
    where: (l) => place(l, 'Team-Duell'),
  },
  {
    file: 'src/scenes/paintScene.ts',
    pick: (l) => (!speechLike(l.text) ? null : l.call === 'toast' ? 'erzaehler' : l.key === 'text' ? 'wesen' : /Fisch|Farben|kenne ich|ausgemalt|Karte/.test(l.text) ? 'erzaehler' : null),
    where: (l) => place(l, 'Mal-Aquarium'),
  },
  {
    file: 'src/recog/score.ts',
    pick: (l) => (l.constName === 'TIP_TEXT' ? 'wesen' : l.constName === 'TIER_LABEL' ? 'ausruf' : null),
    where: (l) => (l.constName === 'TIP_TEXT' ? 'Tipp eines Wesens zu seinem Buchstaben' : 'Stufe über einem neuen Wesen'),
  },
  {
    file: 'src/game/spawnFx.ts',
    pick: (l) => (l.key === 'label' || l.call === '' || /Zeichen|Neues|gefunden|schaue|Spiegel/.test(l.text) ? (/schaue|Zeichen|Neues|gefunden|Spiegel/.test(l.text) ? 'erzaehler' : null) : null),
    where: (l) => place(l, 'Foto'),
  },
  {
    file: 'src/app/app.ts',
    pick: (l) => (!speechLike(l.text) ? null : l.call === 'toast' || l.returned ? 'erzaehler' : l.call === 'h' && (l.callFirst === 'h2' || l.callFirst === 'p') && l.near === 'letterDone' ? 'erzaehler' : null),
    where: (l) => place(l, 'Hinweis'),
  },
];

function collect(): VoiceLine[] {
  const seen = new Map<string, VoiceLine>();
  for (const r of RULES) {
    const src = readFileSync(ROOT + r.file, 'utf8');
    for (const l of scan(src)) {
      const speaker = r.pick(l);
      if (!speaker) continue;
      const text = l.text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
      // technical error messages (they end with the error text) are not for the children
      if (!text || /:$/.test(text) && !/schreibt man/.test(text)) continue;
      // gaps with only a few values are written out
      const variants = text.includes('{Alienname}')
        ? ALIEN_NAMES.slice(1).map((n) => text.replace('{Alienname}', n))
        : /^\+\{Zahl\} m$/.test(text)
          ? [2, 3, 4, 6, 8].map((n) => `+${n} m`)
          : [text];
      for (const v of variants) {
        if (!/\{[^}]+\}/.test(v)) {
          if (!seen.has(v)) seen.set(v, { id: voiceId(v), text: v, speaker, where: r.where(l) });
          continue;
        }
        // a text with a gap is recorded in parts; letters ({das X}) have their own recordings
        const parts = v
          .split(/\s*\{[^}]+\}\s*/)
          .map((q) => q.replace(/^[\s:,–-]+/, '').trim())
          .filter((q) => /[A-Za-zÄÖÜäöüß]/.test(q));
        for (const q of parts) if (!seen.has(q)) seen.set(q, { id: voiceId(q), text: q, speaker, where: r.where(l), partOf: v });
      }
    }
  }
  // the gaps: letters and numbers spoken on their own
  for (const set of PRACTICE_SETS) {
    for (const ch of set.chars) {
      const text = withArticle(ch);
      seen.set(text, { id: voiceId(text), text, speaker: 'buchstaben', where: set.label });
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------- output

// in the order of the script: by speaker, then as they come in the game
const order = Object.keys(SPEAKERS) as Speaker[];
const lines = collect().sort((a, b) => order.indexOf(a.speaker) - order.indexOf(b.speaker));
mkdirSync(ROOT + 'voice', { recursive: true });
writeFileSync(ROOT + 'voice/lines.json', JSON.stringify(lines, null, 1));

const md: string[] = [];
md.push('# Krakel & Krone – Sprechertext', '');
md.push(`Alles, was im Spiel in Sprechblasen steht oder den Kindern sagt, was zu tun ist – ${lines.length} Aufnahmen.`, '');
md.push('**So aufnehmen**', '');
md.push('- Am einfachsten mit der Aufnahmeseite: `npm run dev`, dann `http://localhost:5173/voice.html` öffnen. Dort Zeile für Zeile einsprechen; die Dateien landen mit dem richtigen Namen in einem Ordner (am besten `public/voice/`).');
md.push('- Oder mit einem eigenen Programm: jede Zeile als eigene Datei unter dem angegebenen Namen speichern (mono, ohne lange Pausen am Anfang und Ende).');
md.push('- Texte mit Lücke (z. B. „Sieg für {Teamname}!“) sind schon in Teile zerlegt: jede Zeile hier ist genau eine Aufnahme. Die Buchstaben für „{das X}“ stehen im letzten Abschnitt; Teamnamen und Zahlen werden nicht aufgenommen.');
md.push('- Ändert sich ein Text im Spiel, ändert sich auch sein Dateiname – dann `npm run voice` neu ausführen und nur die neuen Zeilen aufnehmen.', '');
for (const sp of Object.keys(SPEAKERS) as Speaker[]) {
  const group = lines.filter((l) => l.speaker === sp);
  if (!group.length) continue;
  md.push(`## ${SPEAKERS[sp].title}`, '', `*Regie: ${SPEAKERS[sp].direction}.*`, '');
  md.push('| Nr. | Text | Wo im Spiel | Datei |', '|---:|---|---|---|');
  for (const l of group) {
    const n = lines.indexOf(l) + 1;
    const where = l.partOf ? `${l.where}<br>*Teil von:* „${l.partOf}“` : l.where;
    md.push(`| ${n} | ${l.text.replace(/\|/g, '/')} | ${where} | \`${l.id}\` |`);
  }
  md.push('');
}
writeFileSync(ROOT + 'voice/SPRECHERTEXT.md', md.join('\n'));
const by = Object.fromEntries((Object.keys(SPEAKERS) as Speaker[]).map((s) => [s, lines.filter((l) => l.speaker === s).length]));
console.log(`${lines.length} lines`, JSON.stringify(by));
