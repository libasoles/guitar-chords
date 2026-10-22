"""LilyPond (archivos de Mutopia) -> MusicXML, solo con la parte de LilyPond que usan las piezas de Sor.

LilyPond no exporta MusicXML y no hay LilyPond instalado, asi que las notas se leen directamente del `.ly`:
modo `\\relative`, duraciones, ligaduras de union y de expresion, digitacion de la izquierda (-1, -4...), acordes,
repeticiones (`\\repeat volta` con `\\alternative`), `\\partial`, voces superpuestas (`<< a \\\\ b >>`) y variables.
Los compases salen de las comprobaciones de compas (`|`) del archivo: LilyPond avisa si no suman, y aqui se exige lo mismo.

    python scripts/sor/ly_to_musicxml.py pieza.ly salida.musicxml --title "Study 1" --composer "Fernando Sor"
"""
import argparse
import os
import re
import sys
from fractions import Fraction
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcassi-progresivas'))
from mscx_to_musicxml import BEAM_LEVEL, DIVISIONS, dots_of, nearest_type, time_mod, words_dir  # noqa: E402

STEPS = 'cdefgab'
KEY_MAJOR = {'c': 0, 'g': 1, 'd': 2, 'a': 3, 'e': 4, 'b': 5, 'fis': 6, 'cis': 7, 'f': -1, 'bes': -2, 'ees': -3, 'aes': -4,
             'des': -5, 'ges': -6}
KEY_MINOR = {'a': 0, 'e': 1, 'b': 2, 'fis': 3, 'cis': 4, 'gis': 5, 'dis': 6, 'd': -1, 'g': -2, 'c': -3, 'f': -4, 'bes': -5,
             'ees': -6}
SHARP_ORDER = 'fcgdaeb'
FLAT_ORDER = 'beadgcf'
TYPES = {1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: '16th', 32: '32nd', 64: '64th'}
# Ordenes de LilyPond sin argumentos que no cambian las notas.
IGNORED = {'break', 'noBreak', 'pageBreak', 'stemUp', 'stemDown', 'stemNeutral', 'tieUp', 'tieDown', 'tieNeutral',
           'slurUp', 'slurDown', 'slurNeutral', 'oneVoice', 'voiceOne', 'voiceTwo', 'voiceThree', 'voiceFour',
           'autoBeamOff', 'autoBeamOn', 'sustainDown', 'sustainUp', 'fermata', 'trill', 'staccato', 'tenuto', 'accent',
           'stopStaff', 'startStaff', 'shiftOn', 'shiftOff', 'notes', 'p', 'f', 'mf', 'mp', 'pp', 'ff', 'sf', 'fp', 'cresc',
           'dim', 'dimin', 'cadenzaOn', 'cadenzaOff', 'major', 'minor', 'arpeggio', 'times'}

TOKEN = re.compile(r'''
    (?P<string>"(?:[^"\\]|\\.)*")
  | (?P<voicesep>\\\\)
  | (?P<command>\\[A-Za-z]+)
  | (?P<chordopen><(?!<))
  | (?P<simopen><<)
  | (?P<simclose>>>)
  | (?P<chordclose>>)
  | (?P<finger>[-^_]\d)
  | (?P<script>[-^_][.>^_!+-])
  | (?P<num>\d+\.*(?:\*\d+(?:/\d+)?)?(?:/\d+)?)
  | (?P<dotted>[A-Za-z]+(?:\.[A-Za-z]+)+)
  | (?P<word>[A-Za-z]+[',]*[!?]*)
  | (?P<scheme>\#\#?(?:'?\((?:[^()]|\((?:[^()])*\))*\)|[^\s{}()<>]+))
  | (?P<punct>[{}|~()\[\]=])
''', re.X)


class LyError(Exception):
    pass


def strip_comments(text):
    text = re.sub(r'%\{.*?%\}', '', text, flags=re.S)
    out = []
    for line in text.split('\n'):
        quoted = False
        for i, ch in enumerate(line):
            if ch == '"':
                quoted = not quoted
            elif ch == '%' and not quoted:
                line = line[:i]
                break
        out.append(line)
    return '\n'.join(out)


