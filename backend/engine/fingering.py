"""Fingering rules for arpeggio passages (issue #42); criteria and sources in docs/criterios-de-digitacion.md.

Pure Python on cells (no music21), so `tabify.assign_frets`, the web converter and the collection scripts share
one implementation. A *cell* is `(string, fret)`, string 0 = the highest one, like ascii-tabs Columns.

Rules (arpeggio measures only; a melody by steps or a scale puts notes on one string, which is right there):
1. Two different notes in a row do not share a string (`0-3`, `3-0`, `0-3-0` on one string): the first rings
   out when the second is fretted.
2. A repeated note stays on its string; moving it costs.
3. Economy of fingers: within a measure a pitch keeps one cell, so the finger that fretted it can stay or
   return to it instead of the hand re-learning a second shape (Carcassi: the fingers of an arpeggio chord
   "must remain unmoved"; Aguado: the finger stays while its note lasts).
4. A beamed group of three notes (an eighth in triplets, a 6/8 beat) is plucked p-i-m across three strings: each
   note of the group gets its own string, so a pitch that repeats inside the group (C4 E4 E4) is played on two
   strings rather than twice on one.
5. A measure that mixes open strings with notes from fret `open_reach` to 11 is fingered as a full chord
   shape in position, like a barre, with no open strings (fret 12 is a harmonic).
Secondary costs, hand-tuned on Carcassi's 16 preludes: leaving the engine's choice (0.5 per changed note),
high frets (0.4 per fret over the 4th) and hand movement (0.6 per fret, the hand keeps its position over open
strings).
"""

import collections
import re

SAME_STRING = 8.0       # two different notes in a row on one string
REPEAT_MOVED = 3.0      # a repeated note changes string
KEEP_ENGINE = 0.5       # per changed note
HIGH_FRET = 0.4         # per fret over the 4th
HAND_MOVE = 0.6         # per fret of hand movement
GROUP_SHARED = 5.0      # two notes of one beamed group of three on one string, even the same pitch
MAX_GROUP = 3           # larger groups (a run of six) cannot give each note a string of its own

# Detection: a measure is an arpeggio when its notes are sung one at a time, jump, recur and keep a steady pulse.
MIN_SINGLES = 4         # single-note columns needed
SINGLE_SHARE = .75      # of the measure's columns
MIN_RECURRENCE = 1.6    # notes per distinct pitch: the chord's notes come back
MIN_LEAPS = .5          # share of intervals of 3 semitones or more (a scale moves by steps)
ALL_LEAPS = .9          # ... a run of leaps this pure is a broken chord even if no pitch comes back
STEADY_PULSE = .75      # share of gaps equal to the shortest one


def detect_arpeggios(measures):
    """Per measure, whether it reads as an arpeggio. `measures`: per measure, the columns in time order as
    `(offset, [midi, ...])`. Rests and chords do not count as arpeggio notes; a chord column lowers the share
    of single notes, so a block-chord measure is never an arpeggio."""
    return [_is_arpeggio(columns) for columns in measures]


def _is_arpeggio(columns):
    singles = [(offset, midis[0]) for offset, midis in columns if len(midis) == 1]
    if len(singles) < MIN_SINGLES or len(singles) < SINGLE_SHARE * len(columns):
        return False
    pitches = [m for _, m in singles]
    steps = [abs(b - a) for a, b in zip(pitches, pitches[1:]) if a != b]
    leaps = sum(1 for s in steps if s >= 3)
    if not steps or leaps < MIN_LEAPS * len(steps):
        return False
    if len(pitches) < MIN_RECURRENCE * len(set(pitches)) and leaps < ALL_LEAPS * len(steps):
        return False
    gaps = [round(b - a, 4) for (a, _), (b, _) in zip(singles, singles[1:])]
    shortest = min(gaps)
    return shortest > 0 and sum(1 for g in gaps if g == shortest) >= STEADY_PULSE * len(gaps)


def hand(option):
    fretted = [f for _, f in option if f > 0]
    return min(fretted) if fretted else None


def _single(option):
    return option[0] if len(option) == 1 else None


