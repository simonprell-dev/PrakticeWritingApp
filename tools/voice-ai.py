"""Generates the spoken lines of the game (stories, hints, Riese Rumpel, Zork, the creatures) with Piper,
offline on this machine.

The lines come from voice/lines.json (npm run voice), the translations from src/i18n/locales/. For every
language there is one Piper voice (tools/.piper/voices/chosen.json); Flocke and the figures speak with the
same voice, a little higher or deeper. Out: public/voice/ai/<lang>/<id>.mp3, the id from the German text,
so the app finds the file (src/game/voice/speaker.ts). A recording in public/voice/<id>.wav always wins.

Texts with a gap ("Mauer 3 geschafft!") come from voice/fills.json (tools/voice-fills.ts): whole sentences
in s/, pieces in t/ (src/game/voice/pieces.ts). Pieces are cut close so they join without a pause.

Setup once (Windows, Git Bash):
  python -m venv tools/.piper/venv
  tools/.piper/venv/Scripts/python -m pip install piper-tts lameenc
  (voices: see the download step in the plan; they land in tools/.piper/voices/)
Run:
  tools/.piper/venv/Scripts/python tools/voice-ai.py            all languages
  tools/.piper/venv/Scripts/python tools/voice-ai.py de en      only these
Only lines whose text, voice or settings changed are made again (manifest.json per language).
"""
import hashlib
import re
import json
import sys
from pathlib import Path

import lameenc
import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
VOICES = ROOT / 'tools' / '.piper' / 'voices'
OUT = ROOT / 'public' / 'voice' / 'ai'
# pitch factor and speaking time per speaker. The pitch comes from resampling, which also makes it quicker:
# the speaking time is stretched by the same factor, so only the pitch changes. Small factors only: more
# sounds like a cartoon mouse. The narrator a little slower for young listeners, the giant deeper.
STYLE = {
    'erzaehler': (1.0, 1.06),
    'flocke': (1.1, 0.98),
    'wesen': (1.12, 1.0),
    'riese': (0.88, 1.05),
    'zork': (1.12, 0.94),
    'blase': (1.08, 1.0),
    'ausruf': (1.06, 0.96),
}
# "5× das A": the sign said as a word
TIMES = {
    'de': 'mal', 'en': 'times', 'fr': 'fois', 'es': 'veces', 'it': 'volte', 'pt': 'vezes', 'nl': 'keer',
    'pl': 'razy', 'tr': 'kez', 'uk': 'разів', 'ru': 'раз', 'el': 'φορές', 'he': 'פעמים', 'ar': 'مرات',
    'hi': 'बार', 'th': 'ครั้ง', 'ko': '번', 'ja': '回',
}
EMOJI = re.compile('[🌀-🫿☀-➿️]')


def normalize(s: str) -> str:
    """as the recording script and src/game/voice/gameVoice.ts do: no emoji, single spaces"""
    return ' '.join(EMOJI.sub('', s).split())
BITRATE = 48
VERSION = 2


def pitched(pcm: np.ndarray, factor: float) -> np.ndarray:
    """higher and quicker by resampling (a cheerful little voice)"""
    if factor == 1.0:
        return pcm
    n = int(len(pcm) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(pcm)), pcm.astype(np.float32)).astype(np.int16)


def trimmed(pcm: np.ndarray, rate: int, keep: float = 0.03) -> np.ndarray:
    """silence at both ends cut away, a little kept (a piece joins the next one without a pause)"""
    loud = np.nonzero(np.abs(pcm.astype(np.int32)) > 500)[0]
    if not len(loud):
        return pcm
    k = int(rate * keep)
    return pcm[max(0, loud[0] - k) : loud[-1] + k]


def synth(voice, text: str, speaker: str, rate: int, lang: str):
    factor, length = STYLE.get(speaker, STYLE['erzaehler'])
    said = re.sub(r'(\d)\s*×', lambda m: f"{m.group(1)} {TIMES.get(lang, '×')}", text)
    chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16) for c in voice.synthesize(said, SynthesisConfig(length_scale=length * factor))]
    if not chunks:
        return None
    return pitched(np.concatenate(chunks), factor)


def mp3(pcm: np.ndarray, rate: int) -> bytes:
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm.tobytes()) + enc.flush()


def main() -> None:
    chosen = json.loads((VOICES / 'chosen.json').read_text(encoding='utf-8'))
    langs = sys.argv[1:] or list(chosen)
    # a text with a gap is made from voice/fills.json; letters are only recorded by people
    lines = [l for l in json.loads((ROOT / 'voice' / 'lines.json').read_text(encoding='utf-8')) if not l.get('partOf') and l['speaker'] != 'buchstaben']
    fills = json.loads((ROOT / 'voice' / 'fills.json').read_text(encoding='utf-8'))
    for lang in langs:
        try:
            make(lang, chosen[lang], lines, fills.get(lang, []))
        except Exception as e:  # one language that fails (e.g. a missing helper package) does not stop the others
            print(f'{lang}: FAILED – {type(e).__name__}: {e}', flush=True)


def make(lang: str, key: str, lines: list, fills: list) -> None:
    raw = {} if lang == 'de' else json.loads((ROOT / 'src' / 'i18n' / 'locales' / f'{lang}.json').read_text(encoding='utf-8'))
    catalog = {normalize(k): normalize(v) for k, v in raw.items()}
    voice = PiperVoice.load(VOICES / f'{key}.onnx')
    rate = voice.config.sample_rate
    folder = OUT / lang
    folder.mkdir(parents=True, exist_ok=True)
    manifest_path = folder / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    made = kept = missing = 0
    jobs = []
    for line in lines:
        text = line['text'] if lang == 'de' else catalog.get(line['text'])
        if not text:
            missing += 1
            continue
        jobs.append((line['id'], line['speaker'], text, False))
    for f in fills:
        jobs.append((f['file'], f['speaker'], f['text'], f['file'].startswith('t/')))
    wanted = {j[0] for j in jobs}
    for name, speaker, text, piece in jobs:
        stamp = hashlib.sha1(f"{VERSION}|{key}|{speaker}|{STYLE.get(speaker, STYLE['erzaehler'])}|{piece}|{text}".encode()).hexdigest()[:12]
        target = folder / f'{name}.mp3'
        if manifest.get(name) == stamp and target.exists():
            kept += 1
            continue
        pcm = synth(voice, text, speaker, rate, lang)
        if pcm is None:
            # nothing to say for this voice (only a sound word or signs): the browser reads it
            manifest.pop(name, None)
            missing += 1
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(mp3(trimmed(pcm, rate) if piece else pcm, rate))
        manifest[name] = stamp
        made += 1
    # sentences and pieces no longer wanted go (the main lines stay, a recording may still refer to them)
    for sub in ('s', 't'):
        for old in (folder / sub).glob('*.mp3') if (folder / sub).exists() else []:
            name = f'{sub}/{old.stem}'
            if name not in wanted:
                old.unlink()
                manifest.pop(name, None)
    manifest_path.write_text(json.dumps(manifest, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    print(f'{lang} ({key}): {made} made, {kept} unchanged, {missing} without translation', flush=True)


if __name__ == '__main__':
    main()
