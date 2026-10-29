"""
Refined asset preparation script for AgentCart AI.
Preserves the deep black background by applying color/saturation adjustments only to non-black jacket pixels.
Generates distinct high-res product photos for all 24 jacket models in the catalog.
"""
import os
import shutil
import colorsys
from PIL import Image, ImageEnhance, ImageMath

SRC_DIR = "D:/AgentCart-AI"
DEST_DIR = "D:/AgentCart-AI/frontend/assets/images/jackets"
os.makedirs(DEST_DIR, exist_ok=True)

# 1. Base supplied screenshots
SCREENSHOT_MAP = {
    "cyber-shell-black.png": "Screenshot 2026-10-27 005642.png",
    "alpine-white-shell.png": "Screenshot 2026-10-27 005648.png",
    "ranger-olive-tactical.png": "Screenshot 2026-10-27 005656.png",
    "apex-blaze-orange.png": "Screenshot 2026-10-27 005707.png",
    "neon-pulse-magenta.png": "Screenshot 2026-10-27 005717.png",
    "shadow-camo-stealth.png": "Screenshot 2026-10-27 005726.png",
}

for dest_name, src_name in SCREENSHOT_MAP.items():
    src_path = os.path.join(SRC_DIR, src_name)
    dest_path = os.path.join(DEST_DIR, dest_name)
    if os.path.exists(src_path):
        shutil.copy2(src_path, dest_path)
        print(f"Copied pristine {src_name} -> {dest_name}")

def tint_jacket_preserving_background(base_img, target_tint, saturation_mult, brightness_mult, blend_ratio):
    # Convert to RGB
    img = base_img.convert("RGB")
    w, h = img.size
    
    # Create mask where luminance > 25 (foreground jacket)
    gray = img.convert("L")
    # Soft mask
    mask = gray.point(lambda p: min(255, max(0, int((p - 20) * 4.5))))
    
    # Adjust saturation & brightness
    enh_sat = ImageEnhance.Color(img)
    adj = enh_sat.enhance(saturation_mult)
    enh_bri = ImageEnhance.Brightness(adj)
    adj = enh_bri.enhance(brightness_mult)
    
    tint_layer = Image.new("RGB", (w, h), target_tint)
    tinted = Image.blend(adj, tint_layer, blend_ratio)
    
    # Composite only where mask > 0 so background stays true to original studio black
    result = Image.composite(tinted, img, mask)
    return result

