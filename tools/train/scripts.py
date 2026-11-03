"""Per-script configuration: one GlyphNet + template bank per writing system ("script"), never mixed.

The Latin Druckschrift model ("druck") keeps its own pipeline (train.py, export.py, make_templates.py)
and its outputs in public/model/*. Every other script is trained by train_script.py and exported to
public/model/<id>/ by export_script.py and make_templates_script.py (see SCRIPTS.md).

Fonts: all from github.com/google/fonts (OFL or Apache). A font is referenced by its family directory
name in google/fonts; FONT_PATHS pins the file inside it and the local copy is
tools/train/fonts/gf-<family>.ttf. Legacy Latin font file names from common.FONT_LIST also work.
"""
from dataclasses import dataclass, field

from common import CHARSET, FONTS, GROUPS, SYNTH_FONTS

# family directory -> file inside github.com/google/fonts (Regular, else the variable font)
FONT_PATHS = {
    "kleeone": "ofl/kleeone/KleeOne-Regular.ttf",
    "yomogi": "ofl/yomogi/Yomogi-Regular.ttf",
    "zenkurenaido": "ofl/zenkurenaido/ZenKurenaido-Regular.ttf",
    "hachimarupop": "ofl/hachimarupop/HachiMaruPop-Regular.ttf",
    "kiwimaru": "ofl/kiwimaru/KiwiMaru-Regular.ttf",
    "zenmarugothic": "ofl/zenmarugothic/ZenMaruGothic-Regular.ttf",
    "mplusrounded1c": "ofl/mplusrounded1c/MPLUSRounded1c-Regular.ttf",
    "notosansjp": "ofl/notosansjp/NotoSansJP[wght].ttf",
    "mochiypopone": "ofl/mochiypopone/MochiyPopOne-Regular.ttf",
    "yuseimagic": "ofl/yuseimagic/YuseiMagic-Regular.ttf",
    "zenkakugothicnew": "ofl/zenkakugothicnew/ZenKakuGothicNew-Regular.ttf",
    "sawarabigothic": "ofl/sawarabigothic/SawarabiGothic-Regular.ttf",
    "kosugimaru": "apache/kosugimaru/KosugiMaru-Regular.ttf",
    "kosugi": "apache/kosugi/Kosugi-Regular.ttf",
    "rocknrollone": "ofl/rocknrollone/RocknRollOne-Regular.ttf",
    "stick": "ofl/stick/Stick-Regular.ttf",
    "kaiseiopti": "ofl/kaiseiopti/KaiseiOpti-Regular.ttf",
    "mplus2": "ofl/mplus2/MPLUS2[wght].ttf",
    "bizudpgothic": "ofl/bizudpgothic/BIZUDPGothic-Regular.ttf",
    "murecho": "ofl/murecho/Murecho[wght].ttf",
    "pottaone": "ofl/pottaone/PottaOne-Regular.ttf",
    "gowundodum": "ofl/gowundodum/GowunDodum-Regular.ttf",
    "nanumpenscript": "ofl/nanumpenscript/NanumPenScript-Regular.ttf",
    "gaegu": "ofl/gaegu/Gaegu-Regular.ttf",
    "himelody": "ofl/himelody/HiMelody-Regular.ttf",
    "poorstory": "ofl/poorstory/PoorStory-Regular.ttf",
    "gamjaflower": "ofl/gamjaflower/GamjaFlower-Regular.ttf",
    "jua": "ofl/jua/Jua-Regular.ttf",
    "notosanskr": "ofl/notosanskr/NotoSansKR[wght].ttf",
    "nanumgothic": "ofl/nanumgothic/NanumGothic-Regular.ttf",
    "sunflower": "ofl/sunflower/Sunflower-Medium.ttf",
    "cutefont": "ofl/cutefont/CuteFont-Regular.ttf",
    "yeonsung": "ofl/yeonsung/YeonSung-Regular.ttf",
    "dokdo": "ofl/dokdo/Dokdo-Regular.ttf",
    "eastseadokdo": "ofl/eastseadokdo/EastSeaDokdo-Regular.ttf",
    "singleday": "ofl/singleday/SingleDay-Regular.ttf",
    "gugi": "ofl/gugi/Gugi-Regular.ttf",
    "dohyeon": "ofl/dohyeon/DoHyeon-Regular.ttf",
    "songmyung": "ofl/songmyung/SongMyung-Regular.ttf",
    "stylish": "ofl/stylish/Stylish-Regular.ttf",
    "kiranghaerang": "ofl/kiranghaerang/KirangHaerang-Regular.ttf",
    "ibmplexsanskr": "ofl/ibmplexsanskr/IBMPlexSansKR-Regular.ttf",
    "hahmlet": "ofl/hahmlet/Hahmlet[wght].ttf",
    "nanumbrushscript": "ofl/nanumbrushscript/NanumBrushScript-Regular.ttf",
    "mali": "ofl/mali/Mali-Regular.ttf",
    "itim": "ofl/itim/Itim-Regular.ttf",
    "sriracha": "ofl/sriracha/Sriracha-Regular.ttf",
    "charm": "ofl/charm/Charm-Regular.ttf",
    "kodchasan": "ofl/kodchasan/Kodchasan-Regular.ttf",
    "krub": "ofl/krub/Krub-Regular.ttf",
    "sarabun": "ofl/sarabun/Sarabun-Regular.ttf",
    "notosansthai": "ofl/notosansthai/NotoSansThai[wdth,wght].ttf",
    "notosansthailooped": "ofl/notosansthailooped/NotoSansThaiLooped[wdth,wght].ttf",
    "ibmplexsansthailooped": "ofl/ibmplexsansthailooped/IBMPlexSansThaiLooped-Regular.ttf",
    "niramit": "ofl/niramit/Niramit-Regular.ttf",
    "k2d": "ofl/k2d/K2D-Regular.ttf",
    "baijamjuree": "ofl/baijamjuree/BaiJamjuree-Regular.ttf",
    "mitr": "ofl/mitr/Mitr-Regular.ttf",
    "kanit": "ofl/kanit/Kanit-Regular.ttf",
    "prompt": "ofl/prompt/Prompt-Regular.ttf",
    "athiti": "ofl/athiti/Athiti-Regular.ttf",
    "pridi": "ofl/pridi/Pridi-Regular.ttf",
    "maitree": "ofl/maitree/Maitree-Regular.ttf",
    "thasadith": "ofl/thasadith/Thasadith-Regular.ttf",
    "chakrapetch": "ofl/chakrapetch/ChakraPetch-Regular.ttf",
    "srisakdi": "ofl/srisakdi/Srisakdi-Regular.ttf",
    "charmonman": "ofl/charmonman/Charmonman-Regular.ttf",
    "fahkwang": "ofl/fahkwang/Fahkwang-Regular.ttf",
    "taviraj": "ofl/taviraj/Taviraj-Regular.ttf",
    "trirong": "ofl/trirong/Trirong-Regular.ttf",
    "chonburi": "ofl/chonburi/Chonburi-Regular.ttf",
    "anuphan": "ofl/anuphan/Anuphan[wght].ttf",
    "pattaya": "ofl/pattaya/Pattaya-Regular.ttf",
    "playpensansthai": "ofl/playpensansthai/PlaypenSansThai[wght].ttf",
    "notonaskharabic": "ofl/notonaskharabic/NotoNaskhArabic[wght].ttf",
    "amiri": "ofl/amiri/Amiri-Regular.ttf",
    "lateef": "ofl/lateef/Lateef-Regular.ttf",
    "harmattan": "ofl/harmattan/Harmattan-Regular.ttf",
    "tajawal": "ofl/tajawal/Tajawal-Regular.ttf",
    "cairo": "ofl/cairo/Cairo[slnt,wght].ttf",
    "reemkufi": "ofl/reemkufi/ReemKufi[wght].ttf",
    "baloobhaijaan2": "ofl/baloobhaijaan2/BalooBhaijaan2[wght].ttf",
    "changa": "ofl/changa/Changa[wght].ttf",
    "elmessiri": "ofl/elmessiri/ElMessiri[wght].ttf",
    "arefruqaa": "ofl/arefruqaa/ArefRuqaa-Regular.ttf",
    "marhey": "ofl/marhey/Marhey[wght].ttf",
    "notokufiarabic": "ofl/notokufiarabic/NotoKufiArabic[wght].ttf",
    "notosansarabic": "ofl/notosansarabic/NotoSansArabic[wdth,wght].ttf",
    "almarai": "ofl/almarai/Almarai-Regular.ttf",
    "mada": "ofl/mada/Mada[wght].ttf",
    "lalezar": "ofl/lalezar/Lalezar-Regular.ttf",
    "rakkas": "ofl/rakkas/Rakkas-Regular.ttf",
    "ibmplexsansarabic": "ofl/ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf",
    "readexpro": "ofl/readexpro/ReadexPro[HEXP,wght].ttf",
    "alexandria": "ofl/alexandria/Alexandria[wght].ttf",
    "vibes": "ofl/vibes/Vibes-Regular.ttf",
    "playpensansarabic": "ofl/playpensansarabic/PlaypenSansArabic[wght].ttf",
    "varelaround": "ofl/varelaround/VarelaRound-Regular.ttf",
    "notosanshebrew": "ofl/notosanshebrew/NotoSansHebrew[wdth,wght].ttf",
    "rubik": "ofl/rubik/Rubik[wght].ttf",
    "assistant": "ofl/assistant/Assistant[wght].ttf",
    "heebo": "ofl/heebo/Heebo[wght].ttf",
    "amaticsc": "ofl/amaticsc/AmaticSC-Regular.ttf",
    "secularone": "ofl/secularone/SecularOne-Regular.ttf",
    "suezone": "ofl/suezone/SuezOne-Regular.ttf",
    "alef": "ofl/alef/Alef-Regular.ttf",
    "frankruhllibre": "ofl/frankruhllibre/FrankRuhlLibre[wght].ttf",
    "davidlibre": "ofl/davidlibre/DavidLibre-Regular.ttf",
    "miriamlibre": "ofl/miriamlibre/MiriamLibre[wght].ttf",
    "karantina": "ofl/karantina/Karantina-Regular.ttf",
    "bellefair": "ofl/bellefair/Bellefair-Regular.ttf",
    "ibmplexsanshebrew": "ofl/ibmplexsanshebrew/IBMPlexSansHebrew-Regular.ttf",
    "notoserifhebrew": "ofl/notoserifhebrew/NotoSerifHebrew[wdth,wght].ttf",
    "tinos": "ofl/tinos/Tinos-Regular.ttf",
    "arimo": "ofl/arimo/Arimo[wght].ttf",
    "fredoka": "ofl/fredoka/Fredoka[wdth,wght].ttf",
    "playpensanshebrew": "ofl/playpensanshebrew/PlaypenSansHebrew[wght].ttf",
    "baloo2": "ofl/baloo2/Baloo2[wght].ttf",
    "kalam": "ofl/kalam/Kalam-Regular.ttf",
    "hind": "ofl/hind/Hind-Regular.ttf",
    "mukta": "ofl/mukta/Mukta-Regular.ttf",
    "sarala": "ofl/sarala/Sarala-Regular.ttf",
    "amita": "ofl/amita/Amita-Regular.ttf",
    "laila": "ofl/laila/Laila-Regular.ttf",
    "poppins": "ofl/poppins/Poppins-Regular.ttf",
    "notosansdevanagari": "ofl/notosansdevanagari/NotoSansDevanagari[wdth,wght].ttf",
    "yatraone": "ofl/yatraone/YatraOne-Regular.ttf",
    "martel": "ofl/martel/Martel-Regular.ttf",
    "tirodevanagarihindi": "ofl/tirodevanagarihindi/TiroDevanagariHindi-Regular.ttf",
    "gotu": "ofl/gotu/Gotu-Regular.ttf",
    "khand": "ofl/khand/Khand-Regular.ttf",
    "biryani": "ofl/biryani/Biryani-Regular.ttf",
    "sumana": "ofl/sumana/Sumana-Regular.ttf",
    "sura": "ofl/sura/Sura-Regular.ttf",
    "palanquin": "ofl/palanquin/Palanquin-Regular.ttf",
    "eczar": "ofl/eczar/Eczar[wght].ttf",
    "karma": "ofl/karma/Karma-Regular.ttf",
    "rajdhani": "ofl/rajdhani/Rajdhani-Regular.ttf",
    "arya": "ofl/arya/Arya-Regular.ttf",
    "kurale": "ofl/kurale/Kurale-Regular.ttf",
    "halant": "ofl/halant/Halant-Regular.ttf",
    "jaldi": "ofl/jaldi/Jaldi-Regular.ttf",
    "sahitya": "ofl/sahitya/Sahitya-Regular.ttf",
    "khula": "ofl/khula/Khula-Regular.ttf",
    "amiko": "ofl/amiko/Amiko-Regular.ttf",
    "kadwa": "ofl/kadwa/Kadwa-Regular.ttf",
    "yantramanav": "ofl/yantramanav/Yantramanav-Regular.ttf",
    "baloobhai2": "ofl/baloobhai2/BalooBhai2[wght].ttf",
    "playpensansdeva": "ofl/playpensansdeva/PlaypenSansDeva[wght].ttf",
    "andika": "ofl/andika/Andika-Regular.ttf",
    "notosans": "ofl/notosans/NotoSans[wdth,wght].ttf",
    "opensans": "ofl/opensans/OpenSans[wdth,wght].ttf",
    "roboto": "ofl/roboto/Roboto[wdth,wght].ttf",
    "comfortaa": "ofl/comfortaa/Comfortaa[wght].ttf",
    "didactgothic": "ofl/didactgothic/DidactGothic-Regular.ttf",
    "ysabeau": "ofl/ysabeau/Ysabeau[wght].ttf",
    "ysabeauinfant": "ofl/ysabeauinfant/YsabeauInfant[wght].ttf",
    "gfsdidot": "ofl/gfsdidot/GFSDidot-Regular.ttf",
    "gfsneohellenic": "ofl/gfsneohellenic/GFSNeohellenic.ttf",
    "caveat": "ofl/caveat/Caveat[wght].ttf",
    "commissioner": "ofl/commissioner/Commissioner[FLAR,VOLM,slnt,wght].ttf",
    "manrope": "ofl/manrope/Manrope[wght].ttf",
    "firasans": "ofl/firasans/FiraSans-Regular.ttf",
    "gentiumplus": "ofl/gentiumplus/GentiumPlus-Regular.ttf",
    "alegreya": "ofl/alegreya/Alegreya[wght].ttf",
    "literata": "ofl/literata/Literata[opsz,wght].ttf",
    "sourcesans3": "ofl/sourcesans3/SourceSans3[wght].ttf",
    "playpensans": "ofl/playpensans/PlaypenSans[wght].ttf",
    "geologica": "ofl/geologica/Geologica[CRSV,SHRP,slnt,wght].ttf",
    "jost": "ofl/jost/Jost[wght].ttf",
    "shantellsans": "ofl/shantellsans/ShantellSans[BNCE,INFM,SPAC,wght].ttf",
    "balsamiqsans": "ofl/balsamiqsans/BalsamiqSans-Regular.ttf",
    "neucha": "ofl/neucha/Neucha.ttf",
    "badscript": "ofl/badscript/BadScript-Regular.ttf",
    "marckscript": "ofl/marckscript/MarckScript-Regular.ttf",
    "ptsans": "ofl/ptsans/PT_Sans-Web-Regular.ttf",
    "montserrat": "ofl/montserrat/Montserrat[wght].ttf",
    "nunito": "ofl/nunito/Nunito[wght].ttf",
    "pangolin": "ofl/pangolin/Pangolin-Regular.ttf",
    "underdog": "ofl/underdog/Underdog-Regular.ttf",
    "kellyslab": "ofl/kellyslab/KellySlab-Regular.ttf",
    "pacifico": "ofl/pacifico/Pacifico-Regular.ttf",
    "lobster": "ofl/lobster/Lobster-Regular.ttf",
    "philosopher": "ofl/philosopher/Philosopher-Regular.ttf",
    "oranienbaum": "ofl/oranienbaum/Oranienbaum-Regular.ttf",
    "podkova": "ofl/podkova/Podkova[wght].ttf",
    "cuprum": "ofl/cuprum/Cuprum[wght].ttf",
    "arsenal": "ofl/arsenal/Arsenal-Regular.ttf",
    "playwritedesas": "ofl/playwritedesas/PlaywriteDESAS[wght].ttf",
    "playwritedeva": "ofl/playwritedeva/PlaywriteDEVA[wght].ttf",
    "playwritedela": "ofl/playwritedela/PlaywriteDELA[wght].ttf",
    "playwriteat": "ofl/playwriteat/PlaywriteAT[wght].ttf",
    "playwritecz": "ofl/playwritecz/PlaywriteCZ[wght].ttf",
    "playwritesk": "ofl/playwritesk/PlaywriteSK[wght].ttf",
    "playwritehu": "ofl/playwritehu/PlaywriteHU[wght].ttf",
    "playwritepl": "ofl/playwritepl/PlaywritePL[wght].ttf",
    "playwritefrtrad": "ofl/playwritefrtrad/PlaywriteFRTrad[wght].ttf",
    "playwriteittrad": "ofl/playwriteittrad/PlaywriteITTrad[wght].ttf",
    "playwriteustrad": "ofl/playwriteustrad/PlaywriteUSTrad[wght].ttf",
    "playwritenl": "ofl/playwritenl/PlaywriteNL[wght].ttf",
    "playwritehr": "ofl/playwritehr/PlaywriteHR[wght].ttf",
    "playwritero": "ofl/playwritero/PlaywriteRO[wght].ttf",
    "playwriteno": "ofl/playwriteno/PlaywriteNO[wght].ttf",
    "playwriteis": "ofl/playwriteis/PlaywriteIS[wght].ttf",
    "playwritedkloopet": "ofl/playwritedkloopet/PlaywriteDKLoopet[wght].ttf",
    "playwritees": "ofl/playwritees/PlaywriteES[wght].ttf",
    "playwritept": "ofl/playwritept/PlaywritePT[wght].ttf",
    "playwritebr": "ofl/playwritebr/PlaywriteBR[wght].ttf",
    "playwritemx": "ofl/playwritemx/PlaywriteMX[wght].ttf",
    "playwritegbj": "ofl/playwritegbj/PlaywriteGBJ[wght].ttf",
    "playwriteie": "ofl/playwriteie/PlaywriteIE[wght].ttf",
    "playwritenz": "ofl/playwritenz/PlaywriteNZ[wght].ttf",
    "ysabeauoffice": "ofl/ysabeauoffice/YsabeauOffice[wght].ttf",
    "inter": "ofl/inter/Inter[opsz,wght].ttf",
    "mynerve": "ofl/mynerve/Mynerve-Regular.ttf",
    "play": "ofl/play/Play-Regular.ttf",
    "cousine": "ofl/cousine/Cousine-Regular.ttf",
    "notoserif": "ofl/notoserif/NotoSerif[wdth,wght].ttf",
    "adventpro": "ofl/adventpro/AdventPro[wdth,wght].ttf",
    "alegreyasans": "ofl/alegreyasans/AlegreyaSans-Regular.ttf",
    "firasanscondensed": "ofl/firasanscondensed/FiraSansCondensed-Regular.ttf",
    "cardo": "ofl/cardo/Cardo-Regular.ttf",
    "ebgaramond": "ofl/ebgaramond/EBGaramond[wght].ttf",
    "sofiasans": "ofl/sofiasans/SofiaSans[wght].ttf",
    "robotocondensed": "ofl/robotocondensed/RobotoCondensed[wght].ttf",
    "bonanova": "ofl/bonanova/BonaNova-Regular.ttf",
    "piazzolla": "ofl/piazzolla/Piazzolla[opsz,wght].ttf",
}


