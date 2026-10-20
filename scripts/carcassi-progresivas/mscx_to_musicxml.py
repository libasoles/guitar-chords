"""MuseScore (.mscz / .mscx) -> MusicXML de una sola voz de guitarra, solo con la biblioteca estandar.

    python mscx_to_musicxml.py <entrada.mscz|.mscx> <salida.musicxml> [--title T]

Lee solo el pentagrama de notacion (el primero; el segundo es la TAB que dibuja MuseScore, que el sitio
recalcula con su propio motor). Las alturas son las que suenan y la clave es sol 8vb, como las lee el motor.
Se descartan las digitaciones (numeros de mano izquierda y letras p-i-m-a), los saltos de pagina, los trazos
de posicion (I, II, V...) y todo lo que es presentacion de MuseScore; se conservan notas, ritmos, voces,
ligaduras de union y de expresion, tresillos, notas de adorno, armadura, compas, repeticiones, casillas,
dinamicas, reguladores, tempos y textos.
"""
import argparse
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from fractions import Fraction
from xml.sax.saxutils import escape

DIVISIONS = 480  # por negra: alcanza para fusas y tresillos de semicorcheas
TYPE_QUARTERS = {'whole': Fraction(4), 'half': Fraction(2), 'quarter': Fraction(1), 'eighth': Fraction(1, 2),
                 '16th': Fraction(1, 4), '32nd': Fraction(1, 8), '64th': Fraction(1, 16)}
STEPS = 'FCGDAEB'  # linea de quintas desde fa
STEP_SEMITONES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
ACCIDENTALS = {'accidentalSharp': 'sharp', 'accidentalFlat': 'flat', 'accidentalNatural': 'natural',
               'accidentalDoubleSharp': 'double-sharp', 'accidentalDoubleFlat': 'flat-flat'}
BEAM_LEVEL = {'eighth': 1, '16th': 2, '32nd': 3, '64th': 4}
DYNAMICS = {'p', 'pp', 'ppp', 'mp', 'mf', 'f', 'ff', 'fff', 'sf', 'sfz', 'fz', 'rfz', 'pf', 'fp'}
BARLINES = {'double': 'light-light', 'end': 'light-heavy', 'reverse-end': 'heavy-light'}
MARKERS = {'fine': 'Fine', 'segno': None, 'coda': None, 'tocoda': 'To Coda'}


def read_mscx(path):
    if path.endswith('.mscz'):
        with zipfile.ZipFile(path) as z:
            name = next(n for n in z.namelist() if n.endswith('.mscx'))
            return ET.fromstring(z.read(name))
    return ET.parse(path).getroot()


def spelling(tpc, midi):
    """(step, alter, octave) de una nota segun su 'tpc' de MuseScore (14 = do, +1 por quinta)."""
    k = tpc - 14
    step = STEPS[(k + 1) % 7]
    alter = (k + 1) // 7
    octave = (midi - alter - STEP_SEMITONES[step]) // 12 - 1
    return step, alter, octave


def fraction(text):
    n, _, d = text.partition('/')
    return Fraction(int(n), int(d or 1))


def duration_of(chord_like, measure_len, tuplet):
    kind = chord_like.findtext('durationType')
    if kind == 'measure':
        return measure_len, 'whole'
    quarters = TYPE_QUARTERS[kind]
    dots = int(chord_like.findtext('dots') or 0)
    quarters = quarters * (2 - Fraction(1, 2 ** dots))
    if tuplet:
        quarters = quarters * tuplet['normal'] / tuplet['actual']
    return quarters, kind


def rich_text(element):
    raw = element.findtext('text') or ''
    return re.sub(r'<[^>]+>', '', raw).replace('&amp;', '&').strip()