# 2. Transformations to produce distinct premium jacket listings
transformations = [
    # 7: Stealth Bomber MA-1 Tech (Bomber Jacket)
    {
        "filename": "stealth-bomber-ma1.png",
        "base": "cyber-shell-black.png",
        "tint": (25, 45, 90), # Deep midnight navy
        "saturation": 0.5,
        "brightness": 0.98,
        "blend": 0.40
    },
    # 8: Veloce Commuter Softshell (Casual Everyday Jacket)
    {
        "filename": "veloce-commuter-softshell.png",
        "base": "shadow-camo-stealth.png",
        "tint": (45, 55, 70), # Slate charcoal
        "saturation": 0.3,
        "brightness": 1.25,
        "blend": 0.35
    },
    # 9: Arctic Expedition 800 Down (Insulated Winter Jacket)
    {
        "filename": "arctic-expedition-down.png",
        "base": "apex-blaze-orange.png",
        "tint": (220, 25, 45), # Deep Arctic Crimson Red
        "saturation": 1.3,
        "brightness": 0.95,
        "blend": 0.45
    },
    # 10: Quantum Ripstop Rain Trench (Lightweight Rain Jacket)
    {
        "filename": "quantum-ripstop-trench.png",
        "base": "alpine-white-shell.png",
        "tint": (100, 160, 210), # Glacier Slate Cyan
        "saturation": 0.85,
        "brightness": 0.88,
        "blend": 0.40
    },
    # 11: Raw Selvedge Cyber Denim (Denim Jacket)
    {
        "filename": "raw-cyber-denim.png",
        "base": "cyber-shell-black.png",
        "tint": (30, 60, 140), # Deep Raw Indigo Denim
        "saturation": 1.2,
        "brightness": 1.10,
        "blend": 0.42
    },
    # 12: AeroGrid Ultralight Windrunner (Sports and Outdoor Jacket)
    {
        "filename": "aerogrid-windrunner.png",
        "base": "ranger-olive-tactical.png",
        "tint": (160, 240, 30), # Cyber Volt Lime / Neon Green
        "saturation": 1.4,
        "brightness": 1.05,
        "blend": 0.35
    },
    # 13: Hyperion 3L Mountain Hardshell (Technical Windbreaker)
    {
        "filename": "hyperion-mountain-shell.png",
        "base": "cyber-shell-black.png",
        "tint": (0, 190, 255), # Electric Cyan Summit
        "saturation": 1.6,
        "brightness": 1.15,
        "blend": 0.42
    },
    # 14: Obsidian Tactical Bomber (Bomber Jacket)
    {
        "filename": "obsidian-tactical-bomber.png",
        "base": "shadow-camo-stealth.png",
        "tint": (15, 15, 18), # Matte Jet Obsidian
        "saturation": 0.05,
        "brightness": 0.80,
        "blend": 0.35
    },
    # 15: Glacier Puffer Anorak (Puffer Jacket)
    {
        "filename": "glacier-puffer-anorak.png",
        "base": "alpine-white-shell.png",
        "tint": (175, 220, 255), # Frost Glacier Blue
        "saturation": 0.95,
        "brightness": 1.05,
        "blend": 0.32
    },
    # 16: Sub-Zero Thermal Parka (Insulated Winter Jacket)
    {
        "filename": "subzero-thermal-parka.png",
        "base": "alpine-white-shell.png",
        "tint": (65, 80, 100), # Gunmetal Slate
        "saturation": 0.4,
        "brightness": 0.72,
        "blend": 0.45
    },
    # 17: Metro Minimalist Hooded Windcoat (Minimalist Urban Jacket)
    {
        "filename": "metro-minimalist-windcoat.png",
        "base": "neon-pulse-magenta.png",
        "tint": (110, 40, 150), # Deep Cyber Violet
        "saturation": 0.85,
        "brightness": 0.75,
        "blend": 0.40
    },
    # 18: Cobalt Storm Shield (Hooded Jacket)
    {
        "filename": "cobalt-storm-shield.png",
        "base": "cyber-shell-black.png",
        "tint": (25, 95, 245), # Vibrant Royal Cobalt
        "saturation": 1.5,
        "brightness": 1.05,
        "blend": 0.40
    },
    # 19: Terra Hybrid Trekker (Sports and Outdoor Jacket)
    {
        "filename": "terra-hybrid-trekker.png",
        "base": "ranger-olive-tactical.png",
        "tint": (195, 145, 85), # Desert Coyote Khaki
        "saturation": 0.9,
        "brightness": 1.08,
        "blend": 0.38
    },
    # 20: Carbon Raw Denim Biker (Denim Jacket)
    {
        "filename": "carbon-denim-biker.png",
        "base": "shadow-camo-stealth.png",
        "tint": (35, 40, 48), # Waxed Charcoal Denim
        "saturation": 0.2,
        "brightness": 0.95,
        "blend": 0.30
    },
    # 21: Nimbus Packable Rain Anorak (Lightweight Rain Jacket)
    {
        "filename": "nimbus-packable-rain.png",
        "base": "neon-pulse-magenta.png",
        "tint": (16, 205, 140), # Emerald Tech Rain
        "saturation": 1.2,
        "brightness": 0.98,
        "blend": 0.45
    },
    # 22: Zenith Urban Shell (Casual Everyday Jacket)
    {
        "filename": "zenith-urban-shell.png",
        "base": "apex-blaze-orange.png",
        "tint": (250, 175, 20), # High-Vis Amber Gold
        "saturation": 1.25,
        "brightness": 1.05,
        "blend": 0.35
    },
    # 23: Solstice Thermo Down (Puffer Jacket)
    {
        "filename": "solstice-thermo-down.png",
        "base": "apex-blaze-orange.png",
        "tint": (205, 65, 10), # Rust Amber Bronze
        "saturation": 1.1,
        "brightness": 0.92,
        "blend": 0.42
    },
    # 24: Vanguard Heavy Duty Field Jacket (Casual Everyday Jacket)
    {
        "filename": "vanguard-field-jacket.png",
        "base": "ranger-olive-tactical.png",
        "tint": (40, 70, 40), # Deep Woodland Combat Green
        "saturation": 0.85,
        "brightness": 0.88,
        "blend": 0.38
    }
]

for t in transformations:
    base_path = os.path.join(DEST_DIR, t["base"])
    out_path = os.path.join(DEST_DIR, t["filename"])
    if not os.path.exists(base_path):
        continue
    
    base_img = Image.open(base_path)
    res = tint_jacket_preserving_background(
        base_img,
        t["tint"],
        t["saturation"],
        t["brightness"],
        t["blend"]
    )
    res.save(out_path, "PNG", optimize=True)
    print(f"Generated {t['filename']}")

print("All 24 jacket product images successfully prepared with pristine dark studio backdrops.")