def font_file(family: str):
    """Local path of a google/fonts family; legacy Latin file names (common.FONT_LIST) pass through."""
    if family in FONT_PATHS:
        return FONTS / f"gf-{family}.ttf"
    return FONTS / family


def font_url(family: str) -> str:
    return FONT_PATHS[family].replace("[", "%5B").replace("]", "%5D")


def licence_dir(family: str) -> str:
    """google/fonts directory of a family (holds OFL.txt or LICENSE.txt)."""
    return FONT_PATHS[family].rsplit("/", 1)[0]


@dataclass
class Script:
    id: str
    name: str
    classes: list[str]
    groups: list[str] = field(default_factory=list)  # strings of class characters that look alike
    templates: list[tuple[str, str]] = field(default_factory=list)  # (font family, template style)
    synth: list[str] = field(default_factory=list)  # synthesis fonts used for training
    test_fonts: list[str] = field(default_factory=list)  # held out: only used for the test split
    real: str | None = None  # real handwriting: "emnist" | "comnist" | "dhcd"
    synth_share: float = 1.0  # share of synthetic samples for classes that also have real data
    synth_aug: float = 1.25  # augmentation strength for synthetic samples
    display: str | None = None  # family subset to public/fonts/<id>.woff2 (None: Latin, reuse)
    metrics: str = "em"  # template metrics: "xheight" (Latin, like druck) or "em"
    per_class: int = 3000  # samples per class and epoch
    epochs: int = 18
    weights: tuple[int, ...] = (300, 400, 650)  # wght instances rendered for variable fonts
    strokes: tuple[int, ...] = (0, 4, 9)  # extra outline width (px at 120 px) for synthesis


