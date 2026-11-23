"""Extract recorded NI council counts from the official 2023 Excel workbooks."""
import argparse
import hashlib
import json
from pathlib import Path
import re

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
NORM = lambda x: re.sub(r'[^a-z]', '', str(x).lower())


def number(value):
    return round(value, 2) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def field(rows, labels):
    for row in rows[:14]:
        for i, value in enumerate(row[:24]):
            if NORM(value) in labels:
                return next((number(v) for v in row[i + 1:24] if number(v) is not None), None)
    return None


def extract(sheet, entry):
    rows = [list(r) for r in sheet.iter_rows(values_only=True)]
    headers = [(i, j) for i, row in enumerate(rows) for j, value in enumerate(row[:24])
               if NORM(value) in ('stpreference', 'firstpreferencevotes')]
    assert headers, (entry['filename'], sheet.title)
    seats = field(rows, {'numbertobeelected', 'numberofmemberstobeelected'})
    valid = field(rows, {'totalvalidvotes', 'validvotes'})
    quota = field(rows, {'electoralquotaof', 'quota'})
    assert seats and valid, (entry["filename"], sheet.title, seats, valid, quota)
    if sheet.title.lower().startswith('stage'):
        dea = next(str(v).strip() for row in rows[:3] for j, value in enumerate(row[:24])
                   if NORM(value) == 'districtelectoralareaof' for v in row[j + 1:24] if isinstance(v, str) and v.strip())
    else:
        dea = sheet.title.strip()
    candidates, ids, stages = [], {}, {}
    for h, fc in headers:
        nc, pc = fc - 2, fc - 1
        end = next(i for i in range(h + 1, len(rows))
                   if any('nontransfer' in NORM(v) for v in rows[i][:5]))
        source_rows = [r for r in rows[h + 1:end] if isinstance(r[nc], str) and number(r[fc]) is not None]
        assert source_rows
        for r in source_rows:
            name = re.sub(r'\s+', ' ', r[nc]).strip()
            status = str(r[0] or '').strip()
            elected = NORM(status) in ('elected', 'e')
            # In these non-Belfast workbooks this column records election order.
            # Some final elected candidates have an order but no repeated label.
            if fc == 4 and not status and number(r[1]) and r[1] > 0:
                elected = True
            if name not in ids:
                ids[name] = len(candidates)
                candidates.append(dict(name=name, party=str(r[pc]).strip() if isinstance(r[pc], str) else 'Not stated',
                                       elected=elected, firstPreferences=number(r[fc]), sourceStatus=status))
            else:
                c = candidates[ids[name]]
                assert c['firstPreferences'] == number(r[fc])
                if NORM(status) in ('elected', 'e', 'excluded'):
                    c.update(elected=elected, sourceStatus=status)
        sr = next(i for i in range(h, max(-1, h - 7), -1)
                  if sum(bool(re.fullmatch(r'Stage\s+\d+', str(v).strip(), re.I)) for v in rows[i][:24]) >= 2)
        marks = [(int(re.search(r'\d+', str(v))[0]), j) for j, v in enumerate(rows[sr][:24])
                 if re.fullmatch(r'Stage\s+\d+', str(v).strip(), re.I)]
        nt = rows[end]
        reported = next(r for r in rows[end + 1:] if any(NORM(v) == 'totals' for v in r[:5]))
        for stage, col in marks:
            total_col = fc if stage == 1 else col + 1
            values = [None] * len(candidates)
            changes = [None] * len(candidates)
            for r in source_rows:
                i = ids[re.sub(r'\s+', ' ', r[nc]).strip()]
                values[i] = number(r[total_col])
                if stage > 1:
                    changes[i] = number(r[col])
            populated = any(v for v in values) or any(v for v in changes)
            if not populated:
                continue
            action = 'First preferences' if stage == 1 else ' — '.join(str(rows[i][col]).strip()
                     for i in (sr + 1, sr + 2) if rows[i][col] not in (None, 0, ''))
            candidate = dict(number=stage, action=action or f'Stage {stage}', totals=values,
                             changes=changes, nonTransferable=number(nt[total_col]), reportedTotal=number(reported[total_col]))
            if stage > 1 and not any(v for v in values):
                candidate['incomplete'] = True
            if stage in stages:
                # Later overviews repeat stage 1 and the final previous stage.
                assert stages[stage]['totals'] == values, (dea, stage)
            else:
                stages[stage] = candidate
    assert sum(c['firstPreferences'] for c in candidates) == valid, dea
    assert sum(c['elected'] for c in candidates) == seats, (dea, sum(c['elected'] for c in candidates), seats)
    ordered = sorted(stages.values(), key=lambda s: s['number'])
    assert [s['number'] for s in ordered] == list(range(1, len(ordered) + 1)), dea
    notes = [] if quota is not None else ["The quota cell is blank in the published workbook."]
    for s in ordered:
        if s.get('incomplete'):
            notes.append(f"The published overview marks the final result, but stage {s['number']} totals are uncompleted. No missing transfers have been reconstructed.")
            continue
        total = round(sum(v or 0 for v in s['totals']) + (s['nonTransferable'] or 0), 2)
        if abs(total - valid) > .011:
            notes.append(f"Stage {s['number']}: published candidate totals and non-transferable value sum to {total:,.2f}, compared with {valid:,.0f} valid ballots. These figures are retained as published.")
    return dict(dea=dea, council=entry['council'], seats=int(seats), quota=int(quota) if quota is not None else None, validBallots=int(valid),
                invalidBallots=field(rows, {'invalidvotes'}), electorate=field(rows, {'eligibleelectorate'}),
                votesPolled=field(rows, {'votespolled', 'totalvotespolled'}), candidates=candidates, stages=ordered,
                source={k: entry[k] for k in ('url', 'filename', 'sha256')} | {'sheet': sheet.title}, notes=notes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads((args.source / 'manifest.json').read_text())
    results = []
    for entry in manifest['files']:
        if not entry['filename'].endswith('.xlsx') or not entry.get('council'):
            continue
        path = args.source / entry['filename']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']
        book = openpyxl.load_workbook(path, data_only=True)
        for sheet in book:
            results.append(extract(sheet, entry))
    assert len(results) == 38
    dest = ROOT / 'source-data/council/northern-ireland-2023/spreadsheet-counts.json'
    dest.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    print(f"{len(results)} DEAs; {sum(r['seats'] for r in results)} winners; {sum(bool(r['notes']) for r in results)} source-note reports")


if __name__ == '__main__':
    main()
