"""
63 fish species definitions across 5 rarity tiers.

The 8 species that already exist in the game's FishData.ts use their real
ids (sunfish, river-perch, silver-trout, banded-bass, moonfin-pike,
glassback-eel, gilded-koi, phantom-leviathan) so the art maps 1:1 to game
data. The rest are new species the data layer can adopt as the roster grows.

Each entry: id, name, rarity, shape, pattern, size, and a palette
(base/back/belly/fin/accent, plus optional glow for high tiers).
"""

SHAPES = ["trout", "bass", "eel", "pike", "koi", "round", "catfish", "leviathan"]
PATTERNS = ["plain", "stripes_v", "stripe_h", "spots", "mottled", "bands", "gradient_glow"]


def pal(base, back, belly, fin, accent, glow=None):
    p = {"base": base, "back": back, "belly": belly, "fin": fin, "accent": accent}
    if glow:
        p["glow"] = glow
    return p


# Helper colour families
def _earthy(h):  # olive/brown range
    table = {
        "olive": (118, 134, 70), "brown": (132, 96, 58), "tan": (170, 140, 92),
        "green": (96, 140, 84), "darkgreen": (70, 104, 64), "bronze": (150, 116, 60),
    }
    return table[h]


# ---------------------------------------------------------------------------
# COMMON (30) — earthy, muted, simple patterns, mostly small/medium
# ---------------------------------------------------------------------------
COMMON = [
    ("sunfish", "Sunfish", "round", "spots", "s", pal((196,170,86),(150,120,60),(232,214,150),(150,120,60),(120,90,50))),
    ("river-perch", "River Perch", "bass", "bands", "s", pal((150,158,92),(96,110,60),(206,200,150),(110,118,66),(74,90,52))),
    ("bluegill", "Bluegill", "round", "stripe_h", "s", pal((110,140,150),(64,96,110),(200,210,200),(70,100,110),(190,150,80))),
    ("creek-chub", "Creek Chub", "trout", "plain", "s", pal((150,140,120),(100,92,78),(214,206,188),(110,100,86),(90,84,70))),
    ("mud-minnow", "Mud Minnow", "trout", "mottled", "s", pal((120,104,80),(84,72,54),(170,154,120),(90,78,58),(70,60,44))),
    ("smelt", "Smelt", "trout", "plain", "s", pal((176,184,176),(120,132,128),(224,228,224),(130,140,136),(150,160,150))),
    ("dace", "Dace", "trout", "stripe_h", "s", pal((158,164,150),(108,116,104),(216,218,206),(116,124,112),(120,90,70))),
    ("common-roach", "Common Roach", "bass", "plain", "s", pal((164,160,150),(112,108,100),(220,216,208),(170,120,70),(150,90,60))),
    ("rudd", "Rudd", "bass", "plain", "s", pal((176,150,96),(120,100,60),(226,206,150),(180,110,70),(160,90,60))),
    ("yellow-perch", "Yellow Perch", "bass", "bands", "s", pal((196,176,86),(150,128,52),(224,210,150),(120,100,52),(80,96,50))),
    ("brook-trout", "Brook Trout", "trout", "spots", "m", pal((128,118,86),(86,78,54),(196,170,130),(120,90,70),(180,120,80))),
    ("rainbow-trout", "Rainbow Trout", "trout", "stripe_h", "m", pal((150,156,160),(100,108,116),(212,210,204),(120,128,134),(190,110,120))),
    ("brown-trout", "Brown Trout", "trout", "spots", "m", pal((150,116,70),(104,78,46),(206,178,120),(120,92,56),(90,66,40))),
    ("largemouth-bass", "Largemouth Bass", "bass", "stripe_h", "m", pal((118,140,84),(74,100,58),(202,200,150),(86,110,64),(60,86,50))),
    ("smallmouth-bass", "Smallmouth Bass", "bass", "bands", "m", pal((140,128,78),(96,86,50),(206,190,140),(104,94,56),(74,68,40))),
    ("crappie", "Crappie", "round", "mottled", "m", pal((176,182,176),(120,128,124),(220,224,218),(128,134,130),(80,90,86))),
    ("chub", "River Chub", "trout", "plain", "m", pal((150,134,108),(102,90,72),(210,198,176),(110,98,80),(88,78,62))),
    ("carp", "Common Carp", "koi", "bands", "m", pal((164,134,84),(112,90,52),(214,192,140),(120,98,58),(90,72,44))),
    ("tilapia", "Tilapia", "bass", "bands", "m", pal((150,156,158),(102,108,112),(210,212,210),(110,116,118),(80,88,90))),
    ("white-sucker", "White Sucker", "catfish", "plain", "m", pal((158,146,124),(108,98,82),(212,202,184),(116,106,88),(92,84,68))),
    ("bullhead", "Brown Bullhead", "catfish", "mottled", "m", pal((110,92,66),(76,62,42),(166,148,116),(84,68,46),(60,48,32))),
    ("fallfish", "Fallfish", "trout", "stripe_h", "m", pal((168,172,168),(116,122,118),(218,220,214),(124,130,126),(150,120,90))),
    ("shiner", "Golden Shiner", "trout", "plain", "s", pal((196,176,104),(150,128,66),(228,212,150),(160,134,70),(180,140,80))),
    ("pumpkinseed", "Pumpkinseed", "round", "spots", "s", pal((190,164,84),(140,114,52),(224,200,140),(110,140,80),(190,90,80))),
    ("warmouth", "Warmouth", "round", "mottled", "s", pal((150,128,80),(102,84,50),(200,178,128),(96,116,68),(120,80,52))),
    ("fathead", "Fathead Minnow", "trout", "plain", "s", pal((128,120,104),(88,82,70),(180,170,150),(96,88,74),(72,66,54))),
    ("stoneroller", "Stoneroller", "trout", "mottled", "s", pal((138,128,108),(94,86,72),(192,180,156),(100,92,76),(76,70,56))),
    ("logperch", "Logperch", "eel", "bands", "s", pal((170,150,100),(116,100,62),(212,196,150),(120,104,66),(80,70,44))),
    ("madtom", "Madtom", "catfish", "plain", "s", pal((118,100,74),(80,66,46),(170,150,118),(86,72,50),(62,50,34))),
    ("killifish", "Killifish", "trout", "stripes_v", "s", pal((150,158,120),(102,110,76),(206,206,168),(110,116,82),(80,94,56))),
]