def solve(layers, opens, groups=None):
    """Viterbi over layers `[(options, original)]`: the cheapest option per layer. Costs: leaving the engine's
    choice, high frets, hand movement, and the string rules 1 and 2 between consecutive single notes. `groups`: per
    layer, the id of the beamed group of three it belongs to or None (rule 4)."""
    def own(option, original):
        h = hand(option)
        return (0 if option == original else KEEP_ENGINE) + (HIGH_FRET * max(0, h - 4) if h else 0)

    states = [[(o, hand(o)) for o in layers[0][0]]]
    cost = [[own(o, layers[0][1]) for o, _ in states[0]]]
    back = [[None] * len(states[0])]
    for i in range(1, len(layers)):
        options, original = layers[i]
        row, costs, backs = [], [], []
        for option in options:
            h = hand(option)
            best = None
            for j, (prev, ph) in enumerate(states[i - 1]):
                c = cost[i - 1][j] + own(option, original)
                if h is not None and ph is not None:
                    c += HAND_MOVE * abs(h - ph)
                now, was = _single(option), _single(prev)
                if now and was:
                    together = groups is not None and groups[i] is not None and groups[i] == groups[i - 1]
                    same_pitch = opens[now[0]] + now[1] == opens[was[0]] + was[1]
                    if together and same_pitch and now[0] == was[0]:
                        c += GROUP_SHARED
                    elif same_pitch and now[0] != was[0] and not together:
                        c += REPEAT_MOVED
                    elif not same_pitch and now[0] == was[0]:
                        c += SAME_STRING
                if best is None or c < best[0]:
                    best = (c, j)
            row.append((option, h if h is not None else states[i - 1][best[1]][1]))
            costs.append(best[0])
            backs.append(best[1])
        states.append(row)
        cost.append(costs)
        back.append(backs)
    k = min(range(len(cost[-1])), key=lambda j: cost[-1][j])
    chosen = [None] * len(layers)
    for i in range(len(layers) - 1, -1, -1):
        chosen[i] = states[i][k][0]
        k = back[i][k]
    return chosen


def violations(chosen, opens, groups=None):
    """Consecutive different single notes on one string (rule 1), and consecutive notes of one group on one string
    (rule 4), in a chosen sequence."""
    count = 0
    for i, (a, b) in enumerate(zip(chosen, chosen[1:]), 1):
        x, y = _single(a), _single(b)
        if x and y and x[0] == y[0]:
            together = groups is not None and groups[i] is not None and groups[i] == groups[i - 1]
            if together or opens[x[0]] + x[1] != opens[y[0]] + y[1]:
                count += 1
    return count


def _one_cell_per_pitch(layers, owner, chosen, opens, active, groups=None):
    """Rule 3: restrict each pitch of an active measure to the cell most of its notes were given. A pitch that
    repeats inside a group is left free: rule 4 wants it on two strings."""
    in_group = collections.Counter(
        (g, opens[original[0][0]] + original[0][1]) for g, (_, original) in zip(groups or [None] * len(layers), layers)
        if g is not None and len(original) == 1)
    votes = collections.defaultdict(collections.Counter)
    for m, option in zip(owner, chosen):
        if m in active and len(option) == 1:
            votes[m][option[0]] += 1
    restricted = []
    for m, g, (options, original) in zip(owner, groups or [None] * len(layers), layers):
        if m in active and len(original) == 1:
            pitch = opens[original[0][0]] + original[0][1]
            if g is not None and in_group[(g, pitch)] > 1:
                restricted.append((options, original))
                continue
            winners = [cell for cell, _ in votes[m].most_common() if opens[cell[0]] + cell[1] == pitch]
            kept = [o for o in options if len(o) == 1 and winners and o[0] == winners[0]]
            options = kept or options
        restricted.append((options, original))
    return restricted


