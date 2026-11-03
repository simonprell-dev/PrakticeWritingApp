// Builds src/game/kanaStrokes.ts: stroke order and direction of the 46 basic hiragana and katakana from
// KanjiVG (https://kanjivg.tagaini.net, CC BY-SA 3.0, Ulrich Apel and contributors).
// Usage: node tools/make-kana-strokes.ts
//
// The SVG files come from one pinned commit (release r20260714) and every file is checked against its
// SHA-256 before it is used. The stroke paths are sorted by their KanjiVG stroke number (kvg:…-sN),
// converted to absolute coordinates and written in the mini path language of src/game/strokes.ts
// (M, L, C), scaled from the 109×109 KanjiVG box to a square of 2×2 bands (top line to base line).
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COMMIT = 'd95a97627fd9fe5b2c8d06ca81e38149609c0c1e'; // tag r20260714
const BASE = `https://raw.githubusercontent.com/KanjiVG/kanjivg/${COMMIT}/kanji/`;
const OUT = fileURLToPath(new URL('../src/game/kanaStrokes.ts', import.meta.url));
/** KanjiVG viewBox and the size of the writing box in bands */
const KVG = 109;
const BOX = 2;

const SHA256: Record<string, string> = {
  '03042': '3553cd24cba506dffe12e1214f231fc129c2535f719c1bdc86a9fb651aa9ec9b',
  '03044': 'af6b59de47a27d48f952092182fe9f222b0a6c7c6aacf67386b0eeaf8c35b86e',
  '03046': '57039965dc929d72ef3bdb9d12187099e99bcf99504e1b0d3ce5eff0552237f0',
  '03048': 'e97c7c98b19b06d004b2addeab5f69f9262265bebf06e83dad7e77d217be5b16',
  '0304a': '2211aa7b4825d5aed8d30b05df5c939a903599f13827531828aeb019efbf1414',
  '0304b': '3b3bcd50c1bd4fcde1cfefd2e552ae9f1f1dacb618a3b5a0a96b9dcd719aa439',
  '0304d': '8f4376853a758ce9710d8b312d93deef512a36a9626bad2f180b46655d23e76a',
  '0304f': '8ab7bbab9a6c8dc911b5e67b4b6b54fa133e3dc6a2d57eeb353084ece5e26f40',
  '03051': 'cbc38d14ca6ad327a93c2e4b338bac47eeaeb66ba7ecca3e4afcd8ac4d9a9d32',
  '03053': 'b2ad2786cc3ef74f5c339e0cd7093e17a3c4d13c11dfb6eed4e6ee6b3e702782',
  '03055': 'bf9a7786a305903c11bd0e30848a093f614d9653ba498093a3472e78211ea5db',
  '03057': 'f5aae137cbd752963535a0724ad9675d15895940b3960eb730dec1f78274bfca',
  '03059': 'ed087b4ac03607fc999eada898b3c87df455036cbb8a73ccfade6da8fdbcbb71',
  '0305b': 'f32432196b6c07bcee9b426d766f7826966aa980cbf9bce9553e34665dca0c47',
  '0305d': '10a406c3bd00a4c49974bf00a9dc773c7e7dfa6579063c516bc39fd5a6467338',
  '0305f': 'cacec2bd4118f3f6c3ae2978d895b081efdc6c9196fa91beab546ecebc2315fb',
  '03061': '2b5557a06674bce0cc8140930a945c4d17a840ef97354627c6daa1d13475d4b6',
  '03064': '5df14db33d17141d8a0bed6711ae2172fefeea5cf59d19815bbee3c7c640147d',
  '03066': '8c82e43f10b7479ffa6d38ea6dbde76652ef1fbc91aa5ed2883a1c230424b07b',
  '03068': '7a300dedb5bcdad7b54a248c4ca7eca6ca4e027a744b2083e560dc07b76f5b85',
  '0306a': '1d86f569ce1627e27231db0537cf1ebe1c4a6d0a359add442d0ec141cf26dbad',
  '0306b': 'c7582cd0309b80826201eea391abd426d8fa44f2d35b2d5e649a1d4fbdfcbaae',
  '0306c': '6156f4b03d21fd26ba1d9b5c07135b5e5c1badb0f58714054e3e5928997b780e',
  '0306d': '9e02a0fe50febb753c7e9c0880f07c9f61384c0057fb2dc814c96cb760379a6a',
  '0306e': '85a190a35b6b8e4f79de6b313b468de8cdb8d1e3e13d404838f462f7888ad2c0',
  '0306f': 'e4866a56b1e47a46e544acb7c18d5c21fc56405e8e037668be8b299c6e1e763d',
  '03072': '971ad9d36adae9db86899cddeec4295cea33f9993e58d561e5532fe31f4d608c',
  '03075': '060ce3d8e43475ca60ef3919cf401e75a4cd69654ec98b42088e759cba0365f9',
  '03078': '97e2ad2dfdf65715fcef590d7b6240519987b0056037bc27e0fe65d34c8e10ee',
  '0307b': '409d28469fcbef7d1884af3764a4a7b6822813ea11e233f16e4f008a57d4324c',
  '0307e': '67a26b7a63eb72511999012cb54eaf82ab8295e50dc010eba00f7ad30ef5e912',
  '0307f': 'be6a88aa3983f5d1a4d2cd93d0d2c06506dcf09d5d183967a020b39a09841c19',
  '03080': 'd8dbf8e3e4b0e6483f23f1686a3f97c06fa751d04cc5c01e53e377ca82540d96',
  '03081': 'c4d6568ee1f0f7429a2c35a85ab39d392f3d87f87f27158446e4859ad1d60008',
  '03082': 'e5a99b12fff1496715f11eb2a275a7721ec176089035cb0055e42074abfdc4e2',
  '03084': '36a404baafe4832bf065cac4174b32fcd7e2e03dc1cad4f8356b86d8974885e8',
  '03086': 'ef191769f548cf2027254d4b9d8875de2f577395f3404dad87fee1da0022c6f8',
  '03088': '63d40e3870cfc3a45df727bd91a0701c038b1439ccb7893a9dd016ee668b7286',
  '03089': 'b6a9627a57e2f93d41fa00f5b90a471db986102d1d4630186ff9745d2f13c719',
  '0308a': '4884e6b9eb7b49c58b421741803ea1fa2186b5e3025068073f881d401791e633',
  '0308b': '3b0208d49dc36f45b9666c46205795087730dfa68a7af6e03d724e4e368eebad',
  '0308c': 'a93be82abb8ef41403273fb631bdb2711b37b07658c6f2bbe9a4c4b3cc30f12f',
  '0308d': '64a5727daa97a371852e28096ad5e07125a4a00e4459ef43a989563f15bc7736',
  '0308f': '090f523c36076c0b819b3897dec5cdf5967a6569a9a76bd591d1ee0ad67c9d40',
  '03092': 'fe468e6b465a4531276bf16ef579f5921f3b31d8dc74f145c797a1bc37521d1b',
  '03093': 'f38abbba5be2567e8cb36c0417727f1fd368ac3c90764471c09856b0057a66c3',
  '030a2': 'f7dfe4a6af4c4622b611b5b1e92005fe3356c808dbb44ea0e877e02e46f6ee73',
  '030a4': '4b4f6d1b99e37559893e291713eccf05f7a3cbb2daa3273a856de29b839042e6',
  '030a6': '3e166f9fe86da6edd06aead4bd8c0f43a33f8195f83047c9aa2182eb9f05feb3',
  '030a8': '639c0194da2e36e82ef30409f367d52433a1ed4692936ec9dbd4d9b7f3aed4c9',
  '030aa': '6a26eb24121f4d6ff6192067925a40c842360949a6a72ae6bc3dd876cd802f1e',
  '030ab': '179d16fc65b0db69f691f5efb5da26c641449277d0d67e4ddd08dbb84b1afce6',
  '030ad': 'bc7956fc043fa06b1fa2eb7312896c8441d600bc724e709362faf7b67705c2b7',
  '030af': 'b4a0abdf5423b32d642c286ed33cb8f91e1ca788e0695913814e80765d058d52',
  '030b1': '43334e1e96016c2aa045cfe468c1fe6e720330b23b837c7f786c23b2b455a1a8',
  '030b3': '0f366054dfa2bdaa80defb0418f0e3def2a7c286e7279904e6a5a3578e76a7fc',
  '030b5': '6849ccaa3f91530f5d8bb33e994511a3851b584ca1d94df770051533ba328be1',
  '030b7': '777a0eef4d858337a43e30a78ee09f265080cb3f33975b6e23148849027b1769',
  '030b9': '2facf6236f57fb23d13b8e58591eef9b3f5a87bc91a5b46f7b2a4148f041445b',
  '030bb': 'bd54af254ca5b1f85df58fd7bd054bcb52dd77a50a08e80db75a5c01b4aef4f1',
  '030bd': 'f225b489929dc7483b07b7cc8f6138c02d41afda88f693ece9119b8ccb84c13e',
  '030bf': 'be5768ceb910a36dda67906f7380c861d94395ad4738bbafe5ac2b6e381319d1',
  '030c1': 'dffb0a69dd17e7492698fee6c0efafb7f6a910f3f94ed27764a6c5e2c588ee30',
  '030c4': '161c7a7be52dc62a9db1d99002a827e4c71a2ff9272c969ecb60995c1044a9fc',
  '030c6': '539a4cbd57ad96d14090234e2d7a22086784cc21a54492f41bf7821f5ca95022',
  '030c8': '390feff352209925ca9df574561e7867855bdb2256677030b845dd609c9c4f93',
  '030ca': '842bc219e8bd86d3fcce2596cbb229fc3f9b4c45fd0f22260efc32ca26105e72',
  '030cb': '150810f2c90970b7e432d4b75da4bb1cc83bce08dd20e02bf1a534da00af605a',
  '030cc': '15cb49d3112264fa744549e51afa45537f9782ab4c980adba5593e544de4ecf0',
  '030cd': '3607ca36dea181a59100d0d9b2591f5539b7d75b1acb84364843d5c6e9f11ebd',
  '030ce': 'ae39d6040adfbbeb5db4f822dde0cc11b7e66c150282f8abbeb940b5dbf6a03b',
  '030cf': '816e69c07fb4d5a2d0cc66758c2c9c59d4c27c3a13c96057cd417bb9840e119a',
  '030d2': '58b7eddec372f7ae621ff65a2fa0075857f658e084d6d95b8a261c6a88ec0bd8',
  '030d5': '1aa669f5ba4c3a795d62ce1ec41444d06206bd29f61bf5be70e7ddaa80dd930a',
  '030d8': 'baab8c06699c0aa4774f1b90bc971f7f6034ec460437596c5a6e496ade458e46',
  '030db': '7e1e9e1073b81cf5ad9c10cad0f10b465d5e608c8294ebc25e9dd11d4eed6a96',
  '030de': 'a32affa8337fc8315588ee800603a6594c325f9080dbde7887d47ee5d4cf34a4',
  '030df': '358cdedf0fb052b35c22d35bdde8f004cadbd9b4e230b48143bc811b53056397',
  '030e0': '7aa8ecfcb8c309f8ea867787825979974fb810ea5ce5271dd0374455d7ad2f79',
  '030e1': 'c2e0dd96e95b558a5c6004163c43f75023ea07f8b6f6263d068bb30ef860f166',
  '030e2': '550500b1e204fe6d625e73799b3ef3f16a4014126f33d70d947fcb9c78eeeaf4',
  '030e4': 'd843888e471d9312d8e396943475d5ff7c235a16f488f83820be9024122491d4',
  '030e6': '4cb44f6fdc053e0847d6148c5fd43c0fa32358c60081631313c0f0753d17a3a4',
  '030e8': '5b82d555778c5b0d3d4eda5a453c09f7f1c0be687986003b49ab3e33d8fb4b88',
  '030e9': 'ee11d9622dee5ed32bd8d6c4ca1ba4dd77852475f694c3cb9e5d7ec0d72298f4',
  '030ea': '2958cc8c5ee1cd5289ee82cfb33b1b6842c2d2a7afb4e54158dc269ad6d52138',
  '030eb': 'bd5b120af6debd4feaa0a0d4fe46955f1f1f94dd7e3d64fe3b69c13fc4bdca3a',
  '030ec': '8a61e26d9b462aa669a058d15640dd72aa19ceafc9bcb7fc56e4f4e52e6baec0',
  '030ed': '8eeeeed120e9f7d816353eff6af991e04162f6cb38106b855d4454cd640a772a',
  '030ef': '2f41b88f39b92d0959a3c96ebc7093c6254ff27e96890e8c7de7adf9766556ab',
  '030f2': '14f0310c562007fc04e13a655cc9267698904273754c5ecff3cb81eeeee9dbd2',
  '030f3': '0e6ea9722247514cc5068ac2b409882c6e47ccc12530e69da680246f72884229',
};