def _rng(a: str, b: str, skip: str = "") -> list[str]:
    return [chr(c) for c in range(ord(a), ord(b) + 1) if chr(c) not in skip]


HIRAGANA = list("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん")
KATAKANA = list("アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン")
JP_FONTS = ["kleeone", "zenkurenaido", "hachimarupop", "kiwimaru", "zenmarugothic", "mplusrounded1c",
            "notosansjp", "mochiypopone", "yuseimagic", "zenkakugothicnew", "sawarabigothic", "kosugi",
            "rocknrollone", "stick", "kaiseiopti", "mplus2", "bizudpgothic", "murecho", "pottaone"]
JP_TEST = ["yomogi", "kosugimaru"]

CYR_UP = _rng("А", "Е") + ["Ё"] + _rng("Ж", "Я")
CYR_LO = _rng("а", "е") + ["ё"] + _rng("ж", "я")
# lower case letters that are a smaller copy of the capital (the CNN input is size normalised)
CYR_GROUPS = [u + l for u, l in zip(CYR_UP, CYR_LO) if u not in "АБЕЁ"]

ARABIC = list("ابتثجحخدذرزسشصضطظعغفقكلمنهوي")
DEVA_VOWELS = list("अआइईउऊएऐओऔऋ")
DEVA_CONS = list("कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह")
GREEK = _rng("Α", "Ω", skip="΢") + _rng("α", "ω", skip="ς") + ["ς"]
HEBREW = list("אבגדהוזחטיכלמנסעפצקרשת") + list("ךםןףץ")
HANGUL = list("ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ") + list("ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ") + list("가나다라마바사아자차카타파하")
THAI = _rng("ก", "ฮ", skip="ฤฦ")

