# Schriften der Welt – one model per script

Every writing system ("script") has its **own** GlyphNet (same architecture as `model.py`, 28×28 input)
and its own template bank. Scripts are never mixed: a model only knows the classes of its script.

| id | Name | Classes |
|----|------|---------|
| `druck` | Druckschrift | `0-9 A-Z a-z ß` (63) – unchanged, old pipeline (`train.py`, `export.py`, `make_templates.py`) |
| `grund` | Grundschrift | same 63 as druck |
| `schreib` | Schreibschrift, letters written one by one | same 63 as druck |
| `hiragana` | Hiragana | 46: あいうえお かきくけこ さしすせそ たちつてと なにぬねの はひふへほ まみむめも やゆよ らりるれろ わをん |
| `katakana` | Katakana | 46: アイウエオ … ワヲン |
| `kyrillisch` | Kyrillisch (Russisch) | 66: А–Я with Ё after Е, then а–я with ё |
| `arabisch` | Arabisch | 28, isolated form: ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي |
| `devanagari` | Devanagari (Hindi) | 44: vowels अ आ इ ई उ ऊ ए ऐ ओ औ ऋ, consonants क … ह (33) |
| `griechisch` | Griechisch | 49: Α–Ω (24), α–ω without ς (24), then ς |
| `hebraeisch` | Hebräisch | 27: א … ת (22), then the final forms ך ם ן ף ץ |
| `hangul` | Hangul | 38: ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ, ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ, 가나다라마바사아자차카타파하 |
| `thai` | Thailändisch | 44 consonants ก … ฮ (U+0E01–U+0E2E without the vowels ฤ ฦ) |

The class lists, confusable groups, fonts and training settings live in `scripts.py` (single source
of truth; class order = output order of the network).

## Confusable groups (`groups` in the model JSON)

Characters that look alike once the glyph is scaled to a fixed box (the CNN input has no size
information). "group accuracy" counts a prediction inside the right group as correct.

- grund, schreib: as druck (`0Oo 1Il cC kK mM pP sS uU vV wW xX yY zZ jJ`)
- kyrillisch: every lower case letter that is a small copy of its capital: Вв Гг Дд Жж Зз Ии Йй Кк
  Лл Мм Нн Оо Пп Рр Сс Тт Уу Фф Хх Цц Чч Шш Щщ Ъъ Ыы Ьь Ээ Юю Яя (not Аа Бб Ее Ёё)
- griechisch: Οο Κκ Χχ Ψψ Ππ Ττ Ιι Θθ Φφ Ρρ Ββ
- hebraeisch: וין, דרך, הח, בכ, סם (ו / י / ן differ mostly in length, which the input loses)
- devanagari: घध, बव, भम
- thai: ขฃ, คฅ (ฃ and ฅ are obsolete look-alikes)
- hiragana, katakana, arabisch, hangul: none

## Outputs

```
public/model/<id>/glyphnet-v1.json   meta (see below)
public/model/<id>/glyphnet-v1.bin    float16 weights, BatchNorm folded, same layout as druck
public/model/<id>/templates-v1.json  template meta
public/model/<id>/templates-v1.bin   1-bit 64×64 masks, row-major, MSB first (512 bytes each)
public/fonts/<id>.woff2              display font subset (not for grund: reuses PlaywriteDEGrund.woff2)
public/fonts/OFL-<id>-<Family>.txt   its licence
```

`glyphnet-v1.json`:

```json
{
  "version": "v1",
  "script": "hiragana",
  "input": [28, 28],
  "classes": ["あ", "い", "…"],
  "groups": ["Вв", "…"],
  "dtype": "f16",
  "temperature": 0.41,
  "preprocess": {"size": 28, "fit": 24, "strokePx": 2.3, "blur": 0.6},
  "layers": [{"type": "conv", "in": 1, "out": 16, "k": 3, "relu": true, "w": 0, "b": 144}, "…",
             {"type": "dense", "in": 576, "out": 46, "w": 0, "b": 0}],
  "accuracy": {"top1": 0.99, "group": 0.99, "fonts_top1": 0.99, "fonts_group": 0.99,
               "real_top1": 0.9, "real_group": 0.95, "n_real": 0, "n_fonts": 803}
}
```

