"""Cejillas de la edición Santisteban, leídas de `sources/santisteban.ly` (Mutopia).

    python scripts/carcassi-preludios/santisteban_barres.py            # reescribe santisteban/barres.json
    python scripts/carcassi-preludios/santisteban_barres.py --check    # compara con santisteban/*.musicxml

El `.ly` marca sobre la nota donde empieza cada indicación: `\\bpII` cejilla pequeña (la mitad de las cuerdas, aquí las
tres agudas) en el traste II, `\\BpIV` cejilla grande (las seis), `\\pII` y `\\ppII` posición sin cejilla. Una marca
vale hasta la siguiente de cualquiera de las cuatro clases (una posición suelta la cierra), o hasta el final de la pieza.

`barres.json` guarda, por preludio, los tramos como los entiende `backend/engine/barres.py` (compás desde 1, posición en
negras, fin exclusivo). `transcribe_lib.write` los inyecta en el MusicXML que escriben `transcribe_NN.py`.
"""
import json
import os
import re
import sys
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
LY = os.path.join(HERE, "sources", "santisteban.ly")
OUT = os.path.join(HERE, "santisteban", "barres.json")
NAMES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
         "Fourteen", "Fifteen", "Sixteen"]
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13}
MARK = re.compile(r"\\(bp|Bp|pp|p)(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b")
DURATION = re.compile(r"(\d+)(\.*)")


def voice_block(text, name):
    start = text.index(f"upper{name} = ")
    end = text.index("\n}", start)
    return text[start:end]


def parse_voice(block, beats):
    """[(compás, posición en negras, clase, traste)] de las marcas del bloque, y la cantidad de compases. `beats`: negras por compás."""
    body = block[block.index("{") + 1:]
    body = "\n".join(line.split("%", 1)[0] for line in body.splitlines())
    marks, bar, clock, duration = [], 1, Fraction(0), Fraction(1, 4)
    scale = [Fraction(1)]
    last = None
    i = 0
    while i < len(body):
        c = body[i]
        if c == "|":
            bar, clock = bar + 1, Fraction(0)
            i += 1
        elif c == "\\":
            m = MARK.match(body, i)
            if m and last is not None:
                marks.append((last[0], last[1], m.group(1), ROMAN[m.group(2)]))
                i = m.end()
                continue
            found = re.match(r"\\(\w+)", body[i:])
            if not found:  # \! \< \> \( \)
                i += 2
                continue
            word = found.group(1)
            i += 1 + len(word)
            if word == "tuplet":
                m = re.match(r"\s*(\d+)/(\d+)\s*\d+\s*\{", body[i:])
                scale.append(scale[-1] * Fraction(int(m.group(2)), int(m.group(1))))
                i += m.end()
            elif word == "time":
                i += re.match(r"\s*\d+/\d+", body[i:]).end()
        elif c == "}":
            if len(scale) > 1:
                scale.pop()
            i += 1
        elif c in "<" or c.isalpha() or c == "R":
            if c == "<":
                i = body.index(">", i) + 1  # el acorde entero; sus digitaciones no importan
                rest = False
            else:
                m = re.match(r"([a-gsrR])[a-z]*[,']*[!?]?", body[i:])
                rest = m.group(1) in "srR"
                i += m.end()
            m = DURATION.match(body, i)
            if m:
                value = Fraction(1, int(m.group(1)))
                duration = value * sum((Fraction(1, 2 ** k) for k in range(len(m.group(2)) + 1)), Fraction(0))
                i = m.end()
            last = (bar, float(clock * 4)) if not rest else last
            clock += duration * scale[-1]
        else:
            i += 1
    return marks, bar if clock else bar - 1


def spans_of(marks, bars):
    """Tramos de cejilla: cada marca `bp`/`Bp` vale hasta la marca siguiente."""
    spans = []
    for k, (bar, at, kind, fret) in enumerate(marks):
        if kind not in ("bp", "Bp"):
            continue
        span = {"bar": bar, "at": at, "fret": fret, "strings": 3 if kind == "bp" else 6}
        if k + 1 < len(marks):
            span["end_bar"], span["end_at"] = marks[k + 1][0], marks[k + 1][1]
        else:
            span["end_bar"], span["end_at"] = bars + 1, 0
        spans.append(span)
    return spans


def build():
    text = open(LY, encoding="utf8").read()
    result = {}
    for number, name in enumerate(NAMES, 1):
        block = voice_block(text, name)
        marks, bars = parse_voice(block, 4)
        spans = spans_of(marks, bars)
        if spans:
            result[str(number)] = {"bars": bars, "spans": spans}
    return result


if __name__ == "__main__":
    data = build()
    if "--check" in sys.argv:
        for number, entry in data.items():
            path = os.path.join(HERE, "santisteban", f"prelude-{int(number):02d}.musicxml")
            count = open(path, encoding="utf8").read().count("<measure ")
            print(number, "compases ly", entry["bars"], "musicxml", count, "OK" if count == entry["bars"] else "DIFIERE", len(entry["spans"]), "cejillas")
    else:
        with open(OUT, "w", encoding="utf8") as f:
            json.dump({k: v["spans"] for k, v in data.items()}, f, indent=1)
            f.write("\n")
        print("escrito", OUT, {k: len(v["spans"]) for k, v in data.items()})
