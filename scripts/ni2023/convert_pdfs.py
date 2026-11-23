#!/usr/bin/env python3
"""Convert the 35 text-based EONI 2023 council count-sheet PDFs to normalized JSON.

Usage:
    /tmp/ni-stv-venv/bin/python -I scripts/ni2023/convert_pdfs.py \
        [SOURCE_DIR] [OUTPUT_JSON]

Defaults: SOURCE_DIR=source-data/council/northern-ireland-2023/originals,
OUTPUT_JSON=source-data/council/northern-ireland-2023/pdf-counts.json (relative to repo root).

These are official count-stage sheets, not ballot data.  The script reads
PyMuPDF word geometry (rotated pages normalised through page.rotation_matrix)
and places every number by its right edge under the per-stage column headers.
It never infers missing figures: blank cells are null.  Elected status comes
from explicit "Elected"/"E" marks, plus the verified winner-order column on
specific council templates. Mid Ulster candidate IDs and Newry template
numbers are never treated as election order.

Seven Fermanagh and Omagh PDFs are image scans handled elsewhere
(convert_scans.py) and are skipped here.

Per-DEA corrections made after visual inspection of the rendered originals are
listed in VISUAL_NOTES and appear as record notes.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

import pymupdf as fitz

REPO = Path(__file__).resolve().parents[2]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("source-data/council/northern-ireland-2023/originals")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO / "source-data/council/northern-ireland-2023/pdf-counts.json"

SCANNED = {"enniskillen", "erne-east", "erne-north", "erne-west", "omagh", "mid-tyrone", "west-tyrone"}
NUM = re.compile(r"^-?\d[\d,]*(?:\.\d+)?$")
# Unclipped text: cell text is clipped visually but the PDF carries the full
# string (e.g. "SDLP (SOCIAL DEMOCRATIC AND LABOUR PARTY)").
FLAGS = fitz.TEXTFLAGS_WORDS & ~fitz.TEXT_CLIP & ~fitz.TEXT_MEDIABOX_CLIP

# On these councils' sheets the "No" column numbers winners 1..seats in order of
# election, while "Elected" is written only beside candidates who reached quota;
# the last winners (deemed elected without quota) carry a No but no mark.
# Mid Ulster's "No." column is the ballot-paper candidate number and Newry,
# Mourne and Down use "E1".."E7" or other values, so neither is used there.
ELECTION_ORDER_COUNCILS = {
    "Armagh City, Banbridge and Craigavon Borough Council",
    "Causeway Coast and Glens Borough Council",
    "Mid and East Antrim Borough Council",
}

# Facts established by looking at the rendered original, keyed by file slug.
VISUAL_NOTES: dict[str, list[str]] = {
    "crotlieve": [
        "Visually checked: the 'No' column holds values such as 2, 9 and 10 that are not an election order "
        "(three winners show 10, three eliminated candidates show 2, Gibbons has none); winners come from the "
        "explicit 'Elected' marks only.",
        "Visually checked: the Stage 3 header has no Transfer/Exclude word, only the name 'McGaffin'; the "
        "figures show McGaffin's whole 451.00 leaving at that stage. The action is kept as printed.",
    ],
    "the-mournes": [
        "Visually checked: the Stage 9 header has no Transfer/Exclude word, only 'mckee'. Stage 9 records "
        "McKee's -1163.12 but no candidate or non-transferable receipts; the printed Totals is 12205.88 "
        "and the sheet's own 'Totals Correct' check reads ERROR for Stages 9 and 10. Stage 9 is kept as "
        "published and marked incomplete; no receipts are inferred.",
    ],
}


def num(t: str) -> float:
    v = round(float(t.replace(",", "")), 2)
    return int(v) if v.is_integer() else v


class W:
    """A whitespace-delimited word from a single PDF text span (one cell string).

    ``sx`` is the x where the span starts; cell text can overflow (it is clipped
    on the rendered page), so text is assigned to columns by where its cell
    string starts, never by where a word happens to land.
    """
    __slots__ = ("x0", "y0", "x1", "y1", "t", "sx", "sid", "chars")

    def __init__(self, x0, y0, x1, y1, t, sx, sid, chars=()):
        self.x0, self.y0, self.x1, self.y1, self.t, self.sx, self.sid = x0, y0, x1, y1, t, sx, sid
        self.chars = list(chars)  # (x0, x1, char)

    @property
    def yc(self):
        return (self.y0 + self.y1) / 2

    @property
    def xc(self):
        return (self.x0 + self.x1) / 2

    def __repr__(self):
        return f"{self.t}@{self.x0:.0f}-{self.x1:.0f},{self.yc:.0f}"


def page_words(page) -> list[W]:
    """Words, each tagged with the start x of its cell string.

    PyMuPDF merges adjacent same-font cell strings into one span, so a span is
    re-segmented wherever the text jumps backwards (an overflowing cell string
    followed by the next cell's text) or leaves a gap wider than a space.
    """
    out = []
    raw = page.get_text("rawdict", flags=FLAGS)
    m = page.rotation_matrix
    sid = 0
    for b in raw["blocks"]:
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                chars = []
                for c in sp["chars"]:
                    r = fitz.Rect(c["bbox"]) * m
                    r.normalize()
                    chars.append((r, c["c"]))
                segs, cur, last = [], [], None
                for r, c in chars:
                    if c.isspace():
                        cur.append((r, c))
                        continue
                    if last is not None and (r.x0 < last.x0 - 0.5 or r.x0 - last.x1 > 6):
                        segs.append(cur)
                        cur = []
                    cur.append((r, c))
                    last = r
                segs.append(cur)
                for seg in segs:
                    ink = [(r, c) for r, c in seg if not c.isspace()]
                    if not ink:
                        continue
                    sid += 1
                    sx = ink[0][0].x0
                    word = []
                    for r, c in seg + [(None, " ")]:
                        if c.isspace():
                            if word:
                                x0 = min(q.x0 for q, _ in word); x1 = max(q.x1 for q, _ in word)
                                y0 = min(q.y0 for q, _ in word); y1 = max(q.y1 for q, _ in word)
                                if not (x1 < 0 or y1 < 0 or x0 > page.rect.width or y0 > page.rect.height):
                                    out.append(W(x0, y0, x1, y1, "".join(ch for _, ch in word), sx, sid,
                                                 [(q.x0, q.x1, ch) for q, ch in word]))
                                word = []
                        else:
                            word.append((r, c))
    return out


def order_words(ws):
    """Reading order: lines (by span, clustered on y), then x; words keep span order."""
    spans = {}
    for w in ws:
        spans.setdefault(w.sid, []).append(w)
    groups = sorted(spans.values(), key=lambda g: g[0].yc)
    lines = []
    for g in groups:
        if lines and abs(lines[-1][0][0].yc - g[0].yc) < 3:
            lines[-1].append(g)
        else:
            lines.append([g])
    out = []
    for line in lines:
        for g in sorted(line, key=lambda g: g[0].x0):
            out.extend(g)
    return out


def same_line(a: W, b: W, tol=2.5) -> bool:
    return abs(a.yc - b.yc) <= tol


def line_of(words, ref: W, tol=2.5):
    return sorted((w for w in words if same_line(w, ref, tol)), key=lambda w: w.x0)


def value_after(words, label_words: list[str], tol=3.0):
    """Number to the right of a label phrase on the same line."""
    n = len(label_words)
    ws = sorted(words, key=lambda w: (round(w.yc), w.x0))
    for i, w in enumerate(ws):
        if w.t.lower() != label_words[0].lower():
            continue
        line = line_of(words, w, tol)
        j = line.index(w)
        if [x.t.lower() for x in line[j : j + n]] != [x.lower() for x in label_words]:
            continue
        for x in line[j + n :]:
            if NUM.match(x.t):
                return num(x.t)
            if x.t not in ("of", "%"):
                break
    return None


def parse_page(page):
    words = page_words(page)
    # header row with "Candidate"
    cand_hdr = [w for w in words if w.t == "Candidate"]
    assert len(cand_hdr) == 1, cand_hdr
    ch = cand_hdr[0]
    hdr = line_of(words, ch, 3)
    # stage labels: "Stage" + integer on a row above the header
    labels = []
    for w in words:
        if w.t == "Stage" and w.y1 < ch.y0:
            nxt = [x for x in line_of(words, w) if x.x0 > w.x1 - 1 and x.x0 - w.x1 < 6]
            if nxt and nxt[0].t.isdigit():
                labels.append((w, int(nxt[0].t), nxt[0]))
    # the stage-label row is the y with the most labels (title/nav "Stage N" excluded)
    label_row = max(([l for l in labels if abs(l[0].yc - ref[0].yc) < 3] for ref in labels), key=len)
    label_row.sort(key=lambda t: t[0].x0)
    stage_lab = [(k, (w.x0 + n.x1) / 2, w) for w, k, n in label_row]

    # Total-column header tokens (one per stage).  Stage 1 on most templates is
    # headed "1st Preference"; Mid Ulster heads it "Total" like the rest.
    tot_hdr = [w for w in hdr if w.t == "Total"]
    pref = [w for w in hdr if w.t == "Preference"]
    if pref:
        tot_hdr = pref + tot_hdr
    tot_hdr.sort(key=lambda w: w.x0)
    # map each total header to the stage label with greatest centre <= header right
    gaps = [b.x0 - a.x0 for a, b in zip(tot_hdr[1:], tot_hdr[2:])] or [60]
    pitch = sorted(gaps)[len(gaps) // 2]  # one stage = change + total sub-columns
    col = []  # (stage, totals_x0, zone_right)
    for i, t in enumerate(tot_hdr):
        cands = [s for s in stage_lab if s[1] <= t.x1 + 1]
        assert cands, (t, stage_lab)
        col.append([cands[-1][0], t.x0, t.x1 + 0.25 * pitch])
    stages_on_page = [c[0] for c in col]
    assert len(set(stages_on_page)) == len(stages_on_page), (stages_on_page, tot_hdr)

    def place(w: W):
        """Return (stage, 'change'|'total') for a number token, by its right edge."""
        r = w.x1
        for stage, tx0, zr in col:
            if r <= zr:
                return stage, ("total" if r > tx0 else "change")
        return None

    # footer rows
    nt = [w for w in words if w.t.lower().startswith("non") and w.y0 > ch.y1 and
          any(x.t.lower().startswith("transferable") or "transferable" in x.t.lower() for x in line_of(words, w))]
    assert nt, "no non-transferable row"
    nt_w = nt[0]
    tot_rows = [w for w in words if w.t.lower() == "totals" and w.y0 > nt_w.y0 - 1 and
                not any(x.t == "Correct" for x in line_of(words, w))]
    totals_w = min(tot_rows, key=lambda w: w.y0) if tot_rows else None

    no_hdr = [w for w in hdr if w.t in ("No", "No.")]
    party_hdr = [w for w in hdr if w.t in ("Description", "Party")]
    assert no_hdr and party_hdr, hdr
    no_x0, party_x0 = no_hdr[0].x0, party_hdr[0].x0
    num_hdr = [w for w in hdr if w.t in ("Rec", "Total", "1st", "Preference")]
    first_num_x0 = min(w.x0 for w in num_hdr) - 0.25 * pitch

    # Rows: some Mid Ulster sheets top-align figures but centre text in taller
    # cells, so every word goes to the nearest row anchor rather than a fixed line.
    bottom = (totals_w.yc + 8) if totals_w else (nt_w.yc + 8)
    region = [w for w in words if ch.y1 < w.yc < bottom]
    area = [w for w in region if w.yc < nt_w.y0 - 1]
    mid_ulster = any(w.t == "Rec" for w in hdr)
    if mid_ulster:
        # Mid Ulster wraps long names onto lines above/below the figures and some
        # rows lack a No.; the one-line party cell sits on the figures line.
        anchors = {}
        for w in area:
            if party_x0 - 3 <= w.sx < first_num_x0 and not NUM.match(w.t):
                anchors.setdefault(w.sid, w)
        anchors = list(anchors.values())
    else:
        anchors = [w for w in area if NUM.match(w.t) and place(w) == (1, "total")]
    anchors.sort(key=lambda w: w.yc)
    assert anchors, "no candidate anchors"
    cand_rows = [{"anchor": a, "words": []} for a in anchors]
    nt_row = {"anchor": nt_w, "words": []}
    tot_row = {"anchor": totals_w, "words": []}
    all_rows = cand_rows + [nt_row] + ([tot_row] if totals_w else [])
    spacing = sorted(b["anchor"].yc - a["anchor"].yc for a, b in zip(all_rows, all_rows[1:]))
    spacing = spacing[len(spacing) // 2] if spacing else 15
    for w in region:
        best = min(all_rows, key=lambda c: abs(c["anchor"].yc - w.yc))
        if abs(best["anchor"].yc - w.yc) < 0.75 * spacing + 2:
            best["words"].append(w)
        else:
            raise AssertionError(f"orphan word {w}")

    cands = []
    for c in cand_rows:
        ws = order_words(c["words"])
        mark = " ".join(w.t for w in ws if w.x1 < no_hdr[0].x0 - 1)
        no_ws = [w for w in ws if w.x1 >= no_hdr[0].x0 - 1 and w.x1 < ch.x0 + 1 and re.fullmatch(r"E?\d+", w.t)]
        no = " ".join(w.t for w in no_ws)
        name_ws = [w for w in ws if w.x1 >= no_hdr[0].x0 - 1 and w not in no_ws and w.sx < party_x0 - 2]
        party_ws = [w for w in ws if party_x0 - 2 <= w.sx < first_num_x0 and not NUM.match(w.t)]
        if not party_ws:
            # Name cell ends flush against the party cell and PyMuPDF fused the
            # two strings: split at the first character inside the party column.
            # The party string starts exactly at the Description column's left
            # text edge (the header word's x0); everything from there is party.
            keep, in_party = [], False
            for w in name_ws:
                hits = [i for i, (x0, _, _) in enumerate(w.chars) if abs(x0 - party_x0) < 0.6]
                # prefer the character that overlaps its predecessor (start of new string)
                over = [i for i in hits if i and w.chars[i][0] < w.chars[i - 1][1] - 0.5]
                cut = 0 if in_party else (over or hits or [None])[0]
                if cut is None:
                    keep.append(w.t)
                else:
                    in_party = True
                    if cut:
                        keep.append(w.t[:cut])
                    party_ws.append(w.t[cut:])
            name = " ".join(keep)
            party = " ".join(t if isinstance(t, str) else t.t for t in party_ws)
            split_note = f"name/party text fused in PDF; split at Description column: '{name}' / '{party}'"
        else:
            name = " ".join(w.t for w in name_ws)
            party = " ".join(w.t for w in party_ws)
            split_note = None
        stray = [w for w in ws if w.sx >= first_num_x0 and not NUM.match(w.t)]
        assert not stray, f"non-numeric text among figures {stray}"
        figs = {}
        for w in ws:
            if NUM.match(w.t) and w.sx >= first_num_x0:
                p = place(w)
                assert p, f"unplaced {w}"
                assert p not in figs, f"duplicate cell {p} {w} {figs}"
                figs[p] = num(w.t)
        cands.append({"name": " ".join(name.split()), "party": " ".join(party.split()),
                      "mark": mark, "no": no, "figs": figs, "split_note": split_note})

    def row_figs(row):
        figs = {}
        for w in row["words"]:
            if NUM.match(w.t) and w.sx >= first_num_x0:
                p = place(w)
                assert p and p not in figs, (w, figs)
                figs[p] = num(w.t)
        return figs

    # stage header text (action), between the label row and the header row
    lab_y = label_row[0][0].y1
    centres = sorted(stage_lab, key=lambda s: s[1])
    actions = {}
    for idx, (k, cx, _) in enumerate(centres):
        left = (centres[idx - 1][1] + cx) / 2 if idx else cx - 40
        right = (cx + centres[idx + 1][1]) / 2 if idx + 1 < len(centres) else cx + 40
        spans = {}
        for w in words:
            if lab_y < w.yc < ch.y0 - 1:
                spans.setdefault(w.sid, []).append(w)
        texts = []
        for sp in spans.values():
            xc = (min(w.x0 for w in sp) + max(w.x1 for w in sp)) / 2
            txt = " ".join(w.t for w in sp)
            if left <= xc < right and k != 1 and txt != "Result":
                texts.append((round(sp[0].yc), sp[0].x0, txt))
        actions[k] = " ".join(t for _, _, t in sorted(texts))

    return {
        "words": words,
        "stages": stages_on_page,
        "cands": cands,
        "nt": row_figs(nt_row),
        "totals": row_figs(tot_row),
        "actions": actions,
        "mid_ulster": mid_ulster,
        "stage_centres": [(k, cx) for k, cx, _ in stage_lab],
    }


def norm_action(text: str) -> str:
    t = " ".join(text.split())
    for pre, verb in (("Transfer / Exclusion of", None), ("Exclusion of", "Exclude"), ("Transfer of", "Transfer"),
                      ("Exclude", "Exclude"), ("Transfer", "Transfer")):
        if t.startswith(pre):
            rest = t[len(pre):].strip()
            if verb is None:
                return t
            return f"{verb} — {rest}" if rest else verb
    return t


def key_name(n: str) -> str:
    return re.sub(r"[^a-z]", "", n.lower())


def parse_doc(path: Path, meta: dict) -> dict:
    doc = fitz.open(path)
    pages = [parse_page(p) for p in doc]
    words0 = pages[0]["words"]
    slug = path.stem.split("result-sheet-")[1]
    notes: list[str] = []

    seats = value_after(words0, ["Number", "to", "be", "Elected"]) or value_after(words0, ["Number", "to", "be", "elected"])
    valid = value_after(words0, ["Total", "Valid", "Votes"])
    quota = value_after(words0, ["Electoral", "Quota", "of"]) or value_after(words0, ["Quota"])
    invalid = value_after(words0, ["Invalid", "Votes"])
    electorate = value_after(words0, ["Eligible", "Electorate"])
    polled = value_after(words0, ["Votes", "Polled"])

    base = pages[0]["cands"]
    cands = [{"name": c["name"], "party": c["party"], "mark": c["mark"], "no": c["no"]} for c in base]
    figs = [dict(c["figs"]) for c in base]
    nt = dict(pages[0]["nt"])
    totals_row = dict(pages[0]["totals"])
    actions = dict(pages[0]["actions"])
    for pg in pages[1:]:
        by = {key_name(c["name"]): i for i, c in enumerate(base)}
        assert len(pg["cands"]) == len(base), (slug, "page candidate count differs")
        for c in pg["cands"]:
            i = by[key_name(c["name"])]
            for k, v in c["figs"].items():
                assert k not in figs[i], (slug, k)
                figs[i][k] = v
            if c["mark"] and c["mark"] != cands[i]["mark"]:
                notes.append(f"Elected mark '{c['mark']}' for {c['name']} appears on page 2 only (page 1 copy unmarked).")
                if not cands[i]["mark"]:
                    cands[i]["mark"] = c["mark"]
        for k, v in pg["nt"].items():
            nt.setdefault(k, v)
        for k, v in pg["totals"].items():
            totals_row.setdefault(k, v)
        for k, v in pg["actions"].items():
            if k not in actions or not actions[k]:
                actions[k] = v
    if len(pages) > 1:
        notes.append(f"Source has {len(pages)} pages; later stages continue on page 2 with the candidate list repeated; combined by candidate name.")

    all_stages = sorted({s for pg in pages for s in pg["stages"]})
    populated = [s for s in all_stages if any((s, "total") in f or (s, "change") in f for f in figs)]
    ghost = [s for s in all_stages if s not in populated and actions.get(s)]
    for s in ghost:
        notes.append(f"Template column Stage {s} carries header text '{' '.join(actions[s].split())}' but no candidate figures; not included.")
    assert populated == list(range(1, len(populated) + 1)), (slug, populated)

    stages = []
    for s in populated:
        totals = [f.get((s, "total")) for f in figs]
        changes = [f.get((s, "change")) for f in figs]
        st = {
            "number": s,
            "action": "First preferences" if s == 1 else norm_action(actions.get(s, "")),
            "totals": totals,
        }
        if s > 1:
            st["changes"] = changes
        st["nonTransferable"] = nt.get((s, "total"))
        st["reportedTotal"] = totals_row.get((s, "total"))
        stages.append(st)

    order_family = meta["council"] in ELECTION_ORDER_COUNCILS
    if order_family:
        nos = sorted(int(c["no"]) for c in cands if c["no"])
        assert nos == list(range(1, seats + 1)), (slug, "No column is not 1..seats", nos)
        assert all(c["no"] for c in cands if c["mark"] == "Elected"), (slug, "Elected without No")
    out_cands = []
    by_no = []
    for c, f in zip(cands, figs):
        mark = c["mark"]
        assert mark in ("", "Elected", "E", "Excluded"), (slug, mark)
        elected = mark in ("Elected", "E")
        status = mark
        if order_family and c["no"]:
            status = f"{mark} No. {c['no']}".strip()
            if not elected:
                by_no.append(f"{c['name']} (No. {c['no']})")
            elected = True
        rec = {"name": c["name"], "party": c["party"], "elected": elected,
               "firstPreferences": f.get((1, "total")), "sourceStatus": status}
        out_cands.append(rec)
    if by_no:
        notes.append("'Elected' is printed only beside candidates who reached quota; the 'No' column numbers all "
                     f"{seats} winners in order of election. Counted as elected from the 'No' column without an "
                     "'Elected' mark: " + "; ".join(by_no) + ".")

    # Sheet heading "Stage N" (the spreadsheet's current stage) vs published columns.
    title = [w for w in words0 if w.t == "Stage" and w.yc < min(x.yc for x in words0 if x.t == "Candidate")]
    title_stage = None
    if title:
        top = min(title, key=lambda w: (w.yc, w.x0))
        nxt = [x for x in line_of(words0, top) if x.x0 > top.x1 - 1 and x.x0 - top.x1 < 6]
        if nxt and nxt[0].t.isdigit() and not pages[0]["mid_ulster"]:
            title_stage = int(nxt[0].t)
    if title_stage and title_stage != len(populated):
        notes.append(f"Sheet heading reads 'Stage {title_stage}'; figures are published for Stages 1-{len(populated)} only.")
    errs = [w for w in words0 if w.t == "ERROR"]
    if errs:
        centres = pages[0]["stage_centres"]
        err_st = sorted({min(centres, key=lambda c: abs(c[1] - w.xc))[0] for w in errs})
        pub = [k for k in err_st if k in populated]
        unpub = [k for k in err_st if k not in populated]
        bits = []
        if pub:
            bits.append("published Stage(s) " + ", ".join(map(str, pub)))
        if unpub:
            bits.append("unpublished template Stage(s) " + ", ".join(map(str, unpub)))
        notes.append("The sheet's 'Totals Correct' check row reads ERROR under " + " and ".join(bits) + ".")
    for st in stages:
        tot = sum(v for v in st["totals"] if v is not None) + (st["nonTransferable"] or 0)
        if abs(tot - valid) > 0.015:
            st["incomplete"] = True
    if pages[0]["mid_ulster"]:
        notes.append("Mid Ulster sheet format prints valid votes, quota and % poll but not electorate, invalid "
                     "votes or votes polled; those fields are null. The 'No.' column is the candidate's "
                     "ballot number, not an election order.")

    label = re.sub(r"\s*\(PDF\)\s*$", "", meta["label"]).strip()
    return {
        "dea": label,
        "council": meta["council"],
        "seats": seats,
        "quota": quota,
        "validBallots": valid,
        "invalidBallots": invalid,
        "electorate": electorate,
        "votesPolled": polled,
        "candidates": out_cands,
        "stages": stages,
        "source": {"url": meta["url"], "filename": meta["filename"], "sha256": meta["sha256"]},
        "notes": notes,
        "_slug": slug,
    }


def validate(r: dict) -> list[str]:
    """Return validation findings (also stored as notes when they are source facts)."""
    issues = []
    c = r["candidates"]
    fp = round(sum(x["firstPreferences"] or 0 for x in c), 2)
    if fp != r["validBallots"]:
        issues.append(f"first-preference sum {fp} != valid ballots {r['validBallots']}")
    nwin = sum(x["elected"] for x in c)
    if nwin != r["seats"]:
        issues.append(f"{nwin} marked elected but {r['seats']} seats")
    prev = None
    for st in r["stages"]:
        tot = st["totals"]
        s = round(sum(v for v in tot if v is not None) + (st["nonTransferable"] or 0), 2)
        if abs(s - r["validBallots"]) > 0.015:
            issues.append(f"stage {st['number']}: candidates+non-transferable = {s} vs valid {r['validBallots']} (diff {round(s - r['validBallots'], 2)})")
        if st["reportedTotal"] is not None and abs(st["reportedTotal"] - r["validBallots"]) > 0.015:
            issues.append(f"stage {st['number']}: printed Totals {st['reportedTotal']} != valid {r['validBallots']}")
        if prev is not None:
            ch = st["changes"]
            for i, x in enumerate(c):
                p, t, d = prev["totals"][i], tot[i], ch[i]
                if p is None:
                    if t is not None or d is not None:
                        issues.append(f"stage {st['number']}: {x['name']} has figures after a blank previous stage")
                    continue
                if t is None:
                    if d is None or abs(p + d) > 0.015:
                        issues.append(f"stage {st['number']}: {x['name']} total blank (prev {p}, change {d})")
                    continue
                exp = round(p + (d or 0), 2)
                if abs(exp - t) > 0.015:
                    issues.append(f"stage {st['number']}: {x['name']} prev {p} + change {d} = {exp} but total {t}")
            pn, n = prev["nonTransferable"], st["nonTransferable"]
            if pn is not None and n is not None and n < pn - 0.015:
                issues.append(f"stage {st['number']}: non-transferable decreased {pn} -> {n}")
        prev = st
    return issues


def main():
    manifest = json.loads((SRC / "manifest.json").read_text())
    metas = {f["filename"]: f for f in manifest["files"]}
    out = []
    for path in sorted(SRC.glob("local-council-elections-2023-result-sheet-*.pdf")):
        slug = path.stem.split("result-sheet-")[1]
        if slug in SCANNED:
            continue
        meta = metas[path.name]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == meta["sha256"], path
        try:
            r = parse_doc(path, meta)
        except Exception as e:  # report every failing sheet in one run
            print(f"FAIL {slug}: {e!r}"[:400])
            continue
        r["notes"].extend(VISUAL_NOTES.get(slug, []))
        out.append(r)
    report = {}
    for r in out:
        report[r["_slug"]] = validate(r)
        del r["_slug"]
    assert len(out) == 35, f"Expected 35 text-PDF reports; parsed {len(out)}. Existing output left untouched."
    assert sum(sum(c["elected"] for c in r["candidates"]) for r in out) == 202
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    nc = sum(len(r["candidates"]) for r in out)
    nw = sum(x["elected"] for r in out for x in r["candidates"])
    print(f"{len(out)} records, {nc} candidates, {nw} winners, {sum(r['seats'] for r in out)} seats, "
          f"{len({r['council'] for r in out})} councils, {sum(len(r['stages']) for r in out)} stages")
    print("validation findings (each must be a documented source issue):")
    for k, v in report.items():
        for i in v:
            print(f"  {k}: {i}")
    return report


if __name__ == "__main__":
    main()