Differences to druck's `public/model/glyphnet-v1.json`: `classes` is an **array of strings** (druck: one
string), plus `script` and `groups`; `accuracy` has the extra per-source keys (`real_*` only when the
script has a real dataset). Layers, preprocessing and the binary are identical in kind.

`templates-v1.json`:

```json
{"version": "v1", "script": "schreib", "styles": ["sas", "va", "la"], "metrics": "xheight",
 "size": 64, "fit": 56, "bytesPerTemplate": 512,
 "templates": [{"char": "a", "style": "sas", "top": 1.0, "bottom": 0.0, "aspect": 0.9}, "…"]}
```

- `style` is the script id, except **schreib**: `sas` (Schulausgangsschrift, Playwrite DE SAS),
  `va` (Vereinfachte Ausgangsschrift, Playwrite DE VA), `la` (Lateinische Ausgangsschrift,
  Playwrite DE LA) – 63 templates each. `styles` lists them, the first one is the default.
- `metrics: "xheight"` (grund, schreib – like druck): `top` / `bottom` = height above / depth below
  the baseline in x-heights. `metrics: "em"` (all non-Latin scripts, no x-height): the same, in units
  of the font size (em). `aspect` = ink box width / height in both cases.
- grund's templates are the same glyphs as the `grund` style entries in druck's
  `public/model/templates-v1.*` (pixel difference < 0.03 %).

## Data

### Real handwriting (only where freely downloadable without login, SHA-256 pinned in `download_scripts.py`)

| Dataset | Used for | Licence | Notes |
|---|---|---|---|
| EMNIST byclass (NIST; HF mirror, `download_data.py`) | grund, schreib | public (NIST, as for druck) | digits + Latin letters |
| CoMNIST Cyrillic, Gregory Vial, github.com/GregVial/CoMNIST | kyrillisch | **CC BY-SA 4.0** | 15 k 278×278 drawings of the 33 Russian letters, crowd-sourced on touch screens; writers used upper or lower case (often cursive), so a sample's label is the letter. It trains the capital and, for letters in a group, also the small letter. 15 % (by file-name hash) held out. Attribution required; the weights trained on it are an adaptation, so treat `public/model/kyrillisch/glyphnet-v1.*` as CC BY-SA 4.0 (credit: "CoMNIST by Gregory Vial"). |
| DHCD Devanagari Handwritten Character Dataset, Acharya/Pant/Gyawali, UCI ML Repository #389 | devanagari | CC BY 4.0 | 32×32 images, 1700 per class; only the 33 consonants क…ह are used (conjuncts क्ष त्र ज्ञ and digits are not classes). Its own Test split is held out. Vowels: fonts only. Attribution: "DHCD, UCI Machine Learning Repository". |

No dataset was used for kana, Hangul, Thai, Arabic, Hebrew and Greek; those scripts are **synthetic
only**. The well-known sets for them (ETL for kana, PE92 / AI-Hub for Hangul, AHCD for Arabic,
HHD for Hebrew, GCDB for Greek) are – as far as known, not re-checked here – behind a registration,
a Kaggle login or a request form, or have unclear licences.

Real images are normalised like the browser does it (`real_data.browser_normalise`, mirrors
`src/vision/normalize.ts` `toCnnInput`): ink box, longest side 24 px in a 28×28 frame, stroke width
pulled into 1.7–3.3 px, blur 0.6. Cached in `data/cache/*.npz`.

### Synthesis from fonts (`synth_script.py`)

For every font × weight instance (variable fonts: wght 300 / 400 / 650, Latin: see `scripts.py`) ×
class: the outline widened by 0 / 4 / 9 px (at 120 px) **and** the skeleton (Zhang-Suen) re-drawn
with a round pen of 1.8 / 2.6 / 3.3 px (in 28×28 space) – the monoline variants look like pencil
strokes and remove the fonts' stroke contrast. Stroke width is normalised like the browser does
(no rejection), only variants whose counters filled up are dropped. Training applies the usual
`augment.py` augmentation (affine, elastic, thickness, line fragments, gaps, blur); synthetic samples
of synthetic-only scripts get strength 1.25 (Latin 1.0–1.1).