def avoid_repeated_strings(tabs, opens, max_fret=9, open_reach=6, measures=None, economy=False, barres=None, groups=None,
                           pinned=None):
    """Apply the module's rules to `tabs` (one list of columns per measure, cells string 1 first) in place.
    `opens`: open-string MIDI, string 1 first. `measures`: indexes of the measures to treat as arpeggios
    (default all). `economy` adds rule 3 (off for the published collections, which predate it). Single-note columns of those measures are re-chosen over the whole piece (see `solve`);
    chords and the other measures keep their cells. `barres`: per measure, per column, the barre `(fret, strings)` in
    force or None; a single note keeps to the cells the barre allows. `groups`: per measure, per column, the id of the beamed group
    the column belongs to or None (rule 4; only groups of up to `MAX_GROUP` columns count). `pinned`: per measure, per column,
    whether it must keep its cells (a natural harmonic can only be played at its string's twelfth fret)."""
    active = set(range(len(tabs))) if measures is None else set(measures)
    flat = [col for measure in tabs for col in measure]
    owner = [m for m, measure in enumerate(tabs) for _ in measure]
    layers = []
    held = [b for measure in (barres or [[None] * len(m) for m in tabs]) for b in measure]
    fixed = [p for measure in (pinned or [[False] * len(m) for m in tabs]) for p in measure]
    for m, col, barre, keep in zip(owner, flat, held, fixed):
        cells = tuple((s, f) for s, f in enumerate(col) if f is not None)
        if len(cells) != 1 or m not in active or keep:
            layers.append(([cells], cells))
            continue
        pitch = opens[cells[0][0]] + cells[0][1]
        allowed = under_barre([(s, pitch - o) for s, o in enumerate(opens) if 0 <= pitch - o <= max_fret], barre)
        layers.append(([(cell,) for cell in allowed] or [cells], cells))
    if not flat:
        return tabs
    flat_groups = None
    if groups is not None:
        ids = [(m, g) if g is not None and m in active else None
               for m, measure in enumerate(groups) for g in measure]
        size = collections.Counter(i for i in ids if i is not None)
        flat_groups = [i if i is not None and size[i] <= MAX_GROUP else None for i in ids]

    chosen = solve(layers, opens, flat_groups)
    frets = {}
    for m, option in zip(owner, chosen):
        frets.setdefault(m, []).extend(f for _, f in option)
    stretched = {m for m in active if 0 in frets.get(m, []) and any(open_reach <= f < 12 for f in frets[m])}
    if stretched:
        layers = [([o for o in options if m not in stretched or len(o) != 1 or o[0][1] > 0] or options, original)
                  for m, (options, original) in zip(owner, layers)]
        chosen = solve(layers, opens, flat_groups)
    # Economy of fingers: one cell per pitch in a measure, kept only when it does not break rule 1.
    if economy:
        tidy = solve(_one_cell_per_pitch(layers, owner, chosen, opens, active, flat_groups), opens, flat_groups)
        if violations(tidy, opens, flat_groups) <= violations(chosen, opens, flat_groups):
            chosen = tidy
    for col, option in zip(flat, chosen):
        for s in range(len(col)):
            col[s] = None
        for s, f in option:
            col[s] = f
    return tabs


# --- Annotations in the score ---------------------------------------------------------------------------
# A left-hand finger (1-4), a string or a fret written on a note narrows where it can be played. The position
# is the fret under finger 1 (Carcassi, "The Positions"), so finger `d` on fret `f` implies `f - (d - 1)`.

EXTENSION = 1   # frets the hand may stretch beyond its position before a finger combination is impossible


def allowed_cells(midi, opens, hint, max_fret, barre=None):
    """The (string, fret) cells for `midi` that agree with its hint {string, fret, finger} and with the barre
    ((fret, strings), see `parse_barre`) in force; all of them if the hint contradicts the pitch (the pitch wins: a
    misread annotation must not drop a note). A barre that leaves the note no cell is ignored for it."""
    cells = [(s, midi - o) for s, o in enumerate(opens) if 0 <= midi - o <= max_fret]
    narrowed = [(s, f) for s, f in cells
                if (hint.get("string") is None or s == hint["string"])
                and (hint.get("fret") is None or f == hint["fret"])
                and (hint.get("finger") != 0 or f == 0)
                and not (hint.get("fretted") and f == 0)]
    return under_barre(narrowed or cells, barre)


# --- Barre ("cejilla") ------------------------------------------------------------------------------------
# The first finger lies across several strings at one fret for a stretch of the piece. Scores write it as «C 7»
# (full barre at fret VII) or «½C 7» (half barre) over a dashed line that lasts as long as the barre. While it
# holds, no string it covers can be open or sound below its fret: every note there is played at the barre's fret or
# higher. A full barre covers the six strings; a half barre the three highest (Carcassi, «The Barrer»).

BARRE_TEXT = re.compile(r"^\s*(½|1/2)?\s*C\.?\s*(\d{1,2}|[IVX]{1,5})\s*$")
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12}
HALF_BARRE_STRINGS = 3


