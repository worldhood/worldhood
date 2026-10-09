# python3 -E -P scripts/espoo-atlas.py <jobs.json>
# Composes texture atlases planned by scripts/build-espoo.mjs: each job lists source photos and the
# rectangle each one is resampled into. Needs Pillow. Edges are extruded into the padding so
# mipmaps do not bleed neighbouring photos into a surface.
import json, sys
from multiprocessing import Pool
from PIL import Image

def compose(job):
    size, pad = job['size'], job.get('pad', 2)
    atlas = Image.new('RGB', (size, size), (150, 148, 140))
    for it in job['items']:
        w, h = it['w'], it['h']
        try:
            img = Image.open(it['src'])
            img.draft('RGB', (w, h))
            img = img.convert('RGB')
        except Exception:
            continue
        x, y = it['x'], it['y']
        atlas.paste(img.resize((w + 2 * pad, h + 2 * pad), Image.BILINEAR), (x - pad, y - pad))
        atlas.paste(img.resize((w, h), Image.LANCZOS), (x, y))
    atlas.save(job['out'], 'JPEG', quality=job.get('quality', 82), optimize=True)
    return job['out']

if __name__ == '__main__':
    jobs = json.load(open(sys.argv[1]))
    with Pool() as pool:
        for i, out in enumerate(pool.imap_unordered(compose, jobs)):
            if i % 20 == 0 or i == len(jobs) - 1:
                print(f'{i + 1}/{len(jobs)} atlases', flush=True)
