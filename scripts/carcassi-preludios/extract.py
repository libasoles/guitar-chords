"""Extracts one Carcassi prelude from the local source PDF (not versioned).

    python scripts/carcassi-preludios/extract.py crop 1      # PNG of the prelude, cropped by position
    python scripts/carcassi-preludios/extract.py ocr 1       # + MusicXML intermedio via local Docker

See scripts/carcassi-preludios/README.md. The source PDF is read from $CARCASSI_SOURCE_PDF or
resources/CarcassiMethodPreludes-a4.pdf.
"""
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT =os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_SOURCE = os.path.join(ROOT, "resources", "CarcassiMethodPreludes-a4.pdf")
WORK = os.path.join(ROOT, ".work", "carcassi-preludios")
DPI = 400
IMAGE = "guitar-chords-ocr"
FOOTER_MARGIN = 6  # pt above the footer text


def source_pdf():
    path = os.environ.get("CARCASSI_SOURCE_PDF", DEFAULT_SOURCE)
    if not os.path.exists(path):
        raise SystemExit(f"no encuentro el PDF fuente: {path} (variable CARCASSI_SOURCE_PDF)")
    return path


def words(pdf):
    """[(page, text, xMin, yMin, xMax, yMax)] and the page height, from pdftotext -bbox."""
    html = subprocess.run(["pdftotext", "-bbox", pdf, "-"], capture_output=True, text=True, check=True).stdout
    out, page, height = [], 0, 841.89
    for line in html.splitlines():
        if "<page " in line:
            page += 1
            height = float(re.search(r'height="([\d.]+)"', line).group(1))
        m = re.search(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)</word>', line)
        if m:
            x0, y0, x1, y1 = map(float, m.groups()[:4])
            out.append((page, m.group(5), x0, y0, x1, y1))
    return out, height


def segments(pdf, number):
    """[(page, y0, y1)] in pt where prelude `number` lives, found by position (the text order is scrambled)."""
    ws, height = words(pdf)
    titles = []  # (page, y below the title, number)
    for i, (page, text, x0, _, _, y1) in enumerate(ws[:-1]):
        nxt = ws[i + 1]
        if text == "Prelude" and x0 < 40 and nxt[0] == page and nxt[1].isdigit():
            titles.append((page, y1, int(nxt[1])))
    titles.sort()
    footer = {page: y0 for page, text, _, y0, _, _ in ws if text == "Mutopia"}
    mine = [i for i, t in enumerate(titles) if t[2] == number]
    if not mine:
        raise SystemExit(f"no encuentro el preludio {number}")
    start = titles[mine[0]]
    end = titles[mine[0] + 1] if mine[0] + 1 < len(titles) else None
    last_page = end[0] if end else max(w[0] for w in ws)
    result = []
    for page in range(start[0], last_page + 1):
        top = start[1] + 2 if page == start[0] else 0
        if end and page == end[0]:
            bottom = end[1] - 16  # above the next title line
        else:
            bottom = footer.get(page, height) - FOOTER_MARGIN
        if bottom - top > 20:
            result.append((page, top, bottom))
    return result


def crop(number):
    from PIL import Image
    pdf = source_pdf()
    os.makedirs(WORK, exist_ok=True)
    parts = []
    scale = DPI / 72
    for k, (page, top, bottom) in enumerate(segments(pdf, number)):
        base = os.path.join(WORK, f"seg-{number:02d}-{k}")
        subprocess.run(["pdftoppm", "-r", str(DPI), "-gray", "-png", "-singlefile", "-f", str(page), "-l", str(page),
                        "-x", "0", "-y", str(int(top * scale)), "-W", str(int(595.28 * scale)),
                        "-H", str(int((bottom - top) * scale)), pdf, base], check=True)
        parts.append(Image.open(base + ".png"))
    sheet = Image.new("L", (parts[0].width, sum(p.height for p in parts)), 255)
    y = 0
    for p in parts:
        sheet.paste(p, (0, y))
        y += p.height
    out = os.path.join(WORK, f"prelude-{number:02d}.png")
    sheet.save(out)
    print("recorte:", out, sheet.size)
    return out


