"""Build the imported tools for GitHub Pages without changing the original projects.
Run: python3 tools/build-integrated-apps.py [--base /cropper-tool/]
Install dependencies in tools/apps/{lego,layout} with npm ci before the first build.
"""
from pathlib import Path
import argparse, json, re, shutil, subprocess

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
        mapping = {}
        for family in manifest:
            family['license'] = BASE + 'layout' + family['license']
            for face in family['faces']:
                variant = fonts[Path(face['url']).stem]
                old = face['url']
                face['url'] = BASE + variant['url']
                face['bytes'] = variant['bytes']
                mapping[old] = face['url']
        (stage / 'src/fontManifest.json').write_text(json.dumps(manifest, ensure_ascii=False))
        css = stage / 'public/fonts/local/fonts.css'
        text = css.read_text()
        for old, new in mapping.items():
            text = text.replace(old, new)
        if '/fonts/local/' in text:
            raise RuntimeError('Unmapped font in CSS')
        css.write_text(text)
        index = stage / 'index.html'
        replace(index, '/fonts/local/fonts.css', BASE + 'layout/fonts/local/fonts.css')
        replace(index, '/fonts/local/SourceHanSansSC-Regular.woff2', mapping['/fonts/local/SourceHanSansSC-Regular.woff2'])
        replace(stage / 'src/App.tsx', '<div className="brand">', '<div className="brand"><a className="tool-home-link" href="../" title="返回工具首页" aria-label="返回工具首页">← 工具首页</a>')
        # Full font warming is useful locally but costly over a network. Load selected faces on demand.
        replace(stage / 'src/App.tsx', 'loadContentFont, warmFonts', 'loadContentFont')
        replace(stage / 'src/App.tsx', '''  useEffect(() => {
    if (!studio.ready) return;
    const timer = window.setTimeout(() => { void warmFonts(); }, 500);
    return () => window.clearTimeout(timer);
  }, [studio.ready]);''', '')
        with (stage / 'src/style.css').open('a') as f:
            f.write('\n.tool-home-link{color:inherit;font:500 12px system-ui,sans-serif;text-decoration:none;white-space:nowrap;padding:8px;border:1px solid #0002;border-radius:4px;margin-right:8px}.tool-home-link:focus-visible{outline:2px solid #d19343}@media(max-width:1100px){.app-header{gap:12px}.app-header .top-actions{position:static;transform:none;margin-left:auto}.app-header .brand>:not(.tool-home-link){display:none}.app-header .account{margin-left:0}}@media(max-width:800px){.tool-home-link{font-size:11px;padding:6px;margin-right:0}}@media(max-width:450px){.app-header .account{display:none}.app-header .top-actions{gap:9px}}\n')
    subprocess.run(['npm', 'run', 'build', '--', '--base', BASE + name + '/'], cwd=stage, check=True)
    target = ROOT / name
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(stage / 'dist', target)
    print(f'Built {name} at {BASE}{name}/', flush=True)
