"""MusicXML score -> guitar tablature, as ascii-tabs columns and as an engraved PDF.

Pure operations on artifacts (no sessions): `prepare` and `export`, at the end
of this module. OMR (Audiveris) is not part of this module: it runs in its own
container (backend/ocr) and its MusicXML output is this module's input.

Pipeline:
  1. (Elsewhere) Audiveris turns the PDF into MusicXML.
  2. music21 reads the first part; every onset of a measure (all voices
     together) becomes one tab Column. Tied continuations are not re-plucked.
  3. A Viterbi search picks string/fret for every Column (chords included),
     keeping each chord within a hand span and minimising position shifts.
  4. The page edits the Columns with ascii-tabs; build_output() writes the
     edited frets as a TAB staff under the notation (one MusicXML part with two
     staves) and Verovio engraves it to SVG pages, merged into a PDF by
     rsvg-convert.
"""

import copy
import itertools
import json
import math
import os
import re
import subprocess
import tempfile
from fractions import Fraction
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

import music21 as m21
import verovio

verovio.enableLog(False)
# The wrapper only finds its fonts by itself on the main thread; the web app
# renders from request threads.
VEROVIO_DATA = os.path.join(os.path.dirname(verovio.__file__), "data")

STANDARD_TUNING = "E2,A2,D3,G3,B3,E4"  # string 6 -> string 1
DROP_D_TUNING = "D2,A2,D3,G3,B3,E4"
MAX_FRET = 19
MAX_SPAN = 4  # frets the hand covers without stretching
CANDIDATES_PER_COLUMN = 40
GUITAR_LOWEST = 38  # D2, the 6th string in Drop D

PREVIEW_OPTIONS = {
    "pageWidth": 2100, "pageHeight": 60000, "scale": 40, "adjustPageHeight": True,
    "breaks": "none", "pageMarginLeft": 60, "pageMarginRight": 20,  # left: string names
    "pageMarginTop": 0, "pageMarginBottom": 0, "header": "none", "footer": "none",
    "svgViewBox": True, "svgHtml5": True,
}
# Staff space in the preview SVGs' viewBox units (18 per 100 % of scale); the
# page sizes rows and tab digits from it so every row shares one scale.
PREVIEW_STAFF_SPACE = 18 * PREVIEW_OPTIONS["scale"] / 100
# Measure natural widths before justification; dense rows take fewer measures.
PREVIEW_MAX_ROW = 100 * PREVIEW_STAFF_SPACE
PREVIEW_MIN_ROW = 90 * PREVIEW_STAFF_SPACE
PDF_OPTIONS = {  # A4 at Verovio's 10 units per mm
    "pageWidth": 2100, "pageHeight": 2970, "scale": 45, "breaks": "auto",
    "pageMarginLeft": 220, "pageMarginRight": 100, "pageMarginTop": 80,  # left: brace and string names
    "pageMarginBottom": 80, "header": "auto", "footer": "none", "spacingStaff": 6,
}
# Verovio draws rhythm stems on tab staves; the reference layout has frets only.
HIDE_TAB_RHYTHM = "<style>g.tabDurSym, g.tabRhythm { display: none; }</style>"


def open_midis(tuning):
    """String 1 (high) first, like ascii-tabs Columns."""
    return [m21.pitch.Pitch(p).midi for p in tuning.split(",")][::-1]


def string_names(tuning):
    """American letters, string 1 (high) first."""
    return [m21.pitch.Pitch(p).name.replace("-", "♭") for p in reversed(tuning.split(","))]


def read_score(path):
    """Repair zero divisions from OMR using the written note lengths.

    Audiveris can export a half note with duration 1 and divisions 0 (the
    real scale is 1/2). Rescale the affected section to integer divisions;
    replacing zero with 1 alone would halve every note's duration.
    Keep the original MusicXML/MXL on disk intact.
    """
    if str(path).lower().endswith(".mxl"):
        xml = m21.converter.ArchiveManager(path).getData()
    else:
        with open(path, "rb") as source:
            xml = source.read()
    root = ET.fromstring(xml)
    repaired = False
    for part in root.findall("part"):
        sections = []
        section = None
        for element in part.iter():
            if element.tag == "divisions":
                section = None
                if Fraction(element.text) <= 0:
                    section = {"divisions": element, "notes": [], "durations": []}
                    sections.append(section)
            elif section is not None:
                if element.tag == "note":
                    section["notes"].append(element)
                elif element.tag == "duration":
                    section["durations"].append(element)
        for section in sections:
            scales = set()
            for note in section["notes"]:
                kind, duration = note.findtext("type"), note.findtext("duration")
                if kind is None or duration is None or note.find("grace") is not None:
                    continue
                written = m21.duration.Duration(type=kind)
                written.dots = len(note.findall("dot"))
                length = Fraction(written.quarterLength)
                tuplet = note.find("time-modification")
                if tuplet is not None:
                    length *= Fraction(int(tuplet.findtext("normal-notes")),
                                       int(tuplet.findtext("actual-notes")))
                if length > 0 and Fraction(duration) > 0:
                    scales.add(Fraction(duration) / length)
            if len(scales) != 1:
                raise ValueError("El MusicXML tiene una escala rítmica inválida (divisions=0) "
                                 "que no se puede reconstruir. Corregí el OMR en MuseScore "
                                 "y volvé a subir el MusicXML.")
            scale = scales.pop()
            # Include backup/forward durations when choosing an integer scale.
            factor = scale.denominator
            for duration in section["durations"]:
                factor = math.lcm(factor, Fraction(duration.text).denominator)
            section["divisions"].text = str(int(scale * factor))
            for duration in section["durations"]:
                duration.text = str(int(Fraction(duration.text) * factor))
            repaired = True
    if repaired:
        return m21.converter.parseData(ET.tostring(root, encoding="unicode"), format="musicxml")
    return m21.converter.parse(path)