Every font must contain all classes of its script (checked with the cmap; fonts with < 80 % coverage
are skipped automatically). All fonts are from github.com/google/fonts (OFL 1.1, Kosugi / Kosugi Maru
Apache 2.0); the exact file per family is pinned in `scripts.FONT_PATHS`, local copies are
`fonts/gf-<family>.ttf` (gitignored).

Held-out ("test") fonts are never used for training; they render the test set (all variants,
3 augmented copies with a fixed seed). Their accuracy is the number for "a handwriting style the
net has not seen".

| id | training fonts | held-out test fonts | template / display font |
|---|---|---|---|
| grund | the 20 druck synthesis fonts incl. Playwrite DE Grund (wght 200/300/400) + EMNIST; synthetic share 40 % | – (test = EMNIST test) | Playwrite DE Grund (display: existing PlaywriteDEGrund.woff2) |
| schreib | 22 Playwrite cursive families: DE SAS, DE VA, DE LA, SK, HU, PL, FR Trad, IT Trad, US Trad, NL, HR, RO, NO, IS, DK Loopet, ES, PT, BR, MX, GB J, IE, NZ (wght 100/250/400) + EMNIST 15 % | Playwrite AT, Playwrite CZ | Playwrite DE SAS / VA / LA; display `schreib.woff2` = DE SAS |
| hiragana, katakana | Klee One, Zen Kurenaido, Hachi Maru Pop, Kiwi Maru, Zen Maru Gothic, M PLUS Rounded 1c, Noto Sans JP, Mochiy Pop One, Yusei Magic, Zen Kaku Gothic New, Sawarabi Gothic, Kosugi, RocknRoll One, Stick, Kaisei Opti, M PLUS 2, BIZ UDPGothic, Murecho, Potta One (19) | Yomogi, Kosugi Maru | Klee One (textbook style) |
| kyrillisch | Andika, Neucha, Caveat, Bad Script, Marck Script, Comfortaa, Didact Gothic, Ysabeau, Ysabeau Infant, Noto Sans, Open Sans, Roboto, PT Sans, Fira Sans, Montserrat, Nunito, Underdog, Kelly Slab, Amatic SC, Kurale, Pacifico, Lobster, Playpen Sans, Balsamiq Sans, Shantell Sans, Jost, Geologica, Philosopher, Oranienbaum, Podkova, Cuprum, Gentium Plus (32) + CoMNIST (60 % for the capitals and grouped small letters) | Pangolin, Arsenal | Andika → renamed "Vorlage Kyrillisch" (Reserved Font Names) |
| arabisch | Noto Naskh Arabic, Amiri, Lateef, Tajawal, Cairo, Reem Kufi, Baloo Bhaijaan 2, Changa, El Messiri, Aref Ruqaa, Marhey, Noto Kufi Arabic, Noto Sans Arabic, Mada, Lalezar, Rakkas, IBM Plex Sans Arabic, Readex Pro, Alexandria, Vibes, Playpen Sans Arabic (21) | Harmattan, Almarai | Noto Naskh Arabic |
| devanagari | Baloo 2, Hind, Sarala, Amita, Laila, Poppins, Noto Sans Devanagari, Yatra One, Martel, Tiro Devanagari Hindi, Gotu, Khand, Biryani, Sumana, Sura, Palanquin, Eczar, Karma, Rajdhani, Arya, Kurale, Halant, Jaldi, Sahitya, Khula, Amiko, Kadwa, Yantramanav, Playpen Sans Deva (29) + DHCD (65 % for consonants) | Kalam, Mukta | Baloo 2 |
| griechisch | Didact Gothic, Noto Sans, Open Sans, Roboto, Ysabeau (+Infant, +Office), GFS Didot, Commissioner, Manrope, Fira Sans (+Condensed), Arimo, Tinos, Gentium Plus, Alegreya (+Sans), Literata, Source Sans 3, Playpen Sans, Geologica, Inter, Mynerve, Play, Cousine, Noto Serif, Advent Pro, Cardo, EB Garamond, Sofia Sans, Roboto Condensed, Bona Nova, Piazzolla (33) | Comfortaa, GFS Neohellenic | Didact Gothic (letter forms of elementary education) |
| hebraeisch | Varela Round, Noto Sans Hebrew, Rubik, Heebo, Secular One, Suez One, Alef, Frank Ruhl Libre, David Libre, Miriam Libre, Karantina, Bellefair, IBM Plex Sans Hebrew, Noto Serif Hebrew, Tinos, Arimo, Amatic SC (17); not Playpen Sans Hebrew (cursive) | Assistant, Fredoka | Varela Round → renamed "Vorlage Hebraeisch" (Reserved Font Names) |
| hangul | Gowun Dodum, Nanum Pen Script, Gaegu, Hi Melody, Gamja Flower, Jua, Noto Sans KR, Sunflower, Cute Font, Yeon Sung, Dokdo, East Sea Dokdo, Single Day, Gugi, Do Hyeon, Song Myung, Stylish, Kirang Haerang, IBM Plex Sans KR, Hahmlet, Nanum Brush Script (21) | Poor Story, Nanum Gothic | Gowun Dodum |
| thai | Mali, Sriracha, Charm, Kodchasan, Sarabun, Noto Sans Thai (+Looped), IBM Plex Sans Thai Looped, Niramit, K2D, Bai Jamjuree, Mitr, Kanit, Prompt, Athiti, Pridi, Maitree, Thasadith, Chakra Petch, Srisakdi, Charmonman, Fahkwang, Taviraj, Trirong, Chonburi, Anuphan, Pattaya, Playpen Sans Thai (28) | Itim, Krub | Mali |

