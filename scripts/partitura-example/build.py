"""Builds src/site/partitura-example.json from example.musicxml with the same
engine that serves uploads, so the page example is real output: the notation
row (Verovio SVG) and, per measure, the attacks (note ids, frets, bass strings).

    pip install -r backend/engine/requirements.txt
    python scripts/partitura-example/build.py
"""
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "backend", "engine"))

import tabify  # noqa: E402

SOURCE = os.path.join(ROOT, "scripts", "partitura-example", "example.musicxml")
TARGET = os.path.join(ROOT, "src", "site", "partitura-example.json")


def main():
    with tempfile.TemporaryDirectory() as out:
        tabify.prepare(SOURCE, "musicxml", "standard", out, per_row=4, arpeggio=False)
        with open(os.path.join(out, tabify.SUGGESTION_NAME), encoding="utf-8") as f:
            suggestion = json.load(f)
        with open(os.path.join(out, tabify.PREVIEW_NAME), encoding="utf-8") as f:
            layout = json.load(f)
        rows = layout["rows"]
        if len(rows) != 1:
            raise SystemExit(f"se esperaba una sola fila y hay {len(rows)}")
        with open(os.path.join(out, rows[0]["svg"]), encoding="utf-8") as f:
            svg = f.read()
    measures = []
    for tab, columns in zip(suggestion["tabs"], suggestion["preview_columns"]):
        measures.append([{"frets": cells, "noteIds": info["note_ids"], "bass": info["bass_strings"]}
                         for cells, info in zip(tab, columns)])
    payload = {
        "svg": svg,
        "staffSpace": layout["staff_space"],
        "measureNumbers": suggestion["measure_numbers"],
        "stringNames": suggestion["string_names"],
        "measures": measures,
    }
    with open(TARGET, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("measures:", [len(m) for m in measures], "string names:", suggestion["string_names"])
    for number, tab in zip(suggestion["measure_numbers"], suggestion["tabs"]):
        print(number, tab)


if __name__ == "__main__":
    main()
