import os
import shutil
import json
import subprocess
import sys
import zipfile

# Ensure UTF-8 encoding for stdout on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# Portable paths (resolved relative to this script).
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.dirname(SCRIPTS_DIR)
SRC_DIR = os.path.join(WORKSPACE_DIR, 'src')
DIST_DIR = os.path.join(WORKSPACE_DIR, 'dist')

# Optional logo source for regenerating icons. Set the LOGO_SRC env var to a
# PNG to regenerate icons/*.png; otherwise the committed src/icons are used.
GEN_LOGO_PATH = os.environ.get('LOGO_SRC', '')

SRC_ICONS_DIR = os.path.join(SRC_DIR, 'icons')
SRC_RULESETS_DIR = os.path.join(SRC_DIR, 'rulesets')
SRC_POPUP_DIR = os.path.join(SRC_DIR, 'popup')

def build_rules():
    print("--- 1. Compiling Adblocker Rules ---")
    compile_script = os.path.join(SCRIPTS_DIR, 'compile_rules.py')
    result = subprocess.run([sys.executable, compile_script], cwd=WORKSPACE_DIR, capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print("Error compiling rules:")
        print(result.stderr)
        sys.exit(1)

def generate_icons():
    print("--- 2. Generating Extension Icons ---")
    os.makedirs(SRC_ICONS_DIR, exist_ok=True)
    if not GEN_LOGO_PATH or not os.path.exists(GEN_LOGO_PATH):
        print("No LOGO_SRC provided; using existing src/icons/*.png")
        return

    try:
        from PIL import Image
        img = Image.open(GEN_LOGO_PATH)
        sizes = [16, 32, 48, 128]
        for size in sizes:
            resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
            icon_path = os.path.join(SRC_ICONS_DIR, f'icon{size}.png')
            resized_img.save(icon_path, 'PNG')
            print(f"Saved {size}x{size} icon to {icon_path}")
    except Exception as e:
        print(f"Error generating icons: {e}")
        sys.exit(1)

def build_target(browser):
    print(f"\n--- 3. Building for {browser.upper()} ---")
    target_dir = os.path.join(DIST_DIR, browser)
    
    # Recreate directory
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)
    os.makedirs(target_dir, exist_ok=True)
    
    # Copy popup files
    target_popup = os.path.join(target_dir, 'popup')
    shutil.copytree(SRC_POPUP_DIR, target_popup)
    
    # Copy icons
    target_icons = os.path.join(target_dir, 'icons')
    shutil.copytree(SRC_ICONS_DIR, target_icons)
    
    # Copy rulesets
    target_rulesets = os.path.join(target_dir, 'rulesets')
    shutil.copytree(SRC_RULESETS_DIR, target_rulesets)
    
    # Copy background.js
    shutil.copy(os.path.join(SRC_DIR, 'background.js'), os.path.join(target_dir, 'background.js'))
    
    # Generate manifest
    manifest_template_path = os.path.join(SRC_DIR, 'manifest.json.template')
    with open(manifest_template_path, 'r', encoding='utf-8') as f:
        manifest_str = f.read()
        
    if browser == 'chrome':
        bg_config = {
            "service_worker": "background.js"
        }
    elif browser == 'firefox':
        bg_config = {
            "scripts": ["background.js"]
        }
    else:
        raise ValueError(f"Unknown browser target: {browser}")
        
    manifest_str = manifest_str.replace('{{BACKGROUND_CONFIG}}', json.dumps(bg_config, indent=2))

    # Firefox requires an explicit add-on id to be packaged/installed as an .xpi.
    manifest_obj = json.loads(manifest_str)
    if browser == 'firefox':
        manifest_obj['browser_specific_settings'] = {
            'gecko': {'id': 'just-ad-blocker@local'}
        }

    target_manifest = os.path.join(target_dir, 'manifest.json')
    with open(target_manifest, 'w', encoding='utf-8') as f:
        json.dump(manifest_obj, f, indent=2, ensure_ascii=False)

    print(f"Manifest written to {target_manifest}")
    print(f"Build complete for {browser}!")

def package_firefox():
    print("\n--- 4. Packaging Firefox .xpi ---")
    src_dir = os.path.join(DIST_DIR, 'firefox')
    xpi_path = os.path.join(DIST_DIR, 'firefox.xpi')
    if os.path.exists(xpi_path):
        os.remove(xpi_path)
    # An .xpi is a plain zip with manifest.json at the archive root.
    with zipfile.ZipFile(xpi_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(src_dir):
            for fname in files:
                full = os.path.join(root, fname)
                arcname = os.path.relpath(full, src_dir)
                zf.write(full, arcname)
    size_kb = os.path.getsize(xpi_path) // 1024
    print(f"Packaged {xpi_path} ({size_kb} KB)")

def main():
    build_rules()
    generate_icons()
    build_target('chrome')
    build_target('firefox')
    package_firefox()
    print("\n=== BUILD PROCESS COMPLETE! ===")

if __name__ == '__main__':
    main()