def load_score(paths):
    """First part of the first movement; later movements are appended.

    The first measure of each movement gets `editorial.movementStart`: clefs do
    not carry over between Audiveris movements (see `octave_shifts`).
    """
    scores = [read_score(p) for p in paths]
    part = scores[0].parts[0]
    first = part.getElementsByClass(m21.stream.Measure).first()
    if first is not None:
        first.editorial.movementStart = True
    for extra in scores[1:]:
        last = part.getElementsByClass(m21.stream.Measure).last()
        number = last.number if last is not None else 0
        for i, measure in enumerate(extra.parts[0].getElementsByClass(m21.stream.Measure)):
            number += 1
            measure.number = number
            measure.editorial.movementStart = i == 0
            part.append(measure)
    return scores[0], part


# --- Columns ---------------------------------------------------------------

def octave_shifts(measures):
    """Per measure, the semitones from the read pitch to the sounding one.

    Guitar is written an octave above sounding pitch. Audiveris keeps the '8'
    of a treble-8vb clef as an octave change (pitches already sound right);
    under a plain treble clef they need -12. The clef in force is tracked per
    measure and reset at each movement: Audiveris can split a pickup into its
    own movement without the clef, and MusicXML reads that as plain treble.
    """
    octave_clef = []
    clef = None
    for measure in measures:
        if getattr(measure.editorial, "movementStart", False):
            clef = None
        for c in measure.recurse().getElementsByClass(m21.clef.Clef):
            clef = c
        octave_clef.append(getattr(clef, "octaveChange", 0) == -1)
    written = [p.midi for m, octave in zip(measures, octave_clef) if not octave
               for n in m.recurse().notes for p in n.pitches]
    # Notes too low to be written guitar pitch: the score is already in sound.
    plain = 0 if written and min(written) - 12 < GUITAR_LOWEST else -12
    return [0 if octave else plain for octave in octave_clef]


def build_columns(part, shifts=None):
    """Per measure, the list of Columns: {offset, notes: [(note, midi)]}.

    `note` is the music21 Note (a chord's component for chords). Every note of
    the part gets `editorial.tabKey` so the deep copy used for the TAB staff
    can find its own copy of it.
    """
    source = list(part.getElementsByClass(m21.stream.Measure))
    if shifts is None:
        shifts = octave_shifts(source)
    elif len(shifts) != len(source):
        raise ValueError("Las transposiciones guardadas no coinciden con los compases.")
    measures = []
    key = 0
    for measure, shift in zip(source, shifts):
        by_offset = {}
        for general in measure.recurse().notes:
            if general.duration.isGrace:
                continue
            offset = float(general.getOffsetInHierarchy(measure))
            members = general.notes if isinstance(general, m21.chord.Chord) else [general]
            for note in members:
                note.editorial.tabKey = key
                # String IDs survive deepcopy -> MusicXML -> Verovio data-id.
                note.id = f"tab-note-{key}"
                note.editorial.tabBass = (note.stemDirection if note.stemDirection in ("up", "down")
                                          else general.stemDirection) == "down"
                key += 1
                tie = note.tie or general.tie
                if tie is not None and tie.type in ("stop", "continue"):
                    continue
                by_offset.setdefault(offset, []).append((note, note.pitch.midi + shift))
        columns = [{"offset": o, "notes": by_offset[o]} for o in sorted(by_offset)]
        measures.append({"number": measure.number, "measure": measure, "columns": columns})
    # Reported shift: the one most measures use.
    return measures, max(set(shifts), key=shifts.count, default=0)