def drop_blocks(text, names):
    """Quita `\\header { ... }` y demas bloques de presentacion, respetando cadenas y llaves anidadas."""
    pattern = re.compile(r'\\(%s)\s*\{' % '|'.join(names))
    while True:
        match = pattern.search(text)
        if not match:
            return text
        depth, i, quoted = 1, match.end(), False
        while depth and i < len(text):
            ch = text[i]
            if ch == '"':
                quoted = not quoted
            elif not quoted:
                depth += (ch == '{') - (ch == '}')
            i += 1
        text = text[:match.start()] + text[i:]


def tokenize(text):
    tokens, pos = [], 0
    while pos < len(text):
        if text[pos].isspace():
            pos += 1
            continue
        match = TOKEN.match(text, pos)
        if not match:
            raise LyError('simbolo inesperado en %r' % text[pos:pos + 30])
        tokens.append((match.lastgroup, match.group()))
        pos = match.end()
    return tokens


def pitch_of(word):
    match = re.fullmatch(r"([a-g])((?:is|es|s)*)([',]*)([!?]*)", word)
    if not match:
        return None
    step, accidental, marks = match.group(1), match.group(2), match.group(3)
    if accidental in ('s', 'ss'):  # as, es
        accidental = 'es'
    alter = accidental.count('is') - accidental.count('es')
    return STEPS.index(step), alter, marks.count("'") - marks.count(',')


def duration_of(text, previous):
    match = re.fullmatch(r'(\d+)(\.*)(?:\*(\d+)(?:/(\d+))?)?', text)
    base = Fraction(4, int(match.group(1))) * (2 - Fraction(1, 2 ** len(match.group(2))))
    if match.group(3):
        base *= Fraction(int(match.group(3)), int(match.group(4) or 1))
    return base