Display fonts are subset to exactly the class characters plus the space (schreib: the Latin/German
set of `make_webfonts.py`). Fonts with Reserved Font Names are renamed in all name records
(OFL 1.1 "Modified Version"); every woff2 has its OFL text next to it with a header naming the source.

## Results

Test = held-out real handwriting (where available) + held-out fonts, second half (first half fits
the softmax temperature). See `out/<id>/train.log` for per-epoch numbers.

| id | classes | data | test top1 | test group | real top1 / group | held-out fonts top1 / group | weakest classes | model .bin | templates .bin |
|---|---|---|---|---|---|---|---|---|---|
| grund | 63 | emnist + fonts | 78.5 % | 93.0 % | 78.5 % / 93.0 % | – / – | O 31, I 36, M 40, C 43 | 139 KB | 32 KB |
| schreib | 63 | emnist + fonts | 78.0 % | 91.5 % | 73.7 % / 89.7 % | 96.9 % / 99.7 % | O 38, 0 41, C 43, l 43 | 139 KB | 94 KB |
| hiragana | 46 | fonts only | 99.0 % | 99.0 % | – / – | 99.0 % / 99.0 % | ね 80, れ 88, わ 89, あ 100 | 120 KB | 23 KB |
| katakana | 46 | fonts only | 100.0 % | 100.0 % | – / – | 100.0 % / 100.0 % | ア 100, イ 100, ウ 100, エ 100 | 120 KB | 23 KB |
| kyrillisch | 66 | comnist + fonts | 66.2 % | 98.4 % | 65.4 % / 97.3 % | 67.1 % / 99.7 % | и 0, щ 0, ч 9, ь 13 | 142 KB | 33 KB |
| arabisch | 28 | fonts only | 98.7 % | 98.7 % | – / – | 98.7 % / 98.7 % | ن 88, ص 93, ح 96, ز 96 | 100 KB | 14 KB |
| devanagari | 44 | dhcd + fonts | 98.1 % | 98.3 % | 98.1 % / 98.4 % | 97.8 % / 97.8 % | औ 90, ज 94, द 94, घ 94 | 118 KB | 22 KB |
| griechisch | 49 | fonts only | 93.6 % | 98.7 % | – / – | 93.6 % / 98.7 % | ο 34, χ 37, γ 50, Κ 76 | 123 KB | 24 KB |
| hebraeisch | 27 | fonts only | 91.5 % | 99.4 % | – / – | 91.5 % / 99.4 % | ו 6, י 21, ך 64, ן 85 | 99 KB | 14 KB |
| hangul | 38 | fonts only | 100.0 % | 100.0 % | – / – | 100.0 % / 100.0 % | ㄱ 100, ㄴ 100, ㄷ 100, ㄹ 100 | 111 KB | 19 KB |
| thai | 44 | fonts only | 99.2 % | 99.2 % | – / – | 99.2 % / 99.2 % | ฎ 88, ง 92, ฆ 93, ป 94 | 118 KB | 22 KB |