def guess_tuning(measures):
    """Standard, unless the part goes below E2 and Drop D (6th string in D, the
    usual scordatura in guitar music) reaches it."""
    midis = [m for meas in measures for col in meas["columns"] for _, m in col["notes"]]
    lowest = open_midis(STANDARD_TUNING)[-1]
    if midis and open_midis(DROP_D_TUNING)[-1] <= min(midis) < lowest:
        return DROP_D_TUNING
    return STANDARD_TUNING


def dropped_notes(measures):
    """Notes `assign_frets` left off the tab (out of range or no room), as
    (measure number, pitch name)."""
    return [(m["number"], note.pitch.nameWithOctave)
            for m in measures for col in m["columns"]
            for note, midi in col["notes"] if midi not in col["midis"]]


# --- String/fret assignment ------------------------------------------------

def candidates(midis, opens):
    """Every way to put the (distinct) pitches on distinct strings."""
    options = [[(s, m - o) for s, o in enumerate(opens) if 0 <= m - o <= MAX_FRET] for m in midis]
    out = []
    for combo in itertools.product(*options):
        strings = [s for s, _ in combo]
        if len(set(strings)) == len(strings):
            out.append(combo)
    return out


def local_cost(combo):
    fretted = [f for _, f in combo if f > 0]
    if not fretted:
        return 0.0
    span = max(fretted) - min(fretted)
    cost = span + 10 * max(0, span - MAX_SPAN)
    cost += 0.3 * min(fretted) + 0.5 * max(0, max(fretted) - 12)
    return cost


def hand(combo):
    fretted = [f for _, f in combo if f > 0]
    return min(fretted) if fretted else None