def parse_barre(text):
    """`(fret, strings)` for a barre mark such as «C 7», «C.VII» or «½C 2»; None for any other text. `strings` is how
    many strings, counted from the highest, the barre covers."""
    match = BARRE_TEXT.match(text or "")
    if not match:
        return None
    word = match.group(2)
    fret = int(word) if word.isdigit() else ROMAN.get(word)
    if not fret:
        return None
    return fret, HALF_BARRE_STRINGS if match.group(1) else 6


def barre_text(fret, strings=6):
    """The mark a score prints for a barre (the inverse of `parse_barre`)."""
    return ("" if strings >= 6 else "½") + f"C {fret}"


# --- Natural harmonics --------------------------------------------------------------------------------------
# «Hr. 12», «Harm.», «Arm. XII» over a passage, a diamond head, or <harmonic> on a note: the note is the natural
# harmonic of the string whose open pitch is an octave below it, touched (not pressed) over the twelfth fret.
# It sounds where the fretted twelfth fret would, so the pitch alone cannot tell it from an ordinary note there.

HARMONIC_FRET = 12
HARMONIC_TEXT = re.compile(r"^\s*(?:harm(?:onics?|[oó]nicos?)?|hr|har|arm(?:[oó]nicos?)?|flag(?:eolet)?)\.?\s*(?:(?:12|XII)\.?)?\s*$",
                           re.I)
HARMONIC_PITCH_CLASSES = (2, 4, 7, 9, 11)  # D E G A B: the open strings of standard tuning and Drop D


def parse_harmonic(text):
    """Whether `text` is a harmonic mark (octave harmonic, fret XII). «Hr. 7» and «Hr. 5» name other nodes: None."""
    return bool(HARMONIC_TEXT.match(text or ""))


def harmonic_string(midi, opens, hint=None):
    """The string (0 = highest) whose octave harmonic sounds `midi`, or None. A written string number is kept when it
    is one of them."""
    strings = [s for s, o in enumerate(opens) if o + HARMONIC_FRET == midi]
    if hint and hint.get("string") in strings:
        return hint["string"]
    return strings[0] if strings else None


def under_barre(cells, barre):
    """`cells` ((string, fret) alternatives of one note) that a barre `(fret, strings)` allows; all of them when it
    allows none (a bass note below the barre keeps its pitch)."""
    if not barre:
        return cells
    fret, strings = barre
    return [(s, f) for s, f in cells if s >= strings or f >= fret] or cells


def fingers_possible(combo, fingers):
    """Whether `combo` ((string, fret) per note) can be held with the written fingers. `fingers[i]` is the left-hand
    finger of `combo[i]` or None. Impossible: one finger on two frets (a barre is finger 1 only), fingers in the
    opposite order of their frets, or positions that differ by more than a stretch."""
    held = [(f, d) for (_, f), d in zip(combo, fingers) if d and f > 0]
    for i, (fa, da) in enumerate(held):
        for fb, db in held[i + 1:]:
            if da == db and fa != fb:
                return False
            if da == db and fa == fb and da != 1 and len({s for (s, f), d in zip(combo, fingers) if d == da and f == fa}) > 1:
                return False
            if (fa - fb) * (da - db) < 0:
                return False
    positions = [f - (d - 1) for f, d in held]
    return not positions or max(positions) - min(positions) <= EXTENSION


def mark_fretted(hints, opens, max_fret):
    """Flags (`hint["fretted"]`) the fingered notes of one measure that must be pressed, not played open.

    A finger written on a note that could also be an open string is ambiguous: Sagreras' arpeggio studies put digits on
    notes the printed tab plays open, while Sor's `a-1 b-3` only works if the b is fret 4 of the a's string. What tells
    them apart is the neighbours: the note is pressed when another fingered pitch of the measure has a pressed cell
    whose lowest position (see above) is within a stretch of its own. A lone digit proves nothing and is left alone.
    `hints` is {midi: {finger, ...}} for the measure; the dicts are updated in place."""
    def position(midi, hint):
        """The lowest position where the written finger can hold the note: books keep to the low positions."""
        found = [f - (hint["finger"] - 1) for s, f in allowed_cells(midi, opens, hint, max_fret) if f > 0]
        return min(found) if found else None

    where = {m: position(m, h) for m, h in hints.items() if h.get("finger")}
    for midi, here in where.items():
        if here is not None and any(abs(here - there) <= EXTENSION for other, there in where.items()
                                    if other != midi and there is not None):
            hints[midi]["fretted"] = True