class Converter:
    def __init__(self, root, title, words=(), tempo=None):
        self.extra_words = list(words)  # [(numero de compas, texto)] que el libro imprime y el MuseScore no trae
        self.tempo = tempo  # texto de tempo del libro: reemplaza al del MuseScore
        self.score = root.find('Score')
        self.staff = self.score.findall('Staff')[0]
        self.title = title
        self.fifths = 0
        self.time = (4, 4)
        self.clef_written = False

    def convert(self):
        measures = [m for m in self.staff.findall('Measure')]
        out = []
        for index, measure in enumerate(measures):
            out.append(self.measure(index, measure, measures))
        header = ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>' +
                  escape(self.title) + '</work-title></work><identification><creator type="composer">Matteo Carcassi'
                  '</creator></identification><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part>'
                  '</part-list><part id="P1">')
        return header + ''.join(out) + '</part></score-partwise>\n'

    # -- measure ---------------------------------------------------------------------------------
    def measure(self, index, measure, measures):
        voices = measure.findall('voice')
        attributes = ''
        for voice in voices:
            for sig in voice.findall('TimeSig'):
                self.time = (int(sig.findtext('sigN')), int(sig.findtext('sigD')))
            for key in voice.findall('KeySig'):
                self.fifths = int(key.findtext('concertKey') or 0)
        full = Fraction(self.time[0] * 4, self.time[1])
        length = fraction(measure.get('len')) * 4 if measure.get('len') else full  # len va en fracciones de redonda
        if index == 0 or attributes_changed(voices):
            symbol = ' symbol="common"' if self.time == (4, 4) else ''
            attributes = ('<attributes><divisions>%d</divisions><key><fifths>%d</fifths></key><time%s><beats>%d</beats>'
                          '<beat-type>%d</beat-type></time>' % (DIVISIONS, self.fifths, symbol, *self.time))
            if not self.clef_written:
                attributes += '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>'
                self.clef_written = True
            attributes += '</attributes>'
        implicit = length < full
        pickup = measures[0].get('len') is not None and fraction(measures[0].get('len')) * 4 < full
        number = index if pickup else index + 1
        head = '<measure number="%d"%s>' % (number, ' implicit="yes"' if implicit else '')
        left, right = self.barlines(measure, measures, index)
        body = self.directions(measure, index)
        for at, text in self.extra_words:
            if at == number:
                body += words_dir(text, right=text.rstrip('.').lower() in ('fin', 'fine', 'd.c', 'd.s'))
        for k, (voice, number_, stem) in enumerate(self.plan(voices)):
            if k:
                body += '<backup><duration>%d</duration></backup>' % int(length * DIVISIONS)
            body += self.voice(voice, number_, length, stem, full - length if index == 0 and implicit else Fraction(0))
        return head + attributes + left + body + right + '</measure>'

    def barlines(self, measure, measures, index):
        left, right = '', ''
        if measure.find('startRepeat') is not None:
            left += '<repeat direction="forward"/>'
        ending_start = ending_stop = None
        for spanner in measure.iter('Spanner'):
            if spanner.get('type') != 'Volta':
                continue
            volta = spanner.find('Volta')
            if volta is not None:
                ending_start = (volta.findtext('endings') or '1').replace(' ', '')
                span = spanner.find('next/location/measures')
                self.volta_remaining = (ending_start, int(span.text) if span is not None else 1)
        if getattr(self, 'volta_open', None) is None and ending_start:
            left = '<ending number="%s" type="start"/>' % ending_start.replace(',', ', ') + left
            self.volta_open = ending_start
            self.volta_left = self.volta_remaining[1]
        right_repeat = measure.find('endRepeat') is not None
        end_style = None
        for bar in measure.iter('BarLine'):
            end_style = BARLINES.get(bar.findtext('subtype'))
        if getattr(self, 'volta_open', None) is not None:
            self.volta_left -= 1
            if self.volta_left <= 0:
                kind = 'discontinue' if right_repeat is False and end_style is None else 'stop'
                right += '<ending number="%s" type="%s"/>' % (self.volta_open.replace(',', ', '), 'stop' if right_repeat else 'discontinue')
                self.volta_open = None
        if right_repeat:
            right += '<repeat direction="backward"/>'
        if end_style and not right_repeat:
            right = '<bar-style>%s</bar-style>' % end_style + right
        return (('<barline location="left">%s</barline>' % left) if left else '',
                ('<barline location="right">%s</barline>' % right) if right else '')

    def directions(self, measure, index=0):
        out = ''
        for voice in measure.findall('voice'):
            for el in voice:
                if el.tag in ('StaffText', 'Expression'):
                    text = rich_text(el)
                    if self.tempo and index == 0 and el.tag == 'StaffText' and text:
                        text, self.tempo = self.tempo, None
                    if text:
                        out += words_dir(text, italic=el.tag == 'Expression')
                elif el.tag == 'Marker':
                    label = (el.findtext('label') or '').lower()
                    if label == 'segno':
                        out += '<direction placement="above"><direction-type><segno/></direction-type></direction>'
                    elif label == 'coda':
                        out += '<direction placement="above"><direction-type><coda/></direction-type></direction>'
                    elif MARKERS.get(label):
                        out += words_dir(MARKERS[label], right=True)
                elif el.tag == 'Jump':
                    out += words_dir(rich_text(el) or 'D.C.', right=True)
        return out

    def plan(self, voices):
        """[(voz de MuseScore, numero de voz MusicXML, plica)]: la voz mas aguda es la 1 (plica arriba), las
        demas con notas bajan y las voces de solo silencios quedan debajo (o encima si la unica voz con notas es
        un bajo)."""
        means = []
        for voice in voices:
            pitches = [int(n.findtext('pitch')) for c in voice.findall('Chord') if c.find('acciaccatura') is None
                       and c.find('appoggiatura') is None for n in c.findall('Note')]
            means.append(sum(pitches) / len(pitches) if pitches else None)
        noted = sorted((i for i, m in enumerate(means) if m is not None), key=lambda i: -means[i])
        silent = [i for i, m in enumerate(means) if m is None]
        order = noted + silent
        if noted and means[noted[0]] < 55 and len(noted) == 1:
            order = silent + noted
        stems = {i: None for i in order}
        if len(noted) >= 2:
            for k, i in enumerate(noted):
                stems[i] = 'up' if k == 0 else 'down'
        return [(voices[i], k + 1, stems[i]) for k, i in enumerate(order)]

    # -- voice -----------------------------------------------------------------------------------
    def voice(self, voice, number, length, stem, offset):
        out, total = '', Fraction(0)
        tuplet = None
        pending = []  # direcciones que esperan a la proxima nota
        events = []  # figuras de la voz, para repartir las barras
        for el in list(voice):
            tag = el.tag
            if tag == 'Tuplet':
                tuplet = {'normal': int(el.findtext('normalNotes')), 'actual': int(el.findtext('actualNotes')),
                          'shown': el.findtext('visible') != '0', 'first': True, 'base': el.findtext('baseNote')}
            elif tag == 'endTuplet':
                tuplet = None
                out = self.mark_last(out, '<tuplet type="stop"/>')
            elif tag == 'Dynamic':
                kind = el.findtext('subtype')
                if kind in DYNAMICS:
                    pending.append('<direction placement="below"><direction-type><dynamics><%s/></dynamics>'
                                   '</direction-type></direction>' % kind)
            elif tag == 'Spanner' and el.get('type') == 'HairPin':
                hair = el.find('HairPin')
                if hair is not None:
                    wedge = 'crescendo' if hair.findtext('subtype') == '0' else 'diminuendo'
                    pending.append('<direction placement="below"><direction-type><wedge type="%s"/></direction-type></direction>' % wedge)
                elif el.find('prev') is not None:
                    pending.append('<direction><direction-type><wedge type="stop"/></direction-type></direction>')
            elif tag == 'Rest':
                dur, kind = duration_of(el, length, tuplet)
                events.append({'level': 0, 'pos': offset + total})
                total += dur
                measure_rest = el.findtext('durationType') == 'measure'
                hidden = el.findtext('visible') == '0'
                out += ''.join(pending); pending = []
                out += self.rest(dur, kind, number, measure_rest, hidden, tuplet, el)
                if tuplet:
                    tuplet['first'] = False
            elif tag == 'Chord':
                grace = el.find('acciaccatura') is not None or el.find('appoggiatura') is not None
                dur, kind = duration_of(el, length, tuplet)
                out += ''.join(pending); pending = []
                if not grace:
                    level = BEAM_LEVEL.get(kind, 0)
                    events.append({'level': level, 'pos': offset + total, 'mode': el.findtext('BeamMode')})
                out += self.chord(el, dur, kind, number, stem, tuplet, grace, len(events) - 1)
                if not grace:
                    total += dur
                if tuplet and not grace:
                    tuplet['first'] = False
        if total < length:
            out += self.rest(length - total, None, number, False, True, None, None)
        return self.beams(out, events) + ''.join(pending)

    def beams(self, xml, events):
        """Barras automaticas: por pulso (por negra con punto en 6/8 y 3/8), cortadas por silencios y BeamMode."""
        group = Fraction(3, 2) if self.time[1] == 8 and self.time[0] % 3 == 0 else Fraction(1)
        runs, run = [], []
        for i, ev in enumerate(events):
            ev['i'] = i
            fresh = ev.get('mode') in ('begin', 'begin32', 'begin64', 'no')
            if ev['level'] == 0:
                if run:
                    runs.append(run)
                run = []
                continue
            if run and (ev['pos'] // group != run[-1]['pos'] // group or fresh):
                runs.append(run)
                run = []
            run.append(ev)
            if ev.get('mode') == 'no':
                runs.append(run)
                run = []
        if run:
            runs.append(run)
        states = {}
        for run in runs:
            if len(run) < 2:
                continue
            for k, ev in enumerate(run):
                tags = []
                for level in range(1, ev['level'] + 1):
                    before = k > 0 and run[k - 1]['level'] >= level
                    after = k + 1 < len(run) and run[k + 1]['level'] >= level
                    if before and after:
                        tag = 'continue'
                    elif after:
                        tag = 'begin'
                    elif before:
                        tag = 'end'
                    else:
                        tag = 'backward hook' if k > 0 else 'forward hook'
                    tags.append('<beam number="%d">%s</beam>' % (level, tag))
                states[ev['i']] = ''.join(tags)
        return re.sub(r'@B(\d+)@', lambda m: states.get(int(m.group(1)), ''), xml)

    @staticmethod
    def mark_last(xml, notation):
        i = xml.rfind('</note>')
        if i < 0:
            return xml
        j = xml.rfind('<notations>', 0, i)
        k = xml.rfind('<note', 0, i)
        if j > k:
            return xml[:j + len('<notations>')] + notation + xml[j + len('<notations>'):]
        return xml[:i] + '<notations>' + notation + '</notations>' + xml[i:]

    def rest(self, dur, kind, number, measure_rest, hidden, tuplet, el):
        ticks = int(dur * DIVISIONS)
        if kind is None:
            kind = nearest_type(dur)
        mark = '<rest measure="yes"/>' if measure_rest else '<rest/>'
        dots = dots_of(dur, kind, tuplet)
        return ('<note%s>%s<duration>%d</duration><voice>%d</voice>%s%s%s</note>' %
                (' print-object="no"' if hidden else '', mark, ticks, number, '' if measure_rest else '<type>%s</type>' % kind,
                 '<dot/>' * dots, time_mod(tuplet) if tuplet else ''))

    def chord(self, el, dur, kind, number, stem, tuplet, grace, event=-1):
        out = ''
        for i, note in enumerate(el.findall('Note')):
            pitch = int(note.findtext('pitch'))
            step, alter, octave = spelling(int(note.findtext('tpc')), pitch)
            parts = ['<note>' if note.findtext('visible') != '0' else '<note print-object="no">']
            if i:
                parts.append('<chord/>')
            if grace:
                parts.append('<grace slash="yes"/>' if el.find('acciaccatura') is not None else '<grace/>')
            parts.append('<pitch><step>%s</step>%s<octave>%d</octave></pitch>' % (step, '<alter>%d</alter>' % alter if alter else '', octave))
            if not grace:
                parts.append('<duration>%d</duration>' % int(dur * DIVISIONS))
            tie_start = tie_stop = False
            for spanner in note.findall('Spanner'):
                if spanner.get('type') == 'Tie':
                    tie_start = tie_start or spanner.find('next') is not None
                    tie_stop = tie_stop or spanner.find('prev') is not None
            if tie_stop:
                parts.append('<tie type="stop"/>')
            if tie_start:
                parts.append('<tie type="start"/>')
            parts.append('<voice>%d</voice><type>%s</type>' % (number, kind))
            parts.append('<dot/>' * dots_of(dur, kind, tuplet) if not grace else '')
            acc = note.find('Accidental')
            if acc is not None and ACCIDENTALS.get(acc.findtext('subtype')):
                parts.append('<accidental>%s</accidental>' % ACCIDENTALS[acc.findtext('subtype')])
            if tuplet and not grace:
                parts.append(time_mod(tuplet))
            if stem:
                parts.append('<stem>%s</stem>' % stem)
            if i == 0 and not grace:
                parts.append('@B%d@' % event)
            notations = ''
            if tuplet and tuplet['first'] and i == 0 and not grace:
                notations += '<tuplet type="start" bracket="%s"%s/>' % ('no', '' if tuplet['shown'] else ' show-number="none"')
            if tie_stop:
                notations += '<tied type="stop"/>'
            if tie_start:
                notations += '<tied type="start"/>'
            if i == 0:
                for spanner in el.findall('Spanner'):
                    if spanner.get('type') == 'Slur':
                        if spanner.find('next') is not None and spanner.find('Slur') is not None:
                            notations += '<slur type="start" number="1"/>'
                        elif spanner.find('prev') is not None:
                            notations += '<slur type="stop" number="1"/>'
                if el.find('Fermata') is not None:
                    notations += '<fermata type="upright"/>'
            if notations:
                parts.append('<notations>%s</notations>' % notations)
            parts.append('</note>')
            out += ''.join(parts)
        return out


def attributes_changed(voices):
    return any(v.find('TimeSig') is not None or v.find('KeySig') is not None for v in voices)


def words_dir(text, italic=False, right=False):
    style = ' font-style="italic"' if italic else ' font-weight="bold"' if not italic else ''
    just = ' justify="right"' if right else ''
    return '<direction placement="above"><direction-type><words%s%s>%s</words></direction-type></direction>' % (style, just, escape(text))


def time_mod(tuplet):
    return '<time-modification><actual-notes>%d</actual-notes><normal-notes>%d</normal-notes></time-modification>' % (
        tuplet['actual'], tuplet['normal'])


def dots_of(dur, kind, tuplet):
    base = TYPE_QUARTERS.get(kind)
    if base is None:
        return 0
    real = dur * tuplet['actual'] / tuplet['normal'] if tuplet else dur
    for dots in range(4):
        if base * (2 - Fraction(1, 2 ** dots)) == real:
            return dots
    return 0


def nearest_type(dur):
    for kind, quarters in sorted(TYPE_QUARTERS.items(), key=lambda kv: -kv[1]):
        if quarters <= dur:
            return kind
    return '64th'


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('target')
    parser.add_argument('--title', default='Carcassi')
    args = parser.parse_args(argv)
    xml = Converter(read_mscx(args.source), args.title).convert()
    with open(args.target, 'w', encoding='utf-8') as f:
        f.write(xml)


if __name__ == '__main__':
    main(sys.argv[1:])