def playable_subset(midis, opens):
    """Drops pitches until the rest fit on the strings: out-of-range ones first,
    then inner voices (keep bass and melody)."""
    midis = [m for m in midis if any(0 <= m - o <= MAX_FRET for o in opens)]
    while midis and not candidates(midis, opens):
        midis.pop(len(midis) // 2)
    return midis


def assign_frets(measures, tuning=STANDARD_TUNING):
    """Fills `cells` (ascii-tabs Column) and `fingering` {id(note): (string, fret)}
    on every Column, via Viterbi over the whole piece."""
    opens = open_midis(tuning)
    flat = [col for m in measures for col in m["columns"]]
    layers = []
    for col in flat:
        midis = sorted({m for _, m in col["notes"]}, reverse=True)
        midis = playable_subset(midis, opens)
        col["midis"] = midis
        combos = candidates(midis, opens) or [()]
        combos.sort(key=local_cost)
        layers.append([(c, local_cost(c)) for c in combos[:CANDIDATES_PER_COLUMN]])

    # Viterbi; the state is the candidate plus the last known hand position.
    best = [[(cost, None, hand(c)) for c, cost in layers[0]]] if layers else []
    for i in range(1, len(layers)):
        row = []
        for combo, cost in layers[i]:
            h = hand(combo)
            choice = None
            for j, (prev_cost, _, prev_hand) in enumerate(best[i - 1]):
                move = abs(h - prev_hand) * 0.6 if h is not None and prev_hand is not None else 0
                total = prev_cost + cost + move
                if choice is None or total < choice[0]:
                    choice = (total, j, h if h is not None else prev_hand)
            row.append(choice)
        best.append(row)

    if best:
        k = min(range(len(best[-1])), key=lambda j: best[-1][j][0])
        for i in range(len(layers) - 1, -1, -1):
            set_column(flat[i], layers[i][k][0], opens)
            k = best[i][k][1]


def set_column(col, combo, opens):
    cells = [None] * 6
    for s, f in combo:
        cells[s] = f
    col["cells"] = cells
    col["fingering"] = fingering_from_cells(col, cells, opens)


def fingering_from_cells(col, cells, opens):
    """Maps the Column's notes onto edited cells: same pitch first; cells whose
    pitch matches no note (edited frets) go to the remaining notes, low to low."""
    free = [(s, f) for s, f in enumerate(cells) if f is not None]
    notes = sorted(col["notes"], key=lambda nm: -nm[1])
    result = {}
    pending = []
    for note, midi in notes:
        hit = next((sf for sf in free if opens[sf[0]] + sf[1] == midi), None)
        if hit:
            free.remove(hit)
            result[id(note)] = hit
        else:
            pending.append(note)
    # Leftover cells, highest string number (lowest) last, onto leftover notes
    for note, sf in zip(pending, sorted(free)):
        result[id(note)] = sf
    col["extra"] = sorted(free)[len(pending):]  # more cells than notes
    return result


def apply_edits(measures, edited, tuning=STANDARD_TUNING):
    """`edited` is one ascii-tabs Tab (Column list) per measure."""
    opens = open_midis(tuning)
    for m, tab in zip(measures, edited):
        for i, col in enumerate(m["columns"]):
            raw = tab[i] if i < len(tab) else [None] * 6
            cells = [v if isinstance(v, int) and 0 <= v <= 24 else None for v in (raw + [None] * 6)[:6]]
            col["cells"] = cells
            col["fingering"] = fingering_from_cells(col, cells, opens)


def preview_columns(measure):
    """Anchors and original voice hints indexed by logical column/string."""
    return [{"note_ids": [note.id for note, _ in col["notes"]],
             "bass_strings": sorted({col["fingering"][id(note)][0]
                                     for note, _ in col["notes"]
                                     if note.editorial.tabBass and id(note) in col["fingering"]})}
            for col in measure["columns"]]


# --- Rendering -------------------------------------------------------------

def new_toolkit(options):
    toolkit = verovio.toolkit(False)
    toolkit.setResourcePath(VEROVIO_DATA)
    toolkit.setOptions(options)
    return toolkit


def to_musicxml(score_or_part):
    with tempfile.NamedTemporaryFile(suffix=".musicxml", delete=False) as tmp:
        path = tmp.name
    try:
        # Imported measures already carry their notation. Re-running
        # makeNotation rewrites OMR rhythms and can fail when voice IDs change
        # between measures (makeTies assumes the next measure has the same IDs).
        score = score_or_part if isinstance(score_or_part, m21.stream.Score) else m21.stream.Score([score_or_part])
        score.write("musicxml", fp=path, makeNotation=False)
        with open(path, encoding="utf-8") as f:
            return f.read()
    finally:
        os.unlink(path)


def preview_tab_spacing(svg, measures):
    """Required/current spacing ratio for numeric frets on each string.

    Row breaks always use numbers, independently of the browser's solfege
    display toggle. Textual note names do not participate in this calculation.

    Verovio notehead uses carry absolute engraving coordinates, shared by all
    measures. Compare those same anchors used by the browser, including labels
    across barlines and strings with empty cells between two occupied cells.
    """
    root = ET.fromstring(svg)
    ns = {"s": "http://www.w3.org/2000/svg"}
    anchors = {}
    for note in root.findall('.//s:g[@class="note"]', ns):
        use = note.find('s:g[@class="notehead"]/s:use', ns)
        if use is None:
            continue
        match = re.search(r'translate\(([-\d.]+)[, ]', use.get("transform", ""))
        if match:
            anchors[note.get("data-id", note.get("id"))] = float(match.group(1))
    # Engraving coordinates have 180 units per staff space. The UI uses
    # 1.5 staff spaces for digits; allow 0.8 em per digit plus a visible gap.
    font = 1.5 * 180
    previous = [None] * 6
    ratio = 1.0
    for measure in measures:
        for col in measure["columns"]:
            xs = [anchors[n.id] for n, _ in col["notes"] if n.id in anchors]
            if not xs:
                continue
            x = min(xs)
            for string, fret in enumerate(col["cells"]):
                if fret is None:
                    continue
                half_width = len(str(fret)) * .8 * font / 2
                if previous[string] is not None:
                    old_x, old_half_width = previous[string]
                    gap = x - old_x
                    if gap > 0:
                        ratio = max(ratio, (old_half_width + half_width + .35 * font) / gap)
                previous[string] = (x, half_width)
    return ratio


def preview_rows(part, measures_per_row, measures=None):
    """One SVG per row of measures (notation only, the tab is ascii-tabs)."""
    toolkit = new_toolkit(PREVIEW_OPTIONS)
    shown = copy.deepcopy(part)
    # The row needs the width, not a label
    for named in [shown, *shown.recurse().getElementsByClass(m21.instrument.Instrument)]:
        named.partName = named.partAbbreviation = ""
    # Row breaks are chosen here, independently of the imported page layout.
    for layout in list(shown.recurse().getElementsByClass(m21.layout.LayoutBase)):
        layout.activeSite.remove(layout)
    single = m21.stream.Score([shown])
    if not toolkit.loadData(to_musicxml(single)):
        raise RuntimeError("Verovio no pudo leer el MusicXML")
    count = len(part.getElementsByClass(m21.stream.Measure))
    rows = []
    start = 1
    while start <= count:
        end = min(count, start + measures_per_row - 1)
        while True:
            # measureRange counts measures in document order, from 1
            toolkit.select({"measureRange": f"{start}-{end}"})
            toolkit.redoLayout()
            svg = toolkit.renderToSVG(1)
            if end == start or svg_width(svg) <= PREVIEW_MAX_ROW:
                break
            end -= 1
        rows.append({"first": start - 1, "last": end - 1, "svg": svg})
        start = end + 1
    # Justify with the engraver so only note spacing grows, not glyphs or
    # staff height. Keep a short final row at its natural width.
    target = max([PREVIEW_MIN_ROW, *(svg_width(row["svg"]) for row in rows)])
    page_width = math.ceil(target * 100 / PREVIEW_OPTIONS["scale"])
    toolkit.setOptions({"breaks": "encoded", "pageWidth": page_width,
                        "minLastJustification": 0})
    # Repack from the start: a rejected last measure becomes the first measure
    # of the next row. Test the final justified spacing, not natural widths.
    packed = []
    start = 0
    while start < count:
        end = min(count - 1, start + measures_per_row - 1)
        while True:
            toolkit.setOptions({"breaks": "none"})
            toolkit.select({"measureRange": f"{start + 1}-{end + 1}"})
            toolkit.redoLayout()
            natural = toolkit.renderToSVG(1)
            if end > start and svg_width(natural) > PREVIEW_MAX_ROW:
                end -= 1
                continue
            toolkit.setOptions({"breaks": "encoded"})
            toolkit.redoLayout()
            svg = toolkit.renderToSVG(1)
            fits = measures is None or preview_tab_spacing(svg, measures[start:end + 1]) <= 1
            if fits or end == start:
                # A short last row stays natural only if its frets also fit.
                if end == count - 1 and end - start + 1 < measures_per_row and (
                        measures is None or preview_tab_spacing(natural, measures[start:end + 1]) <= 1):
                    svg = natural
                packed.append({"first": start, "last": end, "svg": svg})
                break
            end -= 1
        start = end + 1
    return packed


def svg_width(svg):
    match = re.search(r'<svg[^>]*\bviewBox="[-\d.]+ [-\d.]+ ([\d.]+)', svg)
    return float(match.group(1)) if match else 0


def build_tab_staff(part, measures, tuning):
    """Deep copy of the notation staff turned into a TAB staff: every plucked
    note gets <technical><string/><fret/>; rests, tie continuations and
    unplayable notes become invisible rests that keep the rhythm."""
    opens = open_midis(tuning)
    frets, extras = {}, {}
    for m in measures:
        for col in m["columns"]:
            for note, _ in col["notes"]:
                if id(note) in col["fingering"]:
                    frets[note.editorial.tabKey] = col["fingering"][id(note)]
            if col.get("extra") and col["notes"]:
                extras[col["notes"][0][0].editorial.tabKey] = col["extra"]

    tab = copy.deepcopy(part)
    drop = (m21.clef.Clef, m21.key.KeySignature, m21.meter.TimeSignature, m21.spanner.Spanner,
            m21.expressions.TextExpression, m21.tempo.TempoIndication, m21.dynamics.Dynamic,
            m21.expressions.RehearsalMark, m21.layout.LayoutBase)
    for el in list(tab.recurse().getElementsByClass(drop)):
        el.activeSite.remove(el)
    first = tab.getElementsByClass(m21.stream.Measure).first()
    if first is not None:
        first.insert(0, m21.clef.TabClef())
        first.insert(0, m21.layout.StaffLayout(staffLines=6))

    def fretted(s, f, length):
        n = m21.note.Note(midi=opens[s] + f, quarterLength=length)
        # music21 only exports a chord's articulations on its first note, except
        # fingerings, which go one per note: carry "string/fret" in a fingering
        # and let fix_technical() rewrite it as <string>/<fret>.
        n.articulations = [m21.articulations.Fingering(f"{s + 1}/{f}")]
        return n

    for general in list(tab.recurse().notesAndRests):
        site, length = general.activeSite, general.duration.quarterLength
        if general.duration.isGrace:
            site.remove(general)
            continue
        members = [] if general.isRest else (
            general.notes if isinstance(general, m21.chord.Chord) else [general])
        tones = []
        for note in members:
            key = getattr(note.editorial, "tabKey", None)
            if key in frets:
                tones.append(frets[key])
            tones.extend(extras.get(key, []))
        if tones:
            notes = [fretted(s, f, length) for s, f in sorted(set(tones))]
            if len(notes) == 1:
                new = notes[0]
            else:
                new = m21.chord.Chord(notes, quarterLength=length)
                new.articulations = [a for n in new.notes for a in n.articulations]
            new.duration = copy.deepcopy(general.duration)
            new.stemDirection = "noStem"
        else:
            new = m21.note.Rest(quarterLength=length)
            new.duration = copy.deepcopy(general.duration)
            new.style.hideObjectOnPrint = True
        site.replace(general, new)
    return tab


def extract_header(score):
    """Keep the title and its two nearby credits (author and transcriber).

    Audiveris also exports publishers, footers and stray notation as credits.
    Only consider text within six title font sizes of the title, rather than
    promoting every large text on the first page into the heading.
    """
    lines = []
    for box in score.getElementsByClass(m21.text.TextBox):
        size = float(box.style.fontSize or 0)
        text = (box.content or "").strip()
        if box.page in (1, None) and size >= 8 and not re.fullmatch(r"[\d\s/.,]*", text):
            lines.append((-float(box.style.absoluteY or 0), size, text))
    metadata = score.metadata
    if not lines:  # no positioned text (plain MusicXML): the declared credits
        credits = []
        if metadata:
            for role in ("composer", "transcriber"):
                for value in metadata[role]:
                    text = str(value).strip()
                    if text and text not in credits:
                        credits.append(text)
        return (metadata.title if metadata else None), credits
    # Positioned text exists: keep only what sits next to the title. Declared
    # credits are not trusted here, OMR may have filed footer text under them.
    y, size, title = max(lines, key=lambda line: line[1])
    nearby = sorted((line for line in lines
                     if line[2] != title and abs(line[0] - y) <= size * 6),
                    key=lambda line: abs(line[0] - y))[:2]
    return title, [text for _, _, text in sorted(nearby)]


def fix_technical(xml):
    return re.sub(r"<fingering[^>]*>(\d+)/(\d+)</fingering>", r"<string>\1</string><fret>\2</fret>", xml)


def clean_labels(xml):
    """No instrument name or abbreviation drawn left of the systems."""
    xml = re.sub(r"<part-name\b[^>]*>.*?</part-name>", '<part-name print-object="no"></part-name>', xml, flags=re.S)
    return re.sub(r"\s*<part-abbreviation\b[^>]*>.*?</part-abbreviation>", "", xml, flags=re.S)


def notation_time_only(xml):
    """A <time> without number applies to every staff and Verovio draws it on
    the TAB staff too; the meter belongs to the notation staff only."""
    return re.sub(r"<time(?![^>]*\bnumber=)", '<time number="1"', xml)


def add_credits(xml, title, subtitles):
    """Page header as explicit credits (Verovio ignores the composer
    otherwise): the title centred and the authors right-aligned below it."""
    words = []
    if title:
        words.append(('center', 1050, 'top', 24, title))
    if subtitles:
        words.append(('right', 1900, 'top', 12, " · ".join(subtitles)))
    credits = "".join(
        f'<credit page="1"><credit-words default-x="{x}" default-y="{1150 - i * 60}" justify="{j}" '
        f'valign="{v}" font-size="{size}">{escape(text)}</credit-words></credit>'
        for i, (j, x, v, size, text) in enumerate(words))
    return xml.replace("<part-list>", credits + "<part-list>", 1)


def soften_tab_clef(svg):
    """Verovio draws the TAB clef (SMuFL E06D) in full black and large."""
    return re.sub(r'(<g [^>]*class="clef")(>\s*<use xlink:href="#E06D-)', r'\1 fill="#bdbdbd"\2', svg)


def add_staff_tuning(xml, tuning):
    """music21 drops the TAB staff's StaffLayout when it merges both staves
    into one part (Verovio then draws 5 lines), and never writes a tuning:
    add <staff-details> with 6 lines and the tuning after the TAB clef."""
    pitches = [m21.pitch.Pitch(p) for p in tuning.split(",")]
    tunings = "".join(
        f'<staff-tuning line="{i + 1}"><tuning-step>{p.step}</tuning-step>'
        + (f"<tuning-alter>{int(p.accidental.alter)}</tuning-alter>" if p.accidental else "")
        + f"<tuning-octave>{p.octave}</tuning-octave></staff-tuning>"
        for i, p in enumerate(pitches))
    details = f'<staff-details number="2"><staff-lines>{len(pitches)}</staff-lines>{tunings}</staff-details>'
    return re.sub(r'(<clef number="2">\s*<sign>TAB</sign>.*?</clef>)', lambda m: m.group(1) + details,
                  xml, count=1, flags=re.S)


def add_string_names(svg, names):
    """Writes the string names left of the first TAB staff of a Verovio page,
    one per line and clear of the group brace. Verovio draws no tuning."""
    system = re.search(r'<g [^>]*class="system"[^>]*>', svg)
    if not system:
        return svg
    staves = list(re.finditer(r'<g [^>]*class="staff"[^>]*>', svg[system.end():]))
    if len(staves) < 2:  # notation staff, then the TAB staff of the first measure
        return svg
    start = system.end() + staves[1].end()
    lines = svg[start:svg.find("<g ", start)]
    segments = [(float(x), float(y)) for x, y in re.findall(r'<path d="M([\d.]+) ([\d.]+) L', lines)]
    ys = sorted({y for _, y in segments})
    if len(ys) != len(names):
        return svg
    left = min(x for x, _ in segments)
    brace = re.search(r'class="grpSym">(.*?)</g>', svg[system.end():], re.S)
    if brace:  # control points: a little left of the curve itself
        left = min([left, *(float(x) for x in re.findall(r'[ML ,C](-?[\d.]+),-?[\d.]+', brace.group(1)))])
    gap = (ys[-1] - ys[0]) / (len(ys) - 1)
    texts = "".join(f'<text x="{left - 0.3 * gap:.0f}" y="{y + 0.34 * gap:.0f}" text-anchor="end" '
                    f'font-size="{0.95 * gap:.0f}px" font-family="sans-serif">{name}</text>'
                    for name, y in zip(names, ys))
    return svg[:system.end()] + f'<g class="stringNames">{texts}</g>' + svg[system.end():]


def build_output(score, part, measures, tuning, title, out_base, header=None):
    """Writes <out_base>.musicxml and <out_base>.pdf; returns their paths.

    `header` is (title, subtitles) when the score no longer carries the credits
    (export rebuilds from persisted MusicXML)."""
    notation = m21.stream.PartStaff()
    tab_staff = m21.stream.PartStaff()
    for src, dst in ((copy.deepcopy(part), notation), (build_tab_staff(part, measures, tuning), tab_staff)):
        for el in src:
            dst.insert(src.elementOffset(el), el)
    group = m21.layout.StaffGroup([notation, tab_staff], symbol="bracket", barTogether=True)
    out = m21.stream.Score([notation, tab_staff, group])
    found, subtitles = header if header is not None else extract_header(score)
    out.metadata = m21.metadata.Metadata()
    out.metadata.title = found or title
    if subtitles:
        out.metadata.composer = " · ".join(subtitles)
    xml = add_staff_tuning(fix_technical(to_musicxml(out)), tuning)
    xml = add_credits(notation_time_only(clean_labels(xml)), out.metadata.title, subtitles)
    xml_path = out_base + ".musicxml"
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml)

    toolkit = new_toolkit(PDF_OPTIONS)
    if not toolkit.loadData(xml):
        raise RuntimeError("Verovio no pudo leer el MusicXML con tablatura")
    with tempfile.TemporaryDirectory() as tmp:
        pages = []
        for page in range(1, toolkit.getPageCount() + 1):
            svg = soften_tab_clef(toolkit.renderToSVG(page)).replace("</svg>", HIDE_TAB_RHYTHM + "</svg>", 1)
            if page == 1:
                svg = add_string_names(svg, string_names(tuning))
            path = os.path.join(tmp, f"page-{page:03d}.svg")
            with open(path, "w", encoding="utf-8") as f:
                f.write(svg)
            pages.append(path)
        pdf_path = out_base + ".pdf"
        subprocess.run(["rsvg-convert", "-f", "pdf", "-b", "white", "-o", pdf_path, *pages], check=True)
    return xml_path, pdf_path