def ocr(number):
    png = crop(number)
    out = os.path.join(WORK, f"omr-{number:02d}")
    subprocess.run(["docker", "run", "--rm", "-v", f"{WORK}:/work", "-v", f"{ROOT}/backend/ocr:/opt/ocr:ro",
                    "--entrypoint", "python3", IMAGE, "/opt/ocr/local_run.py",
                    f"/work/{os.path.basename(png)}", f"/work/omr-{number:02d}"], check=True)
    print("MusicXML intermedio (no se commitea):", out)


OUT_DIR = os.path.join(ROOT, "downloads", "carcassi-preludios")
# Compases por sistema del libro: la vista previa muestra el primero con su TAB.
PER_ROW = {1: 4, 2: 2, 3: 2, 4: 3, 5: 2, 6: 4, 7: 3, 8: 3, 9: 2, 10: 2, 11: 3, 12: 3, 13: 3, 14: 3, 15: 2, 16: 3}
# Smaller engraving on a proportionally larger virtual page (the PDF stays A4) for the long ones, so a
# 12-measure prelude does not spill its last system onto a second page.
PDF_OVERRIDES = {12: {"scale": 40, "pageWidth": 2363, "pageHeight": 3341}}
PREVIEW_DIR = os.path.join(ROOT, "src", "site", "articles", "carcassi-preludios")
CORRECTED = os.path.join(HERE, "corrected")
AUTHOR = "Matteo Carcassi"


# The source titles lose the sharp glyph ("F Minor" for a piece with three sharps): the key is fixed here
# after checking each key signature.
TITLES = {8: "Prelude 8 in F# Minor", 10: "Prelude 10 in C# Minor", 12: "Prelude 12 in D Minor", 13: "Prelude 13 in Bb Major", 15: "Prelude 15 in Eb Major"}


def name_of(number):
    """«Prelude N in <Key>», read from the title line of the source (by position)."""
    if number in TITLES:
        return TITLES[number]
    ws, _ = words(source_pdf())
    for i, (page, text, x0, y0, _, _) in enumerate(ws[:-1]):
        if text == "Prelude" and x0 < 40 and ws[i + 1][1] == str(number):
            line = [w[1] for w in ws[i:] if w[0] == page and abs(w[3] - y0) < 3]
            return " ".join(line)
    raise SystemExit(f"no encuentro el titulo del preludio {number}")


def write_preview(number, prepared, exported):
    """First system with notation and the same TAB fingering as the downloadable PDF."""
    import tabify

    with open(os.path.join(prepared, "preview.json"), encoding="utf-8") as f:
        first_row = json.load(f)["rows"][0]
    with open(os.path.join(exported, "score.musicxml"), encoding="utf-8") as f:
        xml = f.read()
    toolkit = tabify.new_toolkit({**tabify.PREVIEW_OPTIONS, "spacingStaff": 9})
    if not toolkit.loadData(xml):
        raise RuntimeError("Verovio no pudo leer el MusicXML con tablatura")
    toolkit.select({"measureRange": f"1-{first_row['last'] + 1}"})
    toolkit.redoLayout()
    svg = toolkit.renderToSVG(1)
    svg = drop_tab_tuplets(tabify.drop_brace(tabify.draw_tab_clef(tabify.drop_tab_meter(svg))))
    svg = svg.replace('font-family="Times, serif"', f'font-family="{SANS}"', 1)
    svg = svg.replace("</svg>", tabify.HIDE_TAB_RHYTHM + "</svg>", 1)
    svg = re.sub(r'\sdata-id="[^"]*"', "", svg)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    with open(os.path.join(PREVIEW_DIR, f"prelude-{number:02d}.svg"), "w", encoding="utf-8") as f:
        f.write("\n".join(line.rstrip() for line in svg.strip().splitlines()) + "\n")


SANS = "Helvetica, Arial, DejaVu Sans, sans-serif"
STAFF = re.compile(r'<g id="[^"]*" class="staff">')
TUPLET_NUM = re.compile(r'<g id="[^"]*" class="tupletNum">.*?</g>', re.S)


def drop_tab_tuplets(svg):
    """The tab staff copies the notation's tuplets; the numbers belong only above the notation (the 2nd staff of
    every measure is the tab)."""
    starts = [m.start() for m in STAFF.finditer(svg)] + [len(svg)]
    out, last = [], 0
    for i, (a, b) in enumerate(zip(starts, starts[1:])):
        out.append(svg[last:a])
        out.append(TUPLET_NUM.sub("", svg[a:b]) if i % 2 == 1 else svg[a:b])
        last = b
    return "".join(out) + svg[last:]


