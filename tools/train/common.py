"""Shared constants for the GlyphNet training tools."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
DATA = ROOT / "data"
FONTS = ROOT / "fonts"
OUT_MODEL = REPO / "public" / "model"
OUT_FIXTURES = REPO / "test" / "fixtures"

# EMNIST byclass order (0-9, A-Z, a-z) plus German sharp s, which only comes from font synthesis.
CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzß"
NUM_CLASSES = len(CHARSET)
EMNIST_CLASSES = 62

# Characters that look the same in isolation (must match src/recog/classes.ts).
GROUPS = ["0Oo", "1Il", "cC", "kK", "mM", "pP", "sS", "uU", "vV", "wW", "xX", "yY", "zZ", "jJ"]

# EMNIST-style normalisation used for the CNN input (must match src/vision/normalize.ts).
CNN_SIZE = 28
CNN_FIT = 24  # longest side of the glyph box inside the 28x28 frame (EMNIST pads 2px after centring)

# Template rendering (must match src/recog/templates.ts).
TPL_SIZE = 64
TPL_FIT = 56

# Fonts: (file name, url path in github.com/google/fonts, role)
#   role "template": used for the beauty templates (Druckschrift / Grundschrift)
#   role "synth": only used for synthetic training glyphs
GOOGLE_FONTS = "https://github.com/google/fonts/raw/main/"
FONT_LIST = [
    ("Andika-Regular.ttf", "ofl/andika/Andika-Regular.ttf", "template"),
    ("PlaywriteDEGrund.ttf", "ofl/playwritedegrund/PlaywriteDEGrund%5Bwght%5D.ttf", "template"),
    ("Fredoka.ttf", "ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf", "ui"),
    ("ComicNeue-Regular.ttf", "ofl/comicneue/ComicNeue-Regular.ttf", "synth"),
    ("PatrickHand-Regular.ttf", "ofl/patrickhand/PatrickHand-Regular.ttf", "synth"),
    ("Schoolbell-Regular.ttf", "apache/schoolbell/Schoolbell-Regular.ttf", "synth"),
    ("PlaypenSans.ttf", "ofl/playpensans/PlaypenSans%5Bwght%5D.ttf", "synth"),
    ("Delius-Regular.ttf", "ofl/delius/Delius-Regular.ttf", "synth"),
    ("ShortStack-Regular.ttf", "ofl/shortstack/ShortStack-Regular.ttf", "synth"),
    ("IndieFlower-Regular.ttf", "ofl/indieflower/IndieFlower-Regular.ttf", "synth"),
    ("GochiHand-Regular.ttf", "ofl/gochihand/GochiHand-Regular.ttf", "synth"),
    ("Kalam-Regular.ttf", "ofl/kalam/Kalam-Regular.ttf", "synth"),
    ("JustAnotherHand-Regular.ttf", "apache/justanotherhand/JustAnotherHand-Regular.ttf", "synth"),
    ("ArchitectsDaughter-Regular.ttf", "ofl/architectsdaughter/ArchitectsDaughter-Regular.ttf", "synth"),
    ("ComingSoon-Regular.ttf", "apache/comingsoon/ComingSoon-Regular.ttf", "synth"),
    ("SueEllenFrancisco-Regular.ttf", "ofl/sueellenfrancisco/SueEllenFrancisco-Regular.ttf", "synth"),
    ("Handlee-Regular.ttf", "ofl/handlee/Handlee-Regular.ttf", "synth"),
    ("Neucha.ttf", "ofl/neucha/Neucha.ttf", "synth"),
    ("Mali-Regular.ttf", "ofl/mali/Mali-Regular.ttf", "synth"),
    ("Itim-Regular.ttf", "ofl/itim/Itim-Regular.ttf", "synth"),
    ("Sniglet-Regular.ttf", "ofl/sniglet/Sniglet-Regular.ttf", "synth"),
]
TEMPLATE_FONTS = [f for f, _, role in FONT_LIST if role == "template"]
SYNTH_FONTS = [f for f, _, role in FONT_LIST if role in ("template", "synth")]