# ---------------------------------------------------------------------------
# UNCOMMON (15) — cooler, cleaner colours, a touch more vivid, medium
# ---------------------------------------------------------------------------
UNCOMMON = [
    ("silver-trout", "Silver Trout", "trout", "stripe_h", "m", pal((182,194,206),(120,138,158),(226,232,238),(140,156,172),(120,170,200))),
    ("banded-bass", "Banded Bass", "bass", "bands", "m", pal((128,150,120),(80,108,84),(206,210,180),(92,118,92),(56,86,60))),
    ("steelhead", "Steelhead", "trout", "stripe_h", "l", pal((164,178,196),(108,128,150),(222,228,234),(126,146,166),(170,120,140))),
    ("walleye", "Walleye", "pike", "mottled", "l", pal((150,144,96),(100,96,56),(206,196,148),(110,104,62),(220,210,120))),
    ("northern-sucker", "Northern Sucker", "catfish", "plain", "m", pal((140,150,160),(94,104,116),(204,210,214),(104,114,124),(80,90,100))),
    ("white-bass", "White Bass", "bass", "stripes_v", "m", pal((184,192,200),(126,138,150),(224,228,232),(140,152,162),(90,104,116))),
    ("sauger", "Sauger", "pike", "spots", "m", pal((158,142,98),(108,96,58),(210,194,148),(116,102,64),(90,76,46))),
    ("burbot", "Burbot", "eel", "mottled", "l", pal((132,124,90),(90,84,58),(186,176,138),(98,90,62),(70,62,42))),
    ("grayling", "Arctic Grayling", "trout", "spots", "m", pal((150,160,186),(100,114,146),(212,216,228),(120,134,162),(150,130,190))),
    ("cutthroat", "Cutthroat Trout", "trout", "spots", "m", pal((168,148,110),(116,100,66),(216,196,150),(190,90,80),(150,70,60))),
    ("bowfin", "Bowfin", "eel", "bands", "l", pal((96,116,80),(62,82,52),(160,170,130),(72,92,60),(50,70,44))),
    ("gar", "Spotted Gar", "pike", "spots", "l", pal((140,134,100),(94,90,62),(196,188,150),(102,98,66),(70,64,42))),
    ("drum", "Freshwater Drum", "bass", "plain", "m", pal((168,170,164),(116,118,112),(216,218,212),(124,126,120),(150,120,90))),
    ("redhorse", "Redhorse", "catfish", "plain", "m", pal((176,138,104),(120,90,62),(218,190,150),(180,100,70),(150,80,56))),
    ("muskie-jr", "Juvenile Muskie", "pike", "bands", "l", pal((130,144,100),(86,102,62),(200,204,150),(96,112,68),(64,84,48))),
]

