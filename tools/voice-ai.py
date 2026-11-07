"""Generates the spoken stories of the advent calendar with Piper, offline on this machine.

The lines come from voice/lines.json (npm run voice), the translations from src/i18n/locales/. For every
language there is one Piper voice (tools/.piper/voices/chosen.json); Flocke and the figures speak with the
same voice, a little higher and quicker. Out: public/voice/ai/<lang>/<id>.mp3, the id from the German text,
so the app finds the file (src/game/voice/speaker.ts). A recording in public/voice/<id>.wav always wins.

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
import json
import sys
from pathlib import Path

import lameenc
import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
VOICES = ROOT / 'tools' / '.piper' / 'voices'
OUT = ROOT / 'public' / 'voice' / 'ai'
# which lines get a generated voice: the stories behind the doors
WHERE = 'Adventskalender'
# pitch factor and speed per speaker; the narrator a little slower for young listeners
STYLE = {'erzaehler': (1.0, 1.08), 'flocke': (1.2, 0.95), 'wesen': (1.3, 0.95)}
BITRATE = 40
VERSION = 1


def pitched(pcm: np.ndarray, factor: float) -> np.ndarray:
    """higher and quicker by resampling (a cheerful little voice)"""
    if factor == 1.0:
        return pcm
    n = int(len(pcm) / factor)
    return np.interp(np.arange(n) * factor, np.arange(len(pcm)), pcm.astype(np.float32)).astype(np.int16)


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
    lines = [l for l in json.loads((ROOT / 'voice' / 'lines.json').read_text(encoding='utf-8')) if l['where'].startswith(WHERE)]
    for lang in langs:
        try:
            make(lang, chosen[lang], lines)
        except Exception as e:  # one language that fails (e.g. a missing helper package) does not stop the others
            print(f'{lang}: FAILED – {type(e).__name__}: {e}', flush=True)


def make(lang: str, key: str, lines: list) -> None:
    catalog = {} if lang == 'de' else json.loads((ROOT / 'src' / 'i18n' / 'locales' / f'{lang}.json').read_text(encoding='utf-8'))
    voice = PiperVoice.load(VOICES / f'{key}.onnx')
    rate = voice.config.sample_rate
    folder = OUT / lang
    folder.mkdir(parents=True, exist_ok=True)
    manifest_path = folder / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    made = kept = missing = 0
    for line in lines:
        text = line['text'] if lang == 'de' else catalog.get(line['text'])
        if not text:
            missing += 1
            continue
        factor, length = STYLE.get(line['speaker'], STYLE['erzaehler'])
        stamp = hashlib.sha1(f"{VERSION}|{key}|{line['speaker']}|{factor}|{length}|{text}".encode()).hexdigest()[:12]
        target = folder / f"{line['id']}.mp3"
        if manifest.get(line['id']) == stamp and target.exists():
            kept += 1
            continue
        pcm = np.concatenate([np.frombuffer(c.audio_int16_bytes, dtype=np.int16) for c in voice.synthesize(text, SynthesisConfig(length_scale=length))])
        target.write_bytes(mp3(pitched(pcm, factor), rate))
        manifest[line['id']] = stamp
        made += 1
    manifest_path.write_text(json.dumps(manifest, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    print(f'{lang} ({key}): {made} made, {kept} unchanged, {missing} without translation', flush=True)


if __name__ == '__main__':
    main()