type P = [number, number];

/** SVG path data -> list of absolute segments (M / L / C); throws on anything unexpected */
function parsePath(d: string): string[] {
  const tok = d.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: string[] = [];
  let i = 0;
  let cur: P = [0, 0];
  let start: P = [0, 0];
  let lastCtrl: P | null = null;
  let cmd = '';
  const num = () => {
    const v = Number(tok[i++]);
    if (!Number.isFinite(v)) throw new Error(`bad number in ${d}`);
    return v;
  };
  const f = (v: number) => String(Number(((v * BOX) / KVG).toFixed(3)));
  const pt = (p: P) => `${f(p[0])} ${f(p[1])}`;
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    else if (!cmd) throw new Error(`path without command: ${d}`);
    const rel = cmd === cmd.toLowerCase();
    const o: P = rel ? cur : [0, 0];
    switch (cmd.toUpperCase()) {
      case 'M': {
        if (out.length) throw new Error(`more than one sub-path in one stroke: ${d}`);
        cur = [o[0] + num(), o[1] + num()];
        start = cur;
        out.push(`M${pt(cur)}`);
        cmd = rel ? 'l' : 'L'; // further pairs are line-tos
        lastCtrl = null;
        break;
      }
      case 'L':
      case 'H':
      case 'V': {
        const c = cmd.toUpperCase();
        const x = c === 'V' ? cur[0] : o[0] + num();
        const y = c === 'H' ? cur[1] : o[1] + num();
        cur = [x, y];
        out.push(`L${pt(cur)}`);
        lastCtrl = null;
        break;
      }
      case 'C':
      case 'S': {
        let c1: P;
        if (cmd.toUpperCase() === 'C') c1 = [o[0] + num(), o[1] + num()];
        else c1 = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const c2: P = [o[0] + num(), o[1] + num()];
        const e: P = [o[0] + num(), o[1] + num()];
        out.push(`C${pt(c1)} ${pt(c2)} ${pt(e)}`);
        lastCtrl = c2;
        cur = e;
        break;
      }
      case 'Z':
        out.push(`L${pt(start)}`);
        cur = start;
        lastCtrl = null;
        break;
      default:
        throw new Error(`unsupported path command ${cmd} in ${d}`);
    }
  }
  if (!out.length) throw new Error(`empty path`);
  return out;
}

