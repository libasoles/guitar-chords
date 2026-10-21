"""Which noteheads of a scanned staff sound together, and for how long (heuristics of issue #43).

Pure geometry on a binary image (True = ink); no OMR engine involved, so the same rules serve the local
transcription helper (`scripts/carcassi-preludios/detect_notes.py`) and any quality check on engine output.

Rules, in order of trust:
1. Noteheads on both sides of one stem are one chord (an Ataque), even when a second displaces them
   horizontally. Same x alone is never enough: another voice or a compact arpeggio can share it.
2. Rhythm comes from the stem tip: a beam is a dark run thicker than a staff line and thinner than a head.
   One beam is an eighth, two are sixteenths; none means a flag or an unbeamed note and is left unread.
3. Distances are fractions of the staff spacing, never pixels, so scale does not matter.
4. When the image cannot settle the reading, the chord carries an issue instead of a guess. Nothing is
   forced from the measure total or from harmony (three eighths and six sixteenths add up the same).
"""

import numpy as np

STEM_MIN_RUN = 2.6        # a stem is at least this many staff spaces tall
STEM_MAX_WIDTH = 0.4      # ... and thinner than this
STEM_TOUCH = 0.3          # a head touches a stem when its edge is this close
STEM_REACH = 0.6          # ... and the stem extends this far past the head's center vertically
BEAM_MIN = 0.28           # a beam is thicker than a staff line
BEAM_MAX = 0.85           # ... and thinner than a notehead
BEAM_SIDE = 0.7           # horizontal offset from the stem where beams are sampled
NEIGHBOUR_X = 1.6         # heads this close horizontally with different stems need review
NEIGHBOUR_Y = 1.1


# --- Noteheads --------------------------------------------------------------

