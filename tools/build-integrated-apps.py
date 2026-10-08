"""Build the imported tools for GitHub Pages without changing the original projects.
Run: python3 tools/build-integrated-apps.py [--base /cropper-tool/]
Install dependencies in tools/apps/{lego,layout} with npm ci before the first build.
"""
from pathlib import Path
import argparse, base64, json, re, shutil, subprocess

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='/cropper-tool/')
args = parser.parse_args()
BASE = '/' + args.base.strip('/') + '/' if args.base.strip('/') else '/'
STAGE = ROOT / 'output/integrated-apps-build'
STAGE.mkdir(parents=True, exist_ok=True)

catalog_text = (ROOT / 'font-library/catalog.js').read_text()
catalog = json.loads(catalog_text[catalog_text.index('{'):].rstrip(';\n'))
fonts = {Path(v['file']).stem: v for family in catalog['families'] for v in family['variants']}

def unpack_codes(packed):
    codes = set()
    previous = value = shift = 0
    start = None
    for byte in base64.b64decode(packed):
        value += (byte & 127) << shift
        if byte & 128:
            shift += 7
            continue
        if start is None:
            start = previous + value
        else:
            codes.update(range(start, start + value + 1))
            previous = start + value + 1
            start = None
        value = shift = 0
    return codes

def unicode_range(codes):
    ranges = []
    for point in sorted(codes):
        if ranges and point == ranges[-1][1] + 1:
            ranges[-1][1] = point
        else:
            ranges.append([point, point])
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a,b in ranges)

common_codes = unpack_codes(catalog['previewCoveragePacked'])
coverage_codes = [unpack_codes(packed) for packed in catalog['coverages']]

supplements = json.loads((ROOT / 'font-library/layout-supplements/manifest.json').read_text())

def font_css(family, face, variant):
    coverage = coverage_codes[variant['coverageIndex']]
    preview = variant.get('preview')
    supplement = supplements.get(variant['id'])
    extra = unpack_codes(supplement['coverage']) if supplement else set()
    parts = [(variant['url'], coverage)] if not preview else [(preview['url'], coverage & common_codes)]
    if preview:
        if supplement:
            parts.append((supplement['url'], extra))
        parts.append((variant['url'], coverage - common_codes - extra))
    rules = []
    for path, codes in parts:
        if not codes:
            continue
        if not (ROOT / path).is_file():
            raise FileNotFoundError(path)
        rules.append('@font-face { font-family: "' + face.get('family', family['family']) +
            '"; font-style: normal; font-weight: ' + str(face['weight']) +
            '; font-display: swap; src: url("' + BASE + path + '") format("woff2"); unicode-range: ' +
            unicode_range(codes) + '; }')
    return rules

def replace(path, old, new):
    text = path.read_text()
    if old not in text:
        raise RuntimeError(f'Integration anchor missing in {path.name}: {old[:70]}')
    path.write_text(text.replace(old, new))

for name in ['lego', 'layout']:
    source = ROOT / 'tools/apps' / name
    stage = STAGE / name
    if stage.exists():
        shutil.rmtree(stage)
    shutil.copytree(source, stage, ignore=shutil.ignore_patterns('node_modules', 'dist', '*.tsbuildinfo'))
    (stage / 'node_modules').symlink_to((source / 'node_modules').resolve(), target_is_directory=True)
    if name == 'lego':
        replace(stage / 'src/editor.ts', 'href="${location.pathname}" aria-label="积木工坊"', 'href="../" aria-label="返回工具首页" title="返回工具首页"')
        replace(stage / 'src/entry.ts', '}else{mountEditor();}', "}else{mountEditor();}\nconst brand=document.querySelector('.app-header .brand');\nif(brand){const home=document.createElement('a');home.href='../';home.textContent='← 工具首页';home.style.cssText='color:inherit;text-decoration:none;margin-right:16px;font-size:12px';brand.prepend(home);}\n")
    else:
        asset_base = BASE + 'layout/assets/'
        for path in (stage / 'src').iterdir():
            if path.suffix in ['.tsx', '.ts']:
                text = path.read_text().replace('/assets/', asset_base)
                # The media URL allowlist contains an escaped regular expression.
                text = text.replace(r'^\/assets\/', '^' + re.escape(asset_base).replace('/', r'\/'))
                path.write_text(text)
        manifest = json.loads((stage / 'src/fontManifest.json').read_text())
        rules = []
        for family in manifest:
            family['license'] = BASE + 'layout' + family['license']
            for face in family['faces']:
                variant = fonts[Path(face['url']).stem]
                face['url'] = BASE + variant['url']
                face['bytes'] = variant['bytes']
                rules.extend(font_css(family, face, variant))
        (stage / 'src/fontManifest.json').write_text(json.dumps(manifest, ensure_ascii=False))
        css = stage / 'public/fonts/local/fonts.css'
        css.write_text('/* Common glyphs first; complete fonts only for additional characters. */\n' + '\n'.join(rules))
        index = stage / 'index.html'
        replace(index, '/fonts/local/fonts.css', BASE + 'layout/fonts/local/fonts.css?v=2')
        index.write_text(re.sub(r'    <link rel="preload"[^>]+>\n', '', index.read_text()))
    subprocess.run(['npm', 'run', 'build', '--', '--base', BASE + name + '/'], cwd=stage, check=True)
    target = ROOT / name
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(stage / 'dist', target)
    index = target / 'index.html'
    index.write_text(index.read_text().replace('</head>', f'<script src="{BASE}tool-switcher.js" defer></script></head>'))
    print(f'Built {name} at {BASE}{name}/', flush=True)