// the same characters as HIRAGANA / KATAKANA in src/recog/scripts.ts (test/game/kanaStrokes.test.ts checks it)
const chars = [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん', ...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'];
const glyphs: [string, string[]][] = [];
let i = 0;
for (const ch of chars) {
  const cp = ch.codePointAt(0)!.toString(16).padStart(5, '0');
  const res = await fetch(BASE + cp + '.svg');
  if (!res.ok) throw new Error(`${ch} ${cp}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = createHash('sha256').update(buf).digest('hex');
  if (hash !== SHA256[cp]) throw new Error(`${ch} ${cp}: SHA-256 ${hash} does not match the pinned one`);
  const svg = buf.toString('utf8');
  const strokes: [number, string][] = [];
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const id = /\bid="kvg:[0-9a-f]+-s(\d+)"/.exec(m[0]);
    const d = /\bd="([^"]*)"/.exec(m[0]);
    if (!id || !d) throw new Error(`${ch}: path without stroke id or data`);
    strokes.push([Number(id[1]), parsePath(d[1]).join(' ')]);
  }
  strokes.sort((a, b) => a[0] - b[0]);
  strokes.forEach(([n], k) => {
    if (n !== k + 1) throw new Error(`${ch}: stroke numbers are not 1..n`);
  });
  if (!strokes.length) throw new Error(`${ch}: no strokes`);
  glyphs.push([ch, strokes.map((s) => s[1])]);
  process.stdout.write(`\r${++i}/${chars.length}`);
}

const body = glyphs.map(([ch, s]) => `  '${ch}': [\n${s.map((p) => `    '${p}',\n`).join('')}  ],\n`).join('');
writeFileSync(
  OUT,
  `// GENERATED by tools/make-kana-strokes.ts, do not edit.
//
// Stroke order and direction of the basic hiragana and katakana, from KanjiVG
// (https://kanjivg.tagaini.net, https://github.com/KanjiVG/kanjivg, commit ${COMMIT}).
// KanjiVG is copyright (C) Ulrich Apel and released under the Creative Commons Attribution-ShareAlike 3.0
// licence (https://creativecommons.org/licenses/by-sa/3.0/); this file is a derived work under the same
// licence.
//
// Every character is a list of strokes in writing order, in the path language of strokes.ts (M, L, C),
// in a square box of ${BOX}×${BOX} bands: top line y = 0 to base line y = ${BOX}, x from 0 to ${BOX}.

/** width (and height) of the kana writing box in bands */
export const KANA_BOX = ${BOX};

export const KANA_STROKES: Record<string, string[]> = {
${body}};
`,
);
console.log(`\nwrote ${OUT} (${glyphs.length} characters, ${glyphs.reduce((n, g) => n + g[1].length, 0)} strokes)`);