def box_sum(mask, k):
    """Sum per k x k window (top-left corner), via an integral image."""
    integral = np.pad(mask.astype(np.int32).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    return integral[k:, k:] - integral[:-k, k:] - integral[k:, :-k] + integral[:-k, :-k]


def opening(mask, k):
    """Morphological opening with a k x k window: removes lines, stems and thin beams, keeps solid heads."""
    eroded = box_sum(mask, k) == k * k
    padded = np.pad(eroded, ((k - 1, k - 1), (k - 1, k - 1)))
    return box_sum(padded, k) > 0


def components(mask):
    """4-connected components as (pixels, cx, cy, width, height, (x0, y0, x1, y1))."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack, pixels = [(y, x)], []
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            pixels.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        ys, xs = zip(*pixels)
        out.append((len(pixels), np.mean(xs), np.mean(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1,
                    (min(xs), min(ys), max(xs), max(ys))))
    return out


def _stacked(opened, box, spacing):
    """Heads of one blob (or half blob): stacked heads fuse, so the height says how many."""
    x0, y0, x1, y1 = box
    ys, xs = np.nonzero(opened[y0:y1 + 1, x0:x1 + 1])
    if len(ys) == 0:
        return []
    h, cy, cx = ys.max() - ys.min() + 1, y0 + (ys.max() + ys.min()) / 2, x0 + (xs.max() + xs.min()) / 2
    w = xs.max() - xs.min() + 1
    n = max(1, round((h - .95 * spacing) / spacing) + 1) if h > 1.4 * spacing else 1
    return [{"cx": float(cx), "cy": float(cy + (i - (n - 1) / 2) * spacing), "w": float(w), "h": float(h / n)}
            for i in range(n)]


def find_heads(mask, spacing):
    """Filled noteheads as dicts {cx, cy, w, h}. Stacked heads (thirds) come out fused: the height says how many.
    A blob up to three heads wide is a chord with heads on both sides of the stem (a second): each half is read
    on its own, so the displaced heads are found even though they touch."""
    opened = opening(mask, max(3, int(round(.62 * spacing))))
    area0 = .8 * spacing * spacing
    heads = []
    for area, cx, cy, w, h, (x0, y0, x1, y1) in components(opened):
        if not (.35 * area0 < area < 14 * area0 and w < 3.2 * spacing and h < 5.5 * spacing):
            continue
        if w > 1.7 * spacing:
            mid = (x0 + x1) // 2
            for half in ((x0, y0, mid, y1), (mid + 1, y0, x1, y1)):
                heads += _stacked(opened, half, spacing)
        else:
            heads += _stacked(opened, (x0, y0, x1, y1), spacing)
    return heads


# --- Stems ------------------------------------------------------------------

def _longest_run(column):
    """(length, start) of the longest True run in a 1-D bool array."""
    padded = np.concatenate(([False], column, [False]))
    edges = np.flatnonzero(padded[1:] != padded[:-1])
    if len(edges) == 0:
        return 0, 0
    starts, ends = edges[::2], edges[1::2]
    i = int(np.argmax(ends - starts))
    return int(ends[i] - starts[i]), int(starts[i])


def find_stems(mask, top, bottom, spacing, barlines=()):
    """Stems between rows `top` and `bottom` as dicts {x, y0, y1}: thin columns with a long vertical ink run.
    A stem pressed against stacked heads merges with their columns into a wide group; there it is recovered
    from the end of the run that sticks out furthest (the tip, where only the stem has ink).
    Barlines (given by x) are not stems."""
    top, bottom = max(0, int(top)), min(mask.shape[0], int(bottom))
    runs = [_longest_run(mask[top:bottom, x]) for x in range(mask.shape[1])]
    candidate = [x for x, (length, _) in enumerate(runs) if length >= STEM_MIN_RUN * spacing]
    stems, group = [], []
    for x in candidate + [None]:
        if group and (x is None or x != group[-1] + 1):
            stem = _stem_of(group, runs, top, spacing)
            if stem:
                stems.append(stem)
            group = []
        if x is not None:
            group.append(x)
    return [s for s in stems if all(abs(s["x"] - b) > .3 * spacing for b in barlines)]


def _stem_of(group, runs, top, spacing):
    tops = {x: runs[x][1] for x in group}
    bottoms = {x: runs[x][1] + runs[x][0] for x in group}
    if len(group) <= STEM_MAX_WIDTH * spacing:
        pick = group
    else:
        edge = max(1.5, .06 * spacing)
        up = [x for x in group if tops[x] <= min(tops.values()) + edge]
        down = [x for x in group if bottoms[x] >= max(bottoms.values()) - edge]
        # the tip that sticks out further than the rest of the group is the stem's
        sticks = (max(tops.values()) - min(tops.values()), max(bottoms.values()) - min(bottoms.values()))
        pick = up if sticks[0] >= sticks[1] else down
        if not pick or len(pick) > STEM_MAX_WIDTH * spacing or max(sticks) < .5 * spacing:
            return None
    return {"x": float(np.mean(pick)), "y0": float(top + min(tops[x] for x in pick)),
            "y1": float(top + max(bottoms[x] for x in pick))}


def count_beams(mask, stem, up, spacing):
    """Beams hanging from the stem tip: the dark runs of beam thickness in a column beside the stem, either side.
    None when there is no beam (flag, or unbeamed): that is not an eighth or a sixteenth we can claim."""
    tip = stem["y0"] if up else stem["y1"]
    lo, hi = int(max(0, tip - 1.6 * spacing)), int(min(mask.shape[0], tip + 1.6 * spacing))
    best = 0
    for side in (-1, 1):
        x = int(round(stem["x"] + side * BEAM_SIDE * spacing))
        if not 0 <= x < mask.shape[1]:
            continue
        column = mask[lo:hi, x]
        padded = np.concatenate(([False], column, [False]))
        edges = np.flatnonzero(padded[1:] != padded[:-1])
        # Only runs that touch the stem's tip zone count: ink far from the tip is a head or another voice.
        near = [(a, b) for a, b in zip(edges[::2], edges[1::2])
                if BEAM_MIN <= (b - a) / spacing <= BEAM_MAX and lo + a <= tip + .9 * spacing and lo + b >= tip - 1.4 * spacing]
        best = max(best, len(near))
    return best or None


# --- Chords -----------------------------------------------------------------

def issues_of(heads, members, stem, spacing):
    """Doubts about heads that share one stem: an adjacent pair must have its higher head on the right."""
    out = []
    for a in members:
        for b in members:
            ha, hb = heads[a], heads[b]
            if ha["cy"] < hb["cy"] and hb["cy"] - ha["cy"] < .75 * spacing \
                    and (ha["cx"] - stem["x"]) * (hb["cx"] - stem["x"]) < 0 and ha["cx"] < stem["x"]:
                out.append("segunda_invertida")
    return out


def read_chords(mask, heads, top, bottom, spacing, barlines=()):
    """Group `heads` into chords by shared stem. Returns chords left to right:
    {x, heads (high to low), stem, up, beams, issues}. `issues` lists what the image leaves unsettled:
      "sin_plica"      a filled head without any stem (a hollow or whole note is invisible here anyway)
      "plica_ambigua"  the head touches two stems
      "cabezas_proximas" heads one step apart with different stems: voices, or a chord whose stem was lost
      "segunda_invertida" a second on one stem with the higher head on the left: engraved chords put the
                         displaced (higher) head on the right, so this is two voices or a misread stem
    """
    stems = find_stems(mask, top, bottom, spacing, barlines)
    owner = {}
    issues = {i: [] for i in range(len(heads))}
    for i, head in enumerate(heads):
        touching = []
        for j, stem in enumerate(stems):
            edge = abs(abs(stem["x"] - head["cx"]) - head["w"] / 2)
            inside = abs(stem["x"] - head["cx"]) <= head["w"] / 2 + STEM_TOUCH * spacing
            reach = stem["y0"] - STEM_REACH * spacing <= head["cy"] <= stem["y1"] + STEM_REACH * spacing
            if inside and reach and edge <= STEM_TOUCH * spacing + head["w"] / 2:
                touching.append((edge, j))
        if not touching:
            issues[i].append("sin_plica")
        else:
            touching.sort()
            owner[i] = touching[0][1]
            if len(touching) > 1 and touching[1][0] - touching[0][0] < .15 * spacing:
                issues[i].append("plica_ambigua")

    chords = []
    for j in sorted({*owner.values()}, key=lambda s: stems[s]["x"]):
        members = sorted((i for i, s in owner.items() if s == j), key=lambda i: heads[i]["cy"])
        stem = stems[j]
        mean_y = float(np.mean([heads[i]["cy"] for i in members]))
        up = mean_y > (stem["y0"] + stem["y1"]) / 2  # heads at the bottom: the stem goes up
        found = list(dict.fromkeys(issues_of(heads, members, stem, spacing)))
        chords.append({"x": float(np.mean([heads[i]["cx"] for i in members])),
                       "heads": [heads[i] for i in members], "stem": stem, "up": up,
                       "beams": count_beams(mask, stem, up, spacing),
                       "issues": sorted({x for i in members for x in issues[i]} | set(found)), "_members": members})
    for i, head in enumerate(heads):
        if i not in owner:
            chords.append({"x": head["cx"], "heads": [head], "stem": None, "up": None, "beams": None,
                           "issues": issues[i], "_members": [i]})
    for a in chords:
        for b in chords:
            if a is b or a["stem"] is b["stem"]:
                continue
            if any(abs(p["cx"] - q["cx"]) < NEIGHBOUR_X * spacing and abs(p["cy"] - q["cy"]) < NEIGHBOUR_Y * spacing
                   for p in a["heads"] for q in b["heads"]):
                if "cabezas_proximas" not in a["issues"]:
                    a["issues"].append("cabezas_proximas")
    for c in chords:
        del c["_members"]
    return sorted(chords, key=lambda c: c["x"])