def patch_engine(tabify):
    """Verovio draws the fret digits in the page's default font, `Times, serif`. On macOS that is a real serif,
    while the web converter's Lambda image (Amazon Linux, no serif font) falls back to a sans. Make the page
    default a sans so these PDFs match the converter; the title sets its own serif family and keeps its look.
    Also keeps tuplet numbers out of the tab staff."""
    original = tabify.drop_brace
    tabify.drop_brace = lambda svg: drop_tab_tuplets(
        original(svg).replace('font-family="Times, serif"', f'font-family="{SANS}"', 1))


def avoid_repeated_strings(tabs, opens, max_fret=12):
    """In an arpeggio the same note must not be plucked twice in a row on one string (0-3-0 on the B string):
    the second pluck of a pitch that returns after a note on its own string moves to the next lower string.
    `tabs`: one list of columns per measure, cells string 1 first; `opens`: open-string MIDI, string 1 first."""
    for measure in tabs:
        pitches = [[opens[s] + f for s, f in enumerate(col) if f is not None] for col in measure]
        for i in range(2, len(measure)):
            col, prev = measure[i], measure[i - 1]
            if len(pitches[i]) != 1 or len(pitches[i - 1]) != 1 or pitches[i] != pitches[i - 2]:
                continue
            string = next(s for s, f in enumerate(col) if f is not None)
            if prev[string] is None:
                continue
            for target in range(string + 1, 6):
                fret = pitches[i][0] - opens[target]
                if 0 <= fret <= max_fret and col[target] is None:
                    col[target], col[string] = fret, None
                    break
    return tabs


def build(number):
    """Corrected MusicXML -> `Prelude N in <Key> - Matteo Carcassi`.pdf/.musicxml in downloads/.

    Built from scratch by the engine (notation + TAB staff), never by cutting the source PDF, and
    with fixed metadata: no producer, dates, editor or source file name.
    """
    import tempfile
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject
    sys.path.insert(0, os.path.join(ROOT, "backend", "engine"))
    import tabify

    source = os.path.join(CORRECTED, f"prelude-{number:02d}.musicxml")
    if not os.path.exists(source):
        raise SystemExit(f"falta el MusicXML corregido: {source}")
    title = name_of(number)
    tabify.PDF_OPTIONS = {**tabify.PDF_OPTIONS, **PDF_OVERRIDES.get(number, {})}
    with tempfile.TemporaryDirectory() as tmp:
        patch_engine(tabify)
        prepared = os.path.join(tmp, "prepared")
        tabify.prepare(source, "musicxml", "standard", prepared, per_row=PER_ROW.get(number, 4))
        exported = os.path.join(tmp, "export")
        with open(os.path.join(prepared, tabify.SUGGESTION_NAME), encoding="utf-8") as f:
            suggestion = json.load(f)
        tabify.export(os.path.join(prepared, tabify.NORMALIZED_NAME), os.path.join(prepared, tabify.SUGGESTION_NAME),
                      avoid_repeated_strings(suggestion["tabs"], tabify.open_midis(tabify.STANDARD_TUNING)),
                      "standard", exported, title=title, subtitle=AUTHOR)
        write_preview(number, prepared, exported)
        os.makedirs(OUT_DIR, exist_ok=True)
        base = os.path.join(OUT_DIR, f"{title} - {AUTHOR}")
        with open(os.path.join(exported, "score.musicxml"), encoding="utf-8") as f:
            xml = f.read()
        # No encoding block: no software, date or support notes of the intermediate processing.
        xml = re.sub(r"\s*<encoding>.*?</encoding>", "", xml, flags=re.S)
        with open(base + ".musicxml", "w", encoding="utf-8") as f:
            f.write(xml)
        writer = PdfWriter(clone_from=PdfReader(os.path.join(exported, "score.pdf")))
        writer.add_metadata({"/Title": title, "/Author": AUTHOR})
        for key in ("/Producer", "/Creator", "/CreationDate", "/ModDate"):
            writer._info.get_object().pop(NameObject(key), None)
        with open(base + ".pdf", "wb") as f:
            writer.write(f)
    print("salida:", base + ".pdf")


if __name__ == "__main__":
    {"crop": crop, "ocr": ocr, "build": build}[sys.argv[1]](int(sys.argv[2]))