# --- Pure operations on artifacts ------------------------------------------

TUNINGS = {"standard": STANDARD_TUNING, "dropd": DROP_D_TUNING}
SUGGESTION_VERSION = 1
NORMALIZED_NAME = "normalized.musicxml"
SUGGESTION_NAME = "suggestion.json"
PREVIEW_NAME = "preview.json"
FINAL_NAMES = {"pdf": "score.pdf", "musicxml": "score.musicxml", "tabs": "tabs.json"}


class NoNotesError(ValueError):
    """The score has no playable notes (API code `no_notes`)."""


def tuning_key(tuning):
    return next(k for k, v in TUNINGS.items() if v == tuning)


def _read_normalized(path):
    _, part = load_score([str(path)])
    return part


def _write_json(path, payload):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)


def _suggestion(measures, tuning, shifts, title, subtitles):
    return {
        "version": SUGGESTION_VERSION,
        "tuning": tuning_key(tuning),
        "tuning_notes": tuning,
        "string_names": string_names(tuning),
        "title": title,
        "subtitles": subtitles,
        "octave_shifts": shifts,
        "octave_shift": max(set(shifts), key=shifts.count, default=0),
        "measure_numbers": [m["number"] for m in measures],
        # Per measure, per Column: deterministic note ids and sounding midis.
        "columns": [[{"offset": c["offset"],
                      "note_ids": [n.id for n, _ in c["notes"]],
                      "midis": [midi for _, midi in c["notes"]]} for c in m["columns"]]
                    for m in measures],
        "dropped": [{"measure": n, "pitch": p} for n, p in dropped_notes(measures)],
        # One ascii-tabs Tab (Column[]) per measure: the Digitación sugerida.
        "tabs": [[c["cells"] for c in m["columns"]] for m in measures],
        "preview_columns": [preview_columns(m) for m in measures],
    }