CURSIVE = ["playwritedesas", "playwritedeva", "playwritedela", "playwritesk", "playwritehu", "playwritepl",
           "playwritefrtrad", "playwriteittrad", "playwriteustrad", "playwritenl", "playwritehr",
           "playwritero", "playwriteno", "playwriteis", "playwritedkloopet", "playwritees", "playwritept",
           "playwritebr", "playwritemx", "playwritegbj", "playwriteie", "playwritenz"]

SCRIPTS: dict[str, Script] = {}


def _add(s: Script) -> None:
    assert len(set(s.classes)) == len(s.classes), s.id
    for g in s.groups:
        assert all(c in s.classes for c in g), (s.id, g)
    assert not set(s.synth) & set(s.test_fonts), s.id
    SCRIPTS[s.id] = s


_add(Script(
    "grund", "Grundschrift", list(CHARSET), list(GROUPS),
    templates=[("PlaywriteDEGrund.ttf", "grund")],
    synth=list(SYNTH_FONTS), real="emnist", synth_share=0.4, synth_aug=1.0, metrics="xheight",
    per_class=2500, epochs=15, weights=(200, 300, 400),
))
_add(Script(
    "schreib", "Schreibschrift (Einzelbuchstaben)", list(CHARSET), list(GROUPS),
    templates=[("playwritedesas", "sas"), ("playwritedeva", "va"), ("playwritedela", "la")],
    synth=CURSIVE, test_fonts=["playwriteat", "playwritecz"], real="emnist", synth_share=0.85,
    synth_aug=1.1, display="playwritedesas", metrics="xheight", per_class=2500, epochs=15,
    weights=(100, 250, 400),
))
_add(Script("hiragana", "Hiragana", HIRAGANA, templates=[("kleeone", "hiragana")], synth=JP_FONTS,
            test_fonts=JP_TEST, display="kleeone"))
