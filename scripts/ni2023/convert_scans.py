"""Reproduce seven visually audited NI 2023 scanned council count records.

The EONI PDFs embed tiny raster screenshots. OCR alone confuses decimals and
6/8 digits, so the normalized facts are stored in scanned-count-fixtures.json,
manually audited cell by cell against native source images. The fixture also
cites council declarations wherever they supplement the screenshot.

Default execution verifies manifest/source SHA-256, validates the audited
transcription and writes normalized JSON. --dump additionally extracts native
images and runs cell OCR for independent review; OCR never overwrites audited
facts. Blank and off-image cells remain null; no later stages are inferred.

Usage: python scripts/ni2023/convert_scans.py --source /path/to/ni-stv-data/2023
Optional: --related-source /path/to/council-declarations --dump /tmp/cell-ocr
Requires pymupdf, opencv-python, numpy; --dump also requires Tesseract
(TESSERACT env var or PATH).
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import cv2
import numpy as np
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
STEMS = ['enniskillen', 'erne-east', 'erne-north', 'erne-west', 'omagh', 'mid-tyrone', 'west-tyrone']
TESSERACT = os.environ.get('TESSERACT') or shutil.which('tesseract') or 'tesseract'
SCALE = 5


def native_image(pdf_path):
    doc = pymupdf.open(pdf_path)
    assert len(doc) == 1
    imgs = doc[0].get_images(full=True)
    assert len(imgs) == 1, pdf_path
    data = doc.extract_image(imgs[0][0])['image']
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def grid_lines(img, axis):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    dark = (gray < 110).astype(np.uint8)
    if axis == 'h':
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, int(img.shape[1] * .03)), 1))
        prof = cv2.morphologyEx(dark, cv2.MORPH_OPEN, k).sum(1)
    else:
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(10, int(img.shape[0] * .03))))
        prof = cv2.morphologyEx(dark, cv2.MORPH_OPEN, k).sum(0)
    groups = []
    for i in np.where(prof > 0)[0]:
        if groups and i - groups[-1][1] <= 4:
            groups[-1][1] = i
        else:
            groups.append([i, i])
    return [(int(a), int(b)) for a, b in groups]


def tesseract(gray, numeric):
    with tempfile.NamedTemporaryFile(suffix='.png') as f:
        cv2.imwrite(f.name, gray)
        args = [TESSERACT, f.name, 'stdout', '--psm', '7']
        if numeric:
            args += ['-c', 'tessedit_char_whitelist=0123456789.-']
        out = subprocess.run(args, capture_output=True, text=True, check=True).stdout
    return re.sub(r'\s+', ' ', out).strip()


def ocr_cell(img, box, numeric):
    """OCR one grid cell. Numeric cells are read in several upscaling variants and voted."""
    x0, y0, x1, y1 = box
    gray = cv2.cvtColor(img[y0 + 2:y1 - 1, x0 + 2:x1 - 1], cv2.COLOR_BGR2GRAY)
    if gray.size == 0 or (gray < 200).sum() < 3:
        return ''
    k = 70 / (y1 - y0)  # normalise every sheet to ~70px rows (native rows are 12-30px)
    variants = [(k, cv2.INTER_CUBIC, False), (k * 1.3, cv2.INTER_LANCZOS4, False), (k, cv2.INTER_CUBIC, True)]
    if not numeric:
        variants = variants[:1]
    reads = []
    for scale, interp, otsu in variants:
        g = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=interp)
        g = cv2.copyMakeBorder(g, 30, 30, 40, 40, cv2.BORDER_CONSTANT, value=255)
        if otsu:
            g = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        reads.append(tesseract(g, numeric))
    best = max(set(reads), key=lambda r: (reads.count(r), -reads.index(r)))
    return best if reads.count(best) > 1 or len(reads) == 1 else '?' + '|'.join(reads)


def norm(s):
    return re.sub(r'[^a-z]', '', s.lower())


def geometry(img):
    hl = [(a + b) // 2 for a, b in grid_lines(img, 'h')]
    vl = [(a + b) // 2 for a, b in grid_lines(img, 'v')]
    vl = [v for i, v in enumerate(vl) if i == 0 or v - vl[i - 1] > 6]
    if vl[0] > 20:
        vl = [0] + vl
    rows = [(a, b) for a, b in zip(hl, hl[1:]) if b - a > 8]
    cols = list(zip(vl, vl[1:]))
    return rows, cols


def green_boxes(img, ymax):
    """Metadata value boxes (light green fill) above the count table."""
    b, g, r = cv2.split(img[:ymax])
    mask = ((g > 240) & (r > 180) & (r < 225) & (b > 180) & (b < 225)).astype(np.uint8)
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    boxes = [tuple(int(v) for v in s[:4]) for s in stats[1:] if s[2] > 15 and s[3] > 8 and s[4] > 100]
    return sorted(boxes, key=lambda s: (s[1] // 10, s[0]))


def read_sheet(img):
    """Return raw per-cell OCR of one screenshot."""
    rows, cols = geometry(img)
    elected_c, no_c, name_c, desc_c, s1_c = cols[:5]
    pairs = [(cols[i], cols[i + 1]) for i in range(5, len(cols) - 1, 2)]
    cell = lambda c, r, numeric=True: ocr_cell(img, (c[0], r[0], c[1], r[1]), numeric)
    hdr = next(k for k, r in enumerate(rows) if norm(cell(name_c, r, False)) == 'candidate')
    cands, k = [], hdr + 1
    while cell(name_c, rows[k], False):
        r = rows[k]
        cands.append(dict(status=cell(elected_c, r, False), no=cell(no_c, r), name=cell(name_c, r, False),
                          desc=cell(desc_c, r, False), first=cell(s1_c, r),
                          stages=[[cell(c, r), cell(t, r)] for c, t in pairs]))
        k += 1
    nt = next(j for j in range(k, len(rows) - 1) if norm(cell(desc_c, rows[j], False)).startswith('nontrans'))
    rowvals = lambda r: dict(first=cell(s1_c, r), stages=[[cell(c, r), cell(t, r)] for c, t in pairs])
    headers = [[ocr_cell(img, (c[0], rows[hdr - j][0], t[1], rows[hdr - j][1]), False) for j in (4, 3, 2)]
               for c, t in pairs]
    top = rows[hdr - 4][0]
    meta = []
    for x, y, w, h in green_boxes(img, top):
        label = ocr_cell(img, (max(0, x - int(w * 1.6) - 60), y, x - 2, y + h), False)
        meta.append(dict(box=[x, y, w, h], label=label, value=ocr_cell(img, (x, y, x + w, y + h), True)))
    title = ocr_cell(img, (0, 0, img.shape[1] // 2, rows[0][0] if rows[0][0] > 20 else top // 3), False)
    return dict(rows=rows, cols=cols, headerRow=hdr, title=title, meta=meta, headers=headers,
                candidates=cands, nonTransferable=rowvals(rows[nt]), totals=rowvals(rows[nt + 1]))


def validate(records):
    """Check audited facts without filling absent cells or repairing published counts."""
    from decimal import Decimal
    dec = lambda v: Decimal(str(v or 0))
    assert len(records) == 7, 'Expected seven scanned DEAs'
    assert sum(r['seats'] for r in records) == 40
    for record in records:
        candidates = record['candidates']
        assert sum(c['firstPreferences'] for c in candidates) == record['validBallots'], record['dea']
        assert sum(c['elected'] for c in candidates) == record['seats'], record['dea']
        assert record['stages'][0]['totals'] == [c['firstPreferences'] for c in candidates]
        assert [s['number'] for s in record['stages']] == list(range(1, len(record['stages']) + 1))
        assert record['validBallots'] + record['invalidBallots'] == record['votesPolled']
        previous = None
        for stage in record['stages']:
            assert len(stage['totals']) == len(candidates)
            if 'changes' in stage:
                assert len(stage['changes']) == len(candidates)
            if not stage.get('incomplete'):
                assert stage['reportedTotal'] == record['validBallots'], (record['dea'], stage['number'])
                total = sum(map(dec, stage['totals'])) + dec(stage['nonTransferable'])
                difference = total - dec(record['validBallots'])
                if difference:
                    note = f"Stage {stage['number']}: published candidate totals plus non-transferable votes differ from valid ballots by {difference:+.2f}; source values preserved."
                    if note not in record['notes']:
                        record['notes'].append(note)
                if previous and 'changes' in stage:
                    for i, change in enumerate(stage['changes']):
                        if change is None:
                            continue
                        actual = dec(stage['totals'][i]) - dec(previous['totals'][i])
                        if actual != dec(change):
                            note = f"Stage {stage['number']}, {candidates[i]['name']}: published change {change} differs from total difference {actual}; source values preserved."
                            if note not in record['notes']:
                                record['notes'].append(note)
            previous = stage
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'source-data/council/northern-ireland-2023/scanned-counts.json')
    parser.add_argument('--dump', type=Path, help='Also dump native images and independent cell OCR for comparison (slow)')
    parser.add_argument('--related-source', type=Path, help='Optional directory of council declaration PDFs to checksum')
    args = parser.parse_args()
    fixture = json.loads((HERE / 'scanned-count-fixtures.json').read_text())
    records = fixture['records']
    manifest = json.loads((args.source / 'manifest.json').read_text())
    by_filename = {f['filename']: f for f in manifest['files']}
    assert {r['source']['filename'] for r in records} == {f'local-council-elections-2023-result-sheet-{stem}.pdf' for stem in STEMS}
    for record in records:
        source = record['source']
        expected = by_filename[source['filename']]
        for key in ('url', 'sha256'):
            assert source[key] == expected[key], (source['filename'], key)
        pdf = args.source / source['filename']
        assert hashlib.sha256(pdf.read_bytes()).hexdigest() == source['sha256'], pdf
        if args.related_source:
            for related in record.get('relatedSources', []):
                path = args.related_source / related['filename']
                assert hashlib.sha256(path.read_bytes()).hexdigest() == related['sha256'], path
        if args.dump:
            args.dump.mkdir(parents=True, exist_ok=True)
            img = native_image(pdf)
            stem = pdf.stem
            cv2.imwrite(str(args.dump / f'{stem}.png'), img)
            (args.dump / f'{stem}.cells.json').write_text(json.dumps(read_sheet(img), ensure_ascii=False, indent=2) + '\n')
    validate(records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    print(f"Wrote {len(records)} DEAs / {sum(sum(c['elected'] for c in r['candidates']) for r in records)} elected candidates to {args.output}")
    for r in records:
        print(f"{r['dea']}: {r['validBallots']} first preferences; {len(r['stages'])} published stages; {sum(c['elected'] for c in r['candidates'])} elected")


if __name__ == '__main__':
    main()