def prepare(input_path, kind, tuning, out_dir, per_row=4):
    """Input score -> normalized MusicXML + suggested fingering + preview.

    `input_path` is one MusicXML/MXL file or a list of them (OCR movements).
    `kind` is 'musicxml' or 'pdf-ocr-output' (the MusicXML Audiveris wrote);
    both are read the same way. `tuning` is 'auto', 'standard' or 'dropd'.
    Writes normalized.musicxml, suggestion.json, preview.json and
    preview-NN.svg into out_dir and returns a dict describing them.
    """
    if kind not in ("musicxml", "pdf-ocr-output"):
        raise ValueError(f"kind inválido: {kind}")
    if tuning not in ("auto", *TUNINGS):
        raise ValueError(f"afinación inválida: {tuning}")
    paths = [input_path] if isinstance(input_path, (str, os.PathLike)) else list(input_path)
    os.makedirs(out_dir, exist_ok=True)

    score, part = load_score([str(p) for p in paths])
    shifts = octave_shifts(list(part.getElementsByClass(m21.stream.Measure)))
    title, subtitles = extract_header(score)
    xml_path = os.path.join(out_dir, NORMALIZED_NAME)
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(to_musicxml(m21.stream.Score([part])))

    # Everything downstream reads the persisted artifact, exactly like export,
    # so the deterministic note ids are the same in both operations.
    part = _read_normalized(xml_path)
    measures, _ = build_columns(part, shifts)
    if not any(m["columns"] for m in measures):
        raise NoNotesError("No se reconocieron notas en la partitura.")
    resolved = TUNINGS.get(tuning) or guess_tuning(measures)
    assign_frets(measures, resolved)
    suggestion = _suggestion(measures, resolved, shifts, title, subtitles)
    suggestion_path = os.path.join(out_dir, SUGGESTION_NAME)
    _write_json(suggestion_path, suggestion)

    rows = preview_rows(part, max(1, min(8, per_row)), measures)
    svg_paths, rows_meta = [], []
    for i, row in enumerate(rows):
        name = f"preview-{i + 1:02d}.svg"
        svg_paths.append(os.path.join(out_dir, name))
        with open(svg_paths[-1], "w", encoding="utf-8") as f:
            f.write(row["svg"])
        rows_meta.append({"svg": name, "first": row["first"], "last": row["last"]})
    preview_path = os.path.join(out_dir, PREVIEW_NAME)
    _write_json(preview_path, {"staff_space": PREVIEW_STAFF_SPACE, "rows": rows_meta})
    return {
        "kind": kind,
        "musicxml": xml_path,
        "suggestion": suggestion_path,
        "preview": preview_path,
        "preview_svgs": svg_paths,
        "tuning": suggestion["tuning"],
        "title": title,
        "dropped": suggestion["dropped"],
        "measures": len(measures),
    }