_add(Script("katakana", "Katakana", KATAKANA, templates=[("kleeone", "katakana")], synth=JP_FONTS,
            test_fonts=JP_TEST, display="kleeone"))
_add(Script(
    "kyrillisch", "Kyrillisch (Russisch)", CYR_UP + CYR_LO, CYR_GROUPS,
    templates=[("andika", "kyrillisch")],
    synth=["andika", "neucha", "caveat", "badscript", "marckscript", "comfortaa", "didactgothic", "ysabeau",
           "ysabeauinfant", "notosans", "opensans", "roboto", "ptsans", "firasans", "montserrat", "nunito",
           "underdog", "kellyslab", "amaticsc", "kurale", "pacifico", "lobster", "playpensans", "balsamiqsans",
           "shantellsans", "jost", "geologica", "philosopher", "oranienbaum", "podkova", "cuprum",
           "gentiumplus"],
    test_fonts=["pangolin", "arsenal"], real="comnist", synth_share=0.4, display="andika",
))
_add(Script(
    "arabisch", "Arabisch", ARABIC, [],
    templates=[("notonaskharabic", "arabisch")],
    synth=["notonaskharabic", "amiri", "lateef", "tajawal", "cairo", "reemkufi", "baloobhaijaan2", "changa",
           "elmessiri", "arefruqaa", "marhey", "notokufiarabic", "notosansarabic", "mada", "lalezar", "rakkas",
           "ibmplexsansarabic", "readexpro", "alexandria", "vibes", "playpensansarabic"],
    test_fonts=["harmattan", "almarai"], display="notonaskharabic",
))
_add(Script(
    "devanagari", "Devanagari (Hindi)", DEVA_VOWELS + DEVA_CONS, ["घध", "बव", "भम"],
    templates=[("baloo2", "devanagari")],
    synth=["baloo2", "hind", "sarala", "amita", "laila", "poppins", "notosansdevanagari", "yatraone", "martel",
           "tirodevanagarihindi", "gotu", "khand", "biryani", "sumana", "sura", "palanquin", "eczar", "karma",
           "rajdhani", "arya", "kurale", "halant", "jaldi", "sahitya", "khula", "amiko", "kadwa", "yantramanav",
           "playpensansdeva"],
    test_fonts=["kalam", "mukta"], real="dhcd", synth_share=0.35, display="baloo2",
))
_add(Script(
    "griechisch", "Griechisch", GREEK,
    ["Οο", "Κκ", "Χχ", "Ψψ", "Ππ", "Ττ", "Ιι", "Θθ", "Φφ", "Ρρ", "Ββ"],
    templates=[("didactgothic", "griechisch")],
    synth=["didactgothic", "notosans", "opensans", "roboto", "ysabeau", "ysabeauinfant", "ysabeauoffice",
           "gfsdidot", "commissioner", "manrope", "firasans", "firasanscondensed", "arimo", "tinos", "gentiumplus",
           "alegreya", "alegreyasans", "literata", "sourcesans3", "playpensans", "geologica", "inter", "mynerve",
           "play", "cousine", "notoserif", "adventpro", "cardo", "ebgaramond", "sofiasans", "robotocondensed",
           "bonanova", "piazzolla"],
    test_fonts=["comfortaa", "gfsneohellenic"], display="didactgothic",
))
_add(Script(
    "hebraeisch", "Hebräisch", HEBREW, ["וין", "דרך", "הח", "בכ", "סם"],
    templates=[("varelaround", "hebraeisch")],
    synth=["varelaround", "notosanshebrew", "rubik", "heebo", "secularone", "suezone", "alef", "frankruhllibre",
           "davidlibre", "miriamlibre", "karantina", "bellefair", "ibmplexsanshebrew", "notoserifhebrew", "tinos",
           "arimo", "amaticsc"],
    # not used: Playpen Sans Hebrew draws Hebrew cursive (ktav yad), not the block letters
    test_fonts=["assistant", "fredoka"], display="varelaround",
))
_add(Script(
    "hangul", "Hangul", HANGUL, [],
    templates=[("gowundodum", "hangul")],
    synth=["gowundodum", "nanumpenscript", "gaegu", "himelody", "gamjaflower", "jua", "notosanskr", "sunflower",
           "cutefont", "yeonsung", "dokdo", "eastseadokdo", "singleday", "gugi", "dohyeon", "songmyung",
           "stylish", "kiranghaerang", "ibmplexsanskr", "hahmlet", "nanumbrushscript"],
    test_fonts=["poorstory", "nanumgothic"], display="gowundodum",
))
_add(Script(
    "thai", "Thailändisch", THAI, ["ขฃ", "คฅ"],
    templates=[("mali", "thai")],
    synth=["mali", "sriracha", "charm", "kodchasan", "sarabun", "notosansthai", "notosansthailooped",
           "ibmplexsansthailooped", "niramit", "k2d", "baijamjuree", "mitr", "kanit", "prompt", "athiti", "pridi",
           "maitree", "thasadith", "chakrapetch", "srisakdi", "charmonman", "fahkwang", "taviraj", "trirong",
           "chonburi", "anuphan", "pattaya", "playpensansthai"],
    test_fonts=["itim", "krub"], display="mali",
))


def all_families() -> list[str]:
    fams = []
    for s in SCRIPTS.values():
        for f in s.synth + s.test_fonts + [t for t, _ in s.templates] + ([s.display] if s.display else []):
            if f in FONT_PATHS and f not in fams:
                fams.append(f)
    return fams
