"""Indicaciones de contacto del impreso de Sor, independientes de la digitación de notas pisadas.

El catálogo enumera compás, inicio en negras y pares cuerda/traste (desde 1).
La fuente contiene únicamente los sonidos resultantes, nunca la voz auxiliar que
el impreso usa para explicar dónde rozar la cuerda.
"""
import copy
import xml.etree.ElementTree as ET
from fractions import Fraction


def notes_at(measure):
    divisions = int(measure.findtext('attributes/divisions', '1'))
    cursor = previous = Fraction(0)
    for item in measure:
        if item.tag in ('backup', 'forward'):
            cursor += int(item.findtext('duration')) / Fraction(divisions) * (-1 if item.tag == 'backup' else 1)
        elif item.tag == 'note':
            onset = previous if item.find('chord') is not None else cursor
            yield onset, item
            if item.find('chord') is None:
                previous = cursor
                cursor += int(item.findtext('duration', '0')) / Fraction(divisions)


def mark(xml, passages, exported=False):
    """Diamantes y armónicos naturales; la TAB exportada conserva la altura sonora.

    El motor permite elegir las celdas manualmente, pero escribe su altura como
    si fueran notas pisadas. Aquí se restituye la altura del pentagrama para que
    el MusicXML también describa el armónico correctamente.
    """
    root = ET.fromstring(xml)
    divisions = 1
    for index, measure in enumerate(root.findall('./part/measure'), 1):
        divisions = int(measure.findtext('attributes/divisions', str(divisions)))
        # notes_at needs inherited divisions on measures without attributes.
        clone = copy.deepcopy(measure)
        attrs = clone.find('attributes')
        if attrs is None:
            attrs = ET.SubElement(clone, 'attributes')
        if attrs.find('divisions') is None:
            ET.SubElement(attrs, 'divisions').text = str(divisions)
        positions = list(notes_at(clone))
        original = list(measure.findall('note'))
        for entry in passages.get(str(index), []):
            onset, cells = entry
            hits = [i for i, (time, note) in enumerate(positions)
                    if time == Fraction(str(onset)) and note.find('pitch') is not None
                    and note.findtext('staff', '1') == '1']
            if len(hits) != len(cells):
                raise ValueError(f'Armónicos: compás {index}, inicio {onset}, notas {len(hits)} != contactos {len(cells)}')
            for i in hits:
                note = original[i]
                if note.find('notehead') is None:
                    ET.SubElement(note, 'notehead').text = 'diamond'
                notations = note.find('notations')
                if notations is None:
                    notations = ET.SubElement(note, 'notations')
                technical = notations.find('technical')
                if technical is None:
                    technical = ET.SubElement(notations, 'technical')
                if technical.find('harmonic') is None:
                    harmonic = ET.SubElement(technical, 'harmonic')
                    ET.SubElement(harmonic, 'natural')
                    ET.SubElement(harmonic, 'sounding-pitch')
            if exported:
                pitches = [copy.deepcopy(original[i].find('pitch')) for i in hits]
                tab = [original[i] for i, (time, note) in enumerate(positions)
                       if time == Fraction(str(onset)) and note.findtext('staff') == '2' and note.find('pitch') is not None]
                # Highest sounding pitch belongs to the highest string here.
                def midi(p):
                    return 12 * (int(p.findtext('octave')) + 1) + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[p.findtext('step')] + int(p.findtext('alter', '0'))
                pitches.sort(key=midi, reverse=True)
                tab.sort(key=lambda n: int(n.findtext('notations/technical/string')))
                if len(tab) != len(pitches):
                    raise ValueError(f'TAB de armónicos incompleta: compás {index}')
                for note, pitch in zip(tab, pitches):
                    old = note.find('pitch')
                    note.insert(list(note).index(old), pitch)
                    note.remove(old)
                    # La indicación <harmonic> vive en la notación. Verovio
                    # falla al leerla también en un pentagrama TAB; aquí se
                    # conservan cuerda, contacto y altura, sin duplicarla.
    return ET.tostring(root, encoding='unicode')


def contacts(tabs, columns, passages):
    for bar, entries in passages.items():
        for onset, cells in entries:
            matches = [i for i, col in enumerate(columns[int(bar) - 1]) if col['offset'] == onset]
            if len(matches) != 1:
                raise ValueError(f'Inicio de armónico no encontrado: {bar}, {onset}')
            column = [None] * 6
            for string, fret in cells:
                column[string - 1] = fret
            tabs[int(bar) - 1][matches[0]] = column