def export(musicxml_path, suggestion_path, tabs, tuning, out_dir):
    """Persisted artifacts + edited tabs -> PDF, final MusicXML, tabs JSON.

    `tabs` is one ascii-tabs Tab (Column list) per measure. `tuning` is
    'standard', 'dropd' or None/'auto' to keep the suggestion's tuning.
    Edited cells map to notes by pitch; cells matching no note only reach the
    TAB staff, never the notation.
    """
    with open(suggestion_path, encoding="utf-8") as f:
        suggestion = json.load(f)
    part = _read_normalized(musicxml_path)
    measures, _ = build_columns(part, suggestion["octave_shifts"])
    if [[[n.id for n, _ in c["notes"]] for c in m["columns"]] for m in measures] != \
            [[c["note_ids"] for c in m] for m in suggestion["columns"]]:
        raise ValueError("El MusicXML no coincide con la sugerencia guardada.")
    if not isinstance(tabs, list) or len(tabs) != len(measures):
        raise ValueError("La tablatura enviada no coincide con los compases de la partitura.")
    chosen = TUNINGS.get(tuning) or suggestion["tuning_notes"]
    apply_edits(measures, tabs, chosen)
    os.makedirs(out_dir, exist_ok=True)
    xml_path, pdf_path = build_output(
        None, part, measures, chosen, suggestion.get("title") or "Partitura",
        os.path.join(out_dir, "score"),
        header=(suggestion.get("title"), suggestion.get("subtitles") or []))
    tabs_path = os.path.join(out_dir, FINAL_NAMES["tabs"])
    _write_json(tabs_path, tabs)
    return {"pdf": pdf_path, "musicxml": xml_path, "tabs": tabs_path, "tuning": tuning_key(chosen)}
