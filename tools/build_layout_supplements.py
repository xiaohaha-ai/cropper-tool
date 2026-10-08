"""Small supplementary glyph sets for the built-in layout templates.
Run: uv run --offline --with fonttools --with brotli python tools/build_layout_supplements.py
The original complete fonts and their notices remain unchanged.
"""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
import json
from fontTools import subset
from fontTools.ttLib import TTFont
from build_font_previews import unpack, pack, ranges
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'font-library/layout-supplements'

def build(job):
    variant,extra=job
    font=TTFont(ROOT/variant['url'],recalcTimestamp=False)
    needed=set(font.getBestCmap())&set(extra)
    if not needed:
        font.close()
        return None
    options=subset.Options()
    options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
    subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=needed);subsetter.subset(font)
    font.flavor='woff2';target=DEST/(variant['id']+'.woff2');font.save(target);font.close()
    with TTFont(target) as check:assert set(check.getBestCmap())==needed
    return variant['id'],{'url':str(target.relative_to(ROOT)),'coverage':pack(ranges(needed)),'bytes':target.stat().st_size}

if __name__=='__main__':
    text=(ROOT/'font-library/catalog.js').read_text();catalog=json.loads(text[text.index('{'):].rstrip(';\n'))
    common={p for a,b in unpack(catalog['previewCoveragePacked']) for p in range(a,b+1)}
    content=''.join(p.read_text() for p in (ROOT/'tools/apps/layout/src').glob('*.ts*'))
    extra={ord(c) for c in content if 0x2000<=ord(c)<=0xffff}-common
    manifest=json.loads((ROOT/'tools/apps/layout/src/fontManifest.json').read_text())
    names={Path(face['url']).stem for family in manifest for face in family['faces']}
    variants=[v for family in catalog['families'] for v in family['variants'] if Path(v['file']).stem in names and v.get('preview')]
    DEST.mkdir(exist_ok=True)
    with ProcessPoolExecutor(max_workers=3) as pool:
        results={key:value for result in pool.map(build,[(v,sorted(extra)) for v in variants]) if result for key,value in [result]}
    (DEST/'manifest.json').write_text(json.dumps(results,indent=2)+'\n')
    print(f"Prepared {len(results)} small faces for {len(extra)} additional template characters: {sum(v['bytes'] for v in results.values())} bytes")