class Parser:
    def __init__(self, text):
        text = strip_comments(text)
        text = drop_blocks(text, ['header', 'layout', 'midi', 'paper', 'markup'])
        self.tokens = tokenize(text)
        self.pos = 0
        self.variables = {}
        self.last_duration = Fraction(1)
        self.ref = None  # (paso, octava absoluta) de la ultima nota en modo relativo
        self.relative = False
        self.score_controls = []
        self.clef = 'treble'

    # -- lectura de tokens -----------------------------------------------------------------------
    def peek(self, offset=0):
        i = self.pos + offset
        return self.tokens[i] if i < len(self.tokens) else (None, None)

    def take(self):
        token = self.tokens[self.pos]
        self.pos += 1
        return token

    def expect(self, value):
        kind, text = self.take()
        if text != value:
            raise LyError('se esperaba %r y hay %r' % (value, text))

    def skip_scheme(self):
        kind, _ = self.peek()
        if kind == 'scheme':
            self.take()

    # -- nivel superior --------------------------------------------------------------------------
    def parse_file(self):
        score = None
        while self.pos < len(self.tokens):
            kind, text = self.peek()
            if kind == 'command' and text == '\\version':
                self.take()
                self.take()
            elif kind == 'command' and text == '\\score':
                self.take()
                score = self.pos
                self.skip_group()
            elif kind == 'word' and self.peek(1)[1] == '=':
                name = self.take()[1]
                self.take()
                self.variables[name] = self.music()
            elif kind == 'command' and text in ('\\include', '\\book'):
                raise LyError('no soportado: ' + text)
            else:
                self.take()
        if score is None:
            raise LyError('el archivo no tiene \\score')
        self.pos = score
        return self.score_voices()

    def skip_group(self):
        self.expect('{')
        depth = 1
        while depth:
            kind, text = self.take()
            if kind == 'punct':
                depth += (text == '{') - (text == '}')

    def score_voices(self):
        """Voces de la particion: las variables que cita \\score, en orden. `<< a \\\\ b >>` aporta una voz por rama."""
        self.expect('{')
        names, depth = [], 1
        self.score_controls = []
        while depth:
            kind, text = self.take()
            if kind == 'punct':
                depth += (text == '{') - (text == '}')
            elif text in ('\\time', '\\key', '\\partial'):
                self.command(text, self.score_controls)
            elif text == '\\clef':
                self.clef = self.take()[1].strip('"')
            elif kind == 'command' and text[1:] in self.variables and text[1:] not in names:
                names.append(text[1:])
        voices = []
        for name in names:
            music = self.variables[name]
            voices.extend(music['voices'] if isinstance(music, dict) else [music])
        return expand_nested(voices)

    # -- musica ----------------------------------------------------------------------------------
    def music(self):
        """Una expresion musical: devuelve una lista de elementos (una voz) o {'voices': [...]} (voces simultaneas)."""
        kind, text = self.peek()
        if kind == 'command':
            if text == '\\relative':
                self.take()
                return self.relative_block()
            if text == '\\repeat':
                self.take()
                return self.repeat_block()
            if text == '\\notes':
                self.take()
                return self.music()
            if text in ('\\context', '\\new'):
                self.take()
                self.take()  # Voice, Staff...
                if self.peek()[1] == '=':
                    self.take()
                    self.take()
                return self.music()
            if text[1:] in self.variables:
                self.take()
                return self.variables[text[1:]]
        if kind == 'punct' and text == '{':
            self.take()
            return self.sequence('}')
        if kind == 'simopen':
            self.take()
            return self.simultaneous()
        raise LyError('expresion musical inesperada: %r' % (text,))

    def relative_block(self):
        kind, text = self.take()
        start = pitch_of(text) if kind == 'word' else None
        if start is None:
            raise LyError('\\relative sin altura')
        saved = (self.relative, self.ref)
        self.relative = True
        self.ref = (start[0], 3 + start[2])
        result = self.music()
        self.relative, self.ref = saved
        return result

    def repeat_block(self):
        kind, style = self.take()
        if style != 'volta':
            raise LyError('solo se admite \\repeat volta')
        times = int(self.take()[1])
        body = self.music()
        alternatives = None
        if self.peek() == ('command', '\\alternative'):
            self.take()
            self.expect('{')
            alternatives = []
            while self.peek()[1] != '}':
                alternatives.append(self.music())
            self.expect('}')
        if isinstance(body, dict):
            raise LyError('\\repeat sobre voces simultaneas')
        out = [{'kind': 'repeat_start'}] + body
        if not alternatives:
            return out + [{'kind': 'repeat_end', 'times': times}]
        for number, alt in enumerate(alternatives, 1):
            out += [{'kind': 'volta', 'n': number}] + alt
            if number < len(alternatives):
                out.append({'kind': 'repeat_end', 'times': times, 'volta': number})
            else:
                out.append({'kind': 'volta_stop', 'n': number})
        return out

    def simultaneous(self):
        """`<< { a } \\\\ { b } >>` o `<< \\a \\\\ \\b >>`: una voz por rama."""
        branches, current = [], []
        start = self.ref  # en modo relativo cada rama parte de la altura anterior al <<
        while True:
            kind, text = self.peek()
            if kind == 'simclose':
                self.take()
                break
            if kind == 'voicesep':
                self.take()
                branches.append(current)
                current = []
                self.ref = start
                continue
            if kind == 'command' and text[1:] in IGNORED | {'oneVoice'}:
                self.take()
                continue
            current.append(self.music())
            if self.peek()[0] not in ('simclose', 'voicesep'):
                self.ref = start
        branches.append(current)
        voices = []
        for branch in branches:
            for item in branch:
                voices.extend(item['voices'] if isinstance(item, dict) else [item])
        if len(voices) == 1:
            return voices[0]
        return {'voices': voices}

    def sequence(self, close):
        items = []
        while True:
            kind, text = self.peek()
            if text == close and kind == 'punct':
                self.take()
                return items
            if kind is None:
                raise LyError('falta %r' % close)
            self.element(items)

    def element(self, items):
        kind, text = self.take()
        if kind == 'punct':
            if text == '|':
                items.append({'kind': 'bar_check'})
            elif text in '{':
                self.pos -= 1
                items.extend(self.flat(self.music()))
            elif text in '[]()~':
                pass  # ligaduras y barras sueltas: las notas llevan las suyas
            else:
                raise LyError('simbolo inesperado %r' % text)
        elif kind == 'command':
            self.command(text, items)
        elif kind == 'simopen':
            nested = self.simultaneous()
            if isinstance(nested, dict):
                items.append({'kind': 'par', 'voices': nested['voices']})
            else:
                items.extend(nested)
        elif kind == 'chordopen':
            self.pos -= 1
            self.note(items)
        elif kind == 'word':
            self.pos -= 1
            if text in ('r', 's', 'R') or pitch_of(text):
                self.note(items)
            else:
                raise LyError('palabra inesperada %r' % text)
        elif kind in ('finger', 'script', 'num', 'scheme', 'string', 'voicesep'):
            pass
        else:
            raise LyError('elemento inesperado %r' % text)

    @staticmethod
    def flat(music):
        if isinstance(music, dict):
            return [{'kind': 'par', 'voices': music['voices']}]
        return music

    def command(self, text, items):
        name = text[1:]
        if name == 'partial':
            self.take_duration_expression(items, 'partial')
        elif name == 'time':
            beats, unit = self.take()[1].split('/')
            items.append({'kind': 'time', 'time': (int(beats), int(unit))})
        elif name == 'key':
            tonic = self.take()[1]
            mode = self.take()[1]
            table = KEY_MINOR if mode == '\\minor' else KEY_MAJOR
            items.append({'kind': 'key', 'fifths': table[tonic]})
        elif name == 'clef':
            self.take()
        elif name == 'bar':
            items.append({'kind': 'bar', 'style': self.take()[1].strip('"')})
        elif name == 'mark':
            kind, value = self.take()
            items.append({'kind': 'words', 'text': value.strip('"')})
        elif name == 'segno':
            items.append({'kind': 'segno'})
        elif name == 'tempo':
            while self.peek()[0] in ('num', 'string') or self.peek()[1] == '=':
                self.take()
        elif name in ('override', 'revert'):
            while self.take()[1] != '=':
                pass
            self.take()
        elif name == 'set':
            self.take()
            self.expect('=')
            self.take()
        elif name == 'transposition':
            self.take()
        elif name == 'relative':
            items.extend(self.flat(self.relative_block()))
        elif name == 'repeat':
            items.extend(self.flat(self.repeat_block()))
        elif name in self.variables:
            items.extend(self.flat(self.variables[name]))
        elif name in ('acciaccatura', 'appoggiatura', 'grace'):
            first = len(items)
            if self.peek()[1] == '{':
                self.take()
                items.extend(self.sequence('}'))
            else:
                self.element(items)
            for event in items[first:]:
                if event['kind'] == 'chord':
                    event.update(grace=True, slash=name == 'acciaccatura', grace_dur=event['dur'], dur=Fraction(0))
        elif name == 'rest':
            pass
        elif name in IGNORED:
            pass
        else:
            raise LyError('orden desconocida: ' + text)

    def take_duration_expression(self, items, kind):
        text = self.take()[1]
        items.append({'kind': kind, 'dur': duration_of(text, None)})

    # -- notas -----------------------------------------------------------------------------------
    def absolute(self, step, alter, marks):
        """Octava (MusicXML) de una altura: relativa a la nota anterior o absoluta."""
        if not self.relative:
            return 3 + marks
        ref_step, ref_octave = self.ref
        octave = ref_octave
        if step - ref_step > 3:
            octave -= 1
        elif step - ref_step < -3:
            octave += 1
        return octave + marks

    def note(self, items):
        kind, text = self.take()
        pitches = []
        if kind == 'chordopen':
            first = None
            while self.peek()[0] != 'chordclose':
                k, word = self.take()
                parsed = pitch_of(word) if k == 'word' else None
                if not parsed:
                    raise LyError('altura inesperada en un acorde: %r' % word)
                step, alter, marks = parsed
                octave = self.absolute(step, alter, marks)
                if self.relative:
                    self.ref = (step, octave)
                    first = first or (step, octave)
                pitches.append({'step': STEPS[step], 'alter': alter, 'octave': octave, 'fingers': self.fingers(), 'force': False})
            self.take()
            if self.relative and first:
                self.ref = first
        elif text in ('r', 's', 'R'):
            pass
        else:
            step, alter, marks = pitch_of(text)
            octave = self.absolute(step, alter, marks)
            if self.relative:
                self.ref = (step, octave)
            pitches.append({'step': STEPS[step], 'alter': alter, 'octave': octave, 'fingers': [], 'force': '!' in text})
        if self.peek()[0] == 'num':
            self.last_duration = duration_of(self.take()[1], None)
        event = {'kind': 'chord' if pitches else ('space' if text == 's' else 'rest'), 'dur': self.last_duration,
                 'pitches': pitches, 'tie': False, 'slur_start': 0, 'slur_stop': 0, 'words': [], 'segno': False}
        while True:
            kind, nxt = self.peek()
            if kind == 'finger':
                self.take()
                if pitches and nxt[1] in '0123456789':
                    pitches[-1]['fingers'].append(nxt[1])
            elif kind == 'script':
                self.take()
            elif kind == 'punct' and nxt == '~':
                self.take()
                event['tie'] = True
            elif kind == 'punct' and nxt == '(':
                self.take()
                event['slur_start'] += 1
            elif kind == 'punct' and nxt == ')':
                self.take()
                event['slur_stop'] += 1
            elif kind == 'punct' and nxt in '[]':
                self.take()
            elif kind == 'command' and nxt[1:] in ('rest', 'fermata', 'trill', 'staccato', 'tenuto', 'accent', 'p', 'f', 'mf',
                                                    'mp', 'pp', 'ff', 'sf', 'fp', 'cresc', 'dim', 'dimin', 'arpeggio'):
                self.take()
                if nxt == '\\fermata':
                    event['fermata'] = True
                if nxt == '\\rest' and pitches:
                    event['kind'] = 'rest'
                    event['pitches'] = []
            elif kind == 'command' and nxt == '\\segno':
                self.take()
                event['segno'] = True
            else:
                break
        items.append(event)

    def fingers(self):
        out = []
        while self.peek()[0] == 'finger':
            digit = self.take()[1][1]
            out.append(digit)
        return out