# ---------------------------------------------------------------------------
# RARE (10) — saturated, distinctive, sometimes exotic shapes, larger
# ---------------------------------------------------------------------------
RARE = [
    ("moonfin-pike", "Moonfin Pike", "pike", "gradient_glow", "l", pal((120,150,180),(74,104,140),(196,214,230),(150,180,210),(190,220,240))),
    ("glassback-eel", "Glassback Eel", "eel", "stripe_h", "l", pal((150,170,176),(96,122,130),(206,218,220),(120,150,158),(180,210,214))),
    ("tiger-muskie", "Tiger Muskie", "pike", "bands", "xl", pal((158,150,90),(106,98,50),(212,200,140),(60,70,40),(48,56,34))),
    ("golden-carp", "Golden Carp", "koi", "plain", "l", pal((222,176,80),(170,124,44),(244,220,150),(180,130,50),(190,150,70))),
    ("electric-eel", "Electric Eel", "eel", "gradient_glow", "l", pal((150,160,90),(96,110,52),(196,206,140),(200,220,120),(220,240,140))),
    ("peacock-bass", "Peacock Bass", "bass", "bands", "l", pal((90,150,140),(54,108,104),(180,210,190),(220,180,60),(60,90,150))),
    ("arapaima-jr", "Young Arapaima", "leviathan", "spots", "xl", pal((130,120,110),(88,80,72),(196,150,140),(180,90,90),(150,70,70))),
    ("sturgeon", "Lake Sturgeon", "catfish", "bands", "xl", pal((140,140,124),(94,94,82),(200,198,180),(104,104,90),(72,72,60))),
    ("snakehead", "Snakehead", "eel", "mottled", "l", pal((120,128,96),(78,88,60),(186,190,150),(88,96,64),(60,70,46))),
    ("paddlefish", "Paddlefish", "leviathan", "plain", "xl", pal((150,156,160),(102,108,114),(206,210,212),(112,118,122),(80,90,96))),
]

# ---------------------------------------------------------------------------
# LEGENDARY (5) — vivid, glowing, ornate fins, large; rarity reads instantly
# ---------------------------------------------------------------------------
LEGENDARY = [
    ("gilded-koi", "Gilded Koi", "koi", "spots", "l",
     pal((238,196,96),(190,140,48),(250,230,160),(200,150,60),(255,170,90), glow=(255,228,140))),
    ("crimson-leviathan-jr", "Crimson Serpent", "leviathan", "stripe_h", "xl",
     pal((196,72,64),(140,40,38),(230,150,130),(150,46,42),(230,90,80), glow=(255,140,120))),
    ("azure-emperor", "Azure Emperor", "bass", "gradient_glow", "xl",
     pal((86,150,210),(48,104,168),(180,214,238),(120,180,224),(150,210,255), glow=(170,220,255))),
    ("jade-koi", "Jade Dragon Koi", "koi", "bands", "l",
     pal((96,184,140),(56,138,100),(190,228,200),(110,200,150),(140,230,180), glow=(170,240,200))),
    ("solar-gar", "Solar Gar", "pike", "gradient_glow", "xl",
     pal((236,168,72),(190,118,40),(248,214,140),(255,200,90),(255,220,110), glow=(255,230,150))),
]

# ---------------------------------------------------------------------------
# EXOTIC (3) — otherworldly, full glow, the apex; phantom-leviathan is the
# game's existing endgame fish.
# ---------------------------------------------------------------------------
EXOTIC = [
    ("phantom-leviathan", "Phantom Leviathan", "leviathan", "gradient_glow", "xl",
     pal((150,170,210),(96,120,170),(210,224,244),(170,200,240),(210,235,255), glow=(225,240,255))),
    ("void-eel", "Void Eel", "eel", "gradient_glow", "xl",
     pal((110,90,160),(70,52,114),(180,160,214),(150,120,200),(190,160,240), glow=(210,180,255))),
    ("prism-koi", "Prism Koi", "koi", "stripe_h", "xl",
     pal((180,150,220),(130,100,176),(224,210,240),(210,160,230),(240,200,250), glow=(250,225,255))),
]


def all_fish():
    tiers = {
        "common": COMMON, "uncommon": UNCOMMON, "rare": RARE,
        "legendary": LEGENDARY, "exotic": EXOTIC,
    }
    out = []
    for rarity, lst in tiers.items():
        for (fid, name, shape, pattern, size, palette) in lst:
            out.append({
                "id": fid, "name": name, "rarity": rarity,
                "shape": shape, "pattern": pattern, "size": size,
                "palette": palette,
            })
    return out
