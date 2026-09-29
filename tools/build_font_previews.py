"""Build fast common-character previews; keep full originals for all other glyphs.
Run with: uv run --with fonttools --with brotli python tools/build_font_previews.py
"""
import base64
import json
import logging
import struct
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
logging.getLogger('fontTools.subset').setLevel(logging.ERROR)

def pack(ranges):
    data = bytearray()
    previous = 0
    for start, end in ranges:
        for value in (start - previous, end - start):
            while value >= 128:
                data.append((value & 127) | 128)
                value >>= 7
            data.append(value)
        previous = end + 1
    return base64.b64encode(data).decode()

def unpack(packed):
    result = []
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
            result.append([start, start + value])
            previous = start + value + 1
            start = None
        value = shift = 0
    return result

def ranges(codes):
    result = []
    for code in sorted(codes):
        if result and code == result[-1][1] + 1:
            result[-1][1] = code
        else:
            result.append([code, code])
    return result

COMMON = set(range(0x530)) | set(range(0x2000, 0x2070)) | set(range(0xff00, 0xfff0))
for row in range(0xb0, 0xd8):
    for col in range(0xa1, 0xff):
        try:
            COMMON.add(ord(bytes((row, col)).decode('gb2312')))
        except UnicodeDecodeError:
            pass
COMMON.update(map(ord, '从展馆，走向城市。让生活，有一点艺术。山有木兮木有枝，心悦君兮君不知。把日子，过成喜欢的样子。秋日好物·焕新生活中文与英文，一起看看。¥$&@'))

def build(v):
    v = dict(v)
    v['coveragePacked'] = pack(v.pop('coverage'))
    source = ROOT / v['url']
    if source.stat().st_size < 220_000:
        return v
    target = ROOT / 'font-library/previews' / source.name
    font = TTFont(source, recalcTimestamp=False)
    original_cmap = font.getBestCmap()
    needed = COMMON.intersection(original_cmap)
    original_axes = [(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in font['fvar'].axes] if 'fvar' in font else []
    if target.exists():
        with TTFont(target) as check:
            valid = set(check.getBestCmap()) == needed
            valid &= ([(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in check['fvar'].axes] if 'fvar' in check else []) == original_axes
        if valid:
            v['preview'] = {'url': 'font-library/previews/' + target.name, 'bytes': target.stat().st_size}
            return v
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=needed)
    try:
        subsetter.subset(font)
    except struct.error:
        # Some legacy layout tables cannot be subset safely. Keep their original font.
        print(f"Using full original for {v['id']}: unsupported legacy layout table", flush=True)
        return v
    font.flavor = 'woff2'
    font.save(target)
    with TTFont(target) as check:
        assert set(check.getBestCmap()) == needed, v['id']
        assert ([(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in check['fvar'].axes] if 'fvar' in check else []) == original_axes
    v['preview'] = {'url': 'font-library/previews/' + target.name, 'bytes': target.stat().st_size}
    return v

if __name__ == '__main__':
    source = (ROOT/'font-library/catalog.js').read_text()
    catalog = json.loads(source.removeprefix('window.FONT_CATALOG = ').removesuffix(';'))
    (ROOT/'font-library/previews').mkdir(exist_ok=True)
    variants = [v for f in catalog['families'] for v in f['variants']]
    for v in variants:
        if 'coverage' not in v:
            v['coverage'] = unpack(catalog['coverages'][v.pop('coverageIndex')])
        v.pop('preview', None)
    converted = {}
    with ProcessPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(build, v) for v in variants]
        for count, job in enumerate(as_completed(jobs), 1):
            v = job.result()
            converted[v['id']] = v
            print(f"{count}/{len(jobs)} {v['id']} {v.get('preview', {}).get('bytes', v['bytes']) // 1024} KiB", flush=True)
    for family in catalog['families']:
        family['variants'] = [converted[v['id']] for v in family['variants']]
    unique_coverage = []
    for v in [v for f in catalog['families'] for v in f['variants']]:
        packed = v.pop('coveragePacked')
        if packed not in unique_coverage:
            unique_coverage.append(packed)
        v['coverageIndex'] = unique_coverage.index(packed)
    catalog['coverages'] = unique_coverage
    catalog['previewCoveragePacked'] = pack(ranges(COMMON))
    (ROOT/'font-library/catalog.js').write_text('window.FONT_CATALOG = ' + json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + ';')
    print('Catalog bytes:', (ROOT/'font-library/catalog.js').stat().st_size, flush=True)