# -- MusicXML --------------------------------------------------------------------------------------------
def expand_nested(voices):
    """Las voces simultaneas que se abren a mitad de una voz (`<< { a } \\\\ { b } >>` entre otras notas) pasan a ser
    voces propias: la primera rama sigue en su sitio y las demas empiezan en ese instante, con silencios de relleno
    delante y detras hasta el final de la pieza."""
    result, extras = [], []
    for voice in voices:
        out, t = [], Fraction(0)
        for item in voice:
            if item['kind'] == 'par':
                branches = [expand_nested([branch])[0] for branch in item['voices']]
                length = Writer.timeline(branches[0])[3]
                out.extend(branches[0])
                for branch in branches[1:]:
                    extras.append((t, branch))
                t += length
                continue
            out.append(item)
            if item['kind'] in ('chord', 'rest', 'space'):
                t += item['dur']
        result.append(out)
    total = max(Writer.timeline(v)[3] for v in result + [b for _, b in extras])
    for start, branch in extras:
        filler = [space(start)] if start else []
        rest = total - start - Writer.timeline(branch)[3]
        result.append(filler + branch + ([space(rest)] if rest else []))
    return result


def split_spaces(events, bounds):
    """Parte en cada barra de compas los silencios invisibles que la cruzan."""
    out = []
    for e in events:
        if e['kind'] != 'space':
            out.append(e)
            continue
        at, end = e['at'], e['at'] + e['dur']
        for bound in bounds:
            if at < bound < end:
                out.append({**e, 'at': at, 'dur': bound - at})
                at = bound
        out.append({**e, 'at': at, 'dur': end - at})
    return out