Reading the table:

- **top1** counts the exact class, **group** also accepts a look-alike from the same group. For scripts
  with upper/lower case pairs (grund, schreib, kyrillisch, griechisch) group accuracy is the relevant
  number: the CNN input is size normalised, so о/О, и/И, ο/Ο, χ/Χ … can only be told apart by the
  glyph's height relative to its neighbours / the line, which the app has to supply.
- grund / schreib "real" = EMNIST test (print handwriting, same set druck reports 80.1 % / 93.8 % on).
  schreib's relevant number is the held-out cursive fonts (Playwrite AT / CZ): 96.9 % / 99.7 %.
- hebraeisch: ו, י and ן are nearly identical bars after size normalisation (the CNN sees ו / י as ן);
  they form one group and need the glyph's length (ן reaches below the line, י is short) to separate.
- synthetic-only scripts are measured on held-out *fonts*, not on children's handwriting; real
  accuracy on camera images will be lower. hiragana / katakana / hangul / thai / arabisch score
  98.7–100 % on unseen fonts.

History of the runs (kept in `out/`, not committed):

- arabisch, first run 92.9 %: the monoline variants of fonts with square dots (Almarai, …) lost the
  dots (Zhang-Suen deletes a 2×2 square entirely), so ج ز ض ذ ظ خ were learnt without dots.
  `synth_script.skeleton_keep_dots` puts a pen dot back for every ink component whose skeleton
  vanished; a check over the first 8 fonts of every script found such losses only in Arabic.
- hebraeisch, first run 82.2 % / 86.8 % with Amatic SC (ultra-condensed display face) held out;
  second run with "Playpen Sans Hebrew" held out scored 34 % on it because that font
  draws **Hebrew cursive** (ktav yad), a different letter form – it is now excluded entirely.
  Final: Assistant + Fredoka held out, Amatic SC used for training, י added to the ו/ן group.

## Retrain / rebuild

```bash
cd tools/train
pip install -r requirements.txt                  # + torch (CPU wheel)
python download_data.py                           # EMNIST (grund, schreib)
python download_scripts.py                        # fonts + CoMNIST + DHCD (SHA-256 checked)
python preview_script.py thai                     # out/thai/samples.png: fonts / augmented / real / test fonts
python train_script.py thai --threads 10          # out/thai/glyphnet.pt + out/thai/train.log
python export_script.py thai                      # public/model/thai/glyphnet-v1.{json,bin}
python make_templates_script.py thai              # public/model/thai/templates-v1.*, out/thai/templates.png
python make_webfonts_script.py thai               # public/fonts/thai.woff2 + OFL-thai-Mali.txt
python report_scripts.py                          # the results table above
```

`train_script.py <id> --quick` is a one-minute smoke test. Defaults (epochs, samples per class and
epoch, fonts, synthetic share) are in `scripts.py`. Each script trains in 12–25 min on CPU
(10 threads, two runs in parallel on a 24-core machine). `bash run_queue.sh <threads> <ids…>` trains
and exports several scripts in sequence. Training is deterministic up to thread scheduling.

`export_script.py` also writes `out/<id>/cnn_vectors.json` (inputs + logits from the f16 weights in
numpy) for an optional TypeScript equivalence test; it checks f16-vs-torch argmax agreement.

The druck model is **not** touched by these tools; its pipeline and outputs are unchanged.