def space(dur):
    return {'kind': 'space', 'dur': dur, 'pitches': [], 'tie': False, 'slur_start': 0, 'slur_stop': 0, 'words': [],
            'segno': False}


class Writer:
    def __init__(self, voices, title, composer, words=None, tempo=None, score_controls=(), octave_shift=0):
        self.title, self.composer = title, composer
        self.octave_shift = octave_shift
        self.score_controls = [(Fraction(0), c) for c in score_controls]
        self.voices = voices
        self.words = words or []
        self.tempo = tempo

    @staticmethod
    def timeline(voice):
        """Eventos con su inicio, marcas de compas y controles. Las voces anidadas (`par`) se rechazan."""
        events, controls, bars = [], [], []
        t = Fraction(0)
        for item in voice:
            kind = item['kind']
            if kind in ('chord', 'rest', 'space'):
                events.append({**item, 'at': t})
                t += item['dur']
            elif kind == 'bar_check':
                bars.append(t)
            elif kind == 'partial':
                controls.append((t, item))
            elif kind == 'par':
                raise LyError('voces simultaneas dentro de una voz')
            else:
                controls.append((t, item))
        return events, controls, bars, t

    def render(self):
        timelines = [self.timeline(v) for v in self.voices]
        events0, controls0, bars0, end0 = timelines[0]
        controls = self.score_controls + [c for _, ctl, _, _ in timelines for c in ctl]
        # Cada voz lleva las mismas marcas de repeticion y de casilla: se cuentan una vez.
        seen, unique = set(), []
        for t, item in controls:
            key = (t, tuple(sorted((k, str(v)) for k, v in item.items())))
            if key not in seen:
                seen.add(key)
                unique.append((t, item))
        controls = unique
        time = (4, 4)
        fifths = 0
        for _, item in sorted(controls, key=lambda c: c[0]):
            if item['kind'] == 'time':
                time = item['time']
            if item['kind'] == 'key':
                fifths = item['fifths']
        full = Fraction(time[0] * 4, time[1])
        # Compases: de la comprobacion de compas a la siguiente; el ultimo compas termina donde acaba la voz.
        end = max(tl[3] for tl in timelines)
        bounds = self.measure_bounds(timelines, controls, full, end)
        starts = [Fraction(0)] + bounds[:-1]
        measures = list(zip(starts, bounds))
        for events, _, _, _ in timelines:  # un silencio de relleno puede abarcar varios compases
            events[:] = split_spaces(events, bounds)
        problems = []
        for index, (a, b) in enumerate(measures):
            if a == b:
                raise LyError('compas vacio en %s' % a)
            for k, (events, _, _, _) in enumerate(timelines):
                total = sum(e['dur'] for e in events if a <= e['at'] < b)
                if total != b - a:
                    problems.append('compas %d voz %d: suma %s de %s negras' % (index, k + 1, total, b - a))
        if problems:
            raise LyError('; '.join(problems[:8]))
        key_state = self.key_table(fifths)
        out = []
        pickup = measures[0][1] - measures[0][0] < full
        counter, previous = 0 if pickup else 1, None
        for index, (a, b) in enumerate(measures):
            length = b - a
            implicit = length < full
            # Una anacrusa a mitad de pieza completa el compas corto que cierra la repeticion anterior: no cuenta.
            completes = index > 0 and previous is not None and previous < full and previous + length == full
            if index > 0 and not completes:
                counter += 1
            number = counter
            previous = length
            attrs = ''
            if index == 0:
                attrs = ('<attributes><divisions>%d</divisions><key><fifths>%d</fifths></key><time%s><beats>%d</beats>'
                         '<beat-type>%d</beat-type></time><clef><sign>G</sign><line>2</line>'
                         '<clef-octave-change>-1</clef-octave-change></clef></attributes>' %
                         (DIVISIONS, fifths, ' symbol="common"' if time == (4, 4) else '', *time))
            body = ''
            left, right = '', ''
            for t, item in sorted(controls, key=lambda c: c[0]):
                if not (a <= t < b or (t == b and index == len(measures) - 1)):
                    continue
                kind = item['kind']
                if kind == 'repeat_start' and t == a:
                    left += '<repeat direction="forward"/>'
                elif kind == 'volta' and t == a:
                    left = '<ending number="%d" type="start"/>' % item['n'] + left
                elif kind == 'words':
                    body += words_dir(item['text'], right=item['text'].rstrip('.').lower() in ('fin', 'fine', 'd.c', 'd.s'))
                elif kind == 'segno':
                    body += '<direction placement="above"><direction-type><segno/></direction-type></direction>'
            for t, item in sorted(controls, key=lambda c: c[0]):
                kind = item['kind']
                if t != b:
                    continue
                if kind == 'repeat_end':
                    if 'volta' in item:
                        right += '<ending number="%d" type="stop"/>' % item['volta']
                    right += '<repeat direction="backward"/>'
                elif kind == 'volta_stop':
                    right += '<ending number="%d" type="discontinue"/>' % item['n']
                elif kind == 'bar':
                    style = {'|.': 'light-heavy', '||': 'light-light'}.get(item['style'])
                    if style and not any('<repeat' in r for r in right):
                        right = '<bar-style>%s</bar-style>' % style + right
            if index == 0:
                for text in self.words:
                    body += words_dir(text)
            state = dict(key_state)
            # Una voz con solo silencios de relleno en este compas no se escribe; las plicas van arriba y abajo
            # solo donde suenan dos voces.
            active = [k for k, (events, _, _, _) in enumerate(timelines)
                      if k == 0 or any(e['kind'] != 'space' for e in events if a <= e['at'] < b)]
            for turn, k in enumerate(active):
                if turn:
                    body += '<backup><duration>%d</duration></backup>' % int(length * DIVISIONS)
                stem = ('up' if turn == 0 else 'down') if len(active) > 1 else None
                body += self.voice_xml(timelines[k][0], a, b, k + 1, stem, state, time, full if not implicit else length)
            barline_left = '<barline location="left">%s</barline>' % left if left else ''
            barline_right = '<barline location="right">%s</barline>' % right if right else ''
            out.append('<measure number="%d"%s>%s%s%s%s</measure>' %
                       (number, ' implicit="yes"' if (implicit and index == 0 and pickup) or completes else '', attrs, barline_left,
                        body, barline_right))
        header = ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><work><work-title>' +
                  escape(self.title) + '</work-title></work><identification><creator type="composer">' +
                  escape(self.composer) + '</creator></identification><part-list><score-part id="P1">'
                  '<part-name>Guitar</part-name></score-part></part-list><part id="P1">')
        return header + ''.join(out) + '</part></score-partwise>\n'

    @staticmethod
    def measure_bounds(timelines, controls, full, end):
        """Finales de compas: las comprobaciones de compas del archivo o, si no las trae, la metrica (con \\partial)."""
        bars = set(b for _, _, bs, _ in timelines for b in bs)
        if bars:
            # El inicio y el fin de una repeticion o de una casilla caen siempre en una barra de compas, la trajera o no
            # el archivo (las casillas 1.a y 2.a no suelen llevar `|` entre ellas).
            edges = {t for t, c in controls if c['kind'] in ('repeat_start', 'repeat_end', 'volta', 'volta_stop') and 0 < t < end}
            return sorted(bars | edges | {end})
        # `\partial d` en el instante t: el compas que empieza ahi dura d (un anacrusa al inicio o un compas corto al
        # final de una repeticion); el resto dura lo que marca la metrica.
        partials = {}
        for t, c in controls:
            if c['kind'] == 'partial':
                partials[t] = c['dur']
        bounds, t = [], Fraction(0)
        while t < end:
            t += partials.get(t, full)
            bounds.append(min(t, end))
        return bounds

    @staticmethod
    def key_table(fifths):
        table = {}
        order = SHARP_ORDER if fifths > 0 else FLAT_ORDER
        for step in order[:abs(fifths)]:
            table[step] = 1 if fifths > 0 else -1
        return table

    def voice_xml(self, events, a, b, number, stem, state, time, length):
        inside = [e for e in events if a <= e['at'] < b]
        out, cursor = '', a
        beam_events = []
        group = Fraction(3, 2) if time[1] == 8 and time[0] % 3 == 0 else Fraction(1)
        for e in inside:
            if e['at'] > cursor:
                out += self.rest_xml(e['at'] - cursor, number, True)
                beam_events.append({'level': 0, 'pos': cursor - a})
            if e['at'] + e['dur'] > b:
                raise LyError('una nota cruza la barra de compas en %s (voz %d)' % (e['at'], number))
            if e.get('grace'):
                out += self.chord_xml(e, number, stem, state, -1)
                continue
            level = BEAM_LEVEL.get(self.type_of(e['dur']), 0) if e['kind'] == 'chord' else 0
            beam_events.append({'level': level, 'pos': e['at'] - a})
            if e.get('segno'):
                out += '<direction placement="above"><direction-type><segno/></direction-type></direction>'
            if e['kind'] == 'chord':
                out += self.chord_xml(e, number, stem, state, len(beam_events) - 1)
            else:
                out += self.rest_xml(e['dur'], number, e['kind'] == 'space')
            cursor = e['at'] + e['dur']
        if cursor < b:
            out += self.rest_xml(b - cursor, number, True)
            beam_events.append({'level': 0, 'pos': cursor - a})
        return self.apply_beams(out, beam_events, group)

    @staticmethod
    def type_of(dur):
        from mscx_to_musicxml import TYPE_QUARTERS
        for kind, quarters in sorted(TYPE_QUARTERS.items(), key=lambda kv: -kv[1]):
            for dots in range(4):
                if quarters * (2 - Fraction(1, 2 ** dots)) == dur:
                    return kind
        return nearest_type(dur)

    def rest_xml(self, dur, number, hidden):
        kind = self.type_of(dur)
        return ('<note%s><rest/><duration>%d</duration><voice>%d</voice><type>%s</type>%s</note>' %
                (' print-object="no"' if hidden else '', int(dur * DIVISIONS), number, kind,
                 '<dot/>' * dots_of(dur, kind, None)))

    def chord_xml(self, e, number, stem, state, index):
        out = ''
        grace = e.get('grace')
        kind = self.type_of(e['grace_dur'] if grace else e['dur'])
        for i, p in enumerate(e['pitches']):
            parts = ['<note>']
            if grace:
                parts.append('<grace slash="yes"/>' if e.get('slash') else '<grace/>')
            if i:
                parts.append('<chord/>')
            parts.append('<pitch><step>%s</step>%s<octave>%d</octave></pitch>' %
                         (p['step'].upper(), '<alter>%d</alter>' % p['alter'] if p['alter'] else '', p['octave'] + self.octave_shift))
            if not grace:
                parts.append('<duration>%d</duration>' % int(e['dur'] * DIVISIONS))
            if e.get('tied_from'):
                parts.append('<tie type="stop"/>')
            if e['tie']:
                parts.append('<tie type="start"/>')
            parts.append('<voice>%d</voice><type>%s</type>%s' % (
                number, kind, '' if grace else '<dot/>' * dots_of(e['dur'], kind, None)))
            slot = (p['step'], p['octave'])
            expected = state.get(p['step'], 0) if slot not in state else state[slot]
            shown = ''
            if p['alter'] != expected:
                shown = {1: 'sharp', -1: 'flat', 0: 'natural', 2: 'double-sharp', -2: 'flat-flat'}[p['alter']]
                state[slot] = p['alter']
            if shown:
                parts.append('<accidental>%s</accidental>' % shown)
            if stem:
                parts.append('<stem>%s</stem>' % stem)
            if i == 0 and not grace:
                parts.append('@B%d@' % index)
            notations = ''
            if e.get('tied_from'):
                notations += '<tied type="stop"/>'
            if e['tie']:
                notations += '<tied type="start"/>'
            if i == 0:
                notations += '<slur type="stop" number="1"/>' * e['slur_stop']
                notations += '<slur type="start" number="1"/>' * e['slur_start']
                if e.get('fermata'):
                    notations += '<fermata type="upright"/>'
            if p['fingers']:
                notations += '<technical>%s</technical>' % ''.join('<fingering>%s</fingering>' % f for f in p['fingers'])
            if notations:
                parts.append('<notations>%s</notations>' % notations)
            parts.append('</note>')
            out += ''.join(parts)
        return out

    @staticmethod
    def apply_beams(xml, events, group):
        runs, run = [], []
        for i, ev in enumerate(events):
            ev['i'] = i
            if ev['level'] == 0:
                if run:
                    runs.append(run)
                run = []
                continue
            if run and ev['pos'] // group != run[-1]['pos'] // group:
                runs.append(run)
                run = []
            run.append(ev)
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
                    tag = 'continue' if before and after else 'begin' if after else 'end' if before else \
                        ('backward hook' if k > 0 else 'forward hook')
                    tags.append('<beam number="%d">%s</beam>' % (level, tag))
                states[ev['i']] = ''.join(tags)
        return re.sub(r'@B(\d+)@', lambda m: states.get(int(m.group(1)), ''), xml)


def mark_ties(voices):
    """Una nota que sigue a otra con `~` recibe el cierre de la ligadura (tied_from). LilyPond ignora una ligadura entre
    alturas distintas (Mutopia tiene una en la leccion 11, `d, ~ d'`); aqui tambien: se quita de las dos notas."""
    for voice in voices:
        previous = None
        for item in voice:
            if item['kind'] not in ('chord', 'rest', 'space'):
                continue
            wanted = bool(previous and previous['tie'] and previous['kind'] == 'chord')
            if wanted and pitch_set(previous) != pitch_set(item):
                previous['tie'] = False
                wanted = False
            item['tied_from'] = wanted
            previous = item


def pitch_set(event):
    return {(p['step'], p['alter'], p['octave']) for p in event['pitches']}


def convert(path, title, composer, words=None):
    with open(path, encoding='utf-8') as f:
        parser = Parser(f.read())
    voices = parser.parse_file()
    mark_ties(voices)
    # Con clave de sol normal el archivo da la altura escrita de la guitarra (suena una octava mas grave); con
    # `treble_8` (octava baja) ya da la que suena. El motor espera la que suena.
    shift = 0 if '_8' in parser.clef else -1
    return Writer(voices, title, composer, words, score_controls=parser.score_controls, octave_shift=shift).render()


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('target')
    ap.add_argument('--title', default='Sor')
    ap.add_argument('--composer', default='Fernando Sor')
    args = ap.parse_args(argv)
    xml = convert(args.source, args.title, args.composer)
    with open(args.target, 'w', encoding='utf-8') as f:
        f.write(xml)


if __name__ == '__main__':
    main(sys.argv[1:])
