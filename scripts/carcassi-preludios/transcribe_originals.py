"""Carcassi's pre-Santisteban text, read from Ditson 1853 (printed pp. 22–69).

The 16 selected keys keep the site's numbering, not their order in the method.
All pitches are written guitar pitches. One timing unit is a sixteenth note.
See sources/README.md for source pages and engraving conventions.
"""
import copy
import importlib
from pathlib import Path
import xml.etree.ElementTree as ET

from transcribe_lib import bass, slots, write

HERE = Path(__file__).resolve().parent
KEYS = ['C Major', 'A Minor', 'G Major', 'E Minor', 'D Major', 'B Minor', 'A Major',
        'F# Minor', 'E Major', 'C# Minor', 'F Major', 'D Minor', 'Bb Major', 'G Minor', 'Eb Major', 'C Minor']
FIFTHS = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, -1, -1, -2, -2, -3, -3]


def flow(notes, lows, step=1):
    """Upper attacks and sustained lower voice; omit their shared noteheads."""
    if isinstance(notes, str):
        notes = notes.split()
    lower = bass(*lows)
    upper = [(i * step, step, p, None) for i, p in enumerate(notes)
             if p != '-' and not any(pos == i * step and low == p for pos, _, low, _ in lower)]
    return {'bass': lower, 'up': upper}


def halves(first, second, step=1):
    a, b = first.split(), second.split()
    size = len(a) * step
    return flow(a + b, [(0, size, a[0]), (size, size, b[0])], step)


def repeat(first, second=None, step=1):
    return halves(first, second or first, step)


def ending(low, chord=None, duration=8, rest=8):
    return {'bass': bass((0, duration, low)),
            'up': ([(0, duration, chord, None)] if chord else []) + [(duration, rest, 'R', None)]}


def legacy(number):
    """Unchanged passages shared by the two editions; discard editorial fingering."""
    data = copy.deepcopy(importlib.import_module(f'transcribe_{number:02d}').MEASURES)
    for bar in data:
        for voice in ['bass', 'up']:
            bar[voice] = [(p, d, '+'.join(n.partition(':')[0] for n in pitch.split('+')), None)
                          for p, d, pitch, _ in bar[voice]]
    return data


def originals():
    scores = {}
    scores[1] = [
        halves('C4 G4 C5 E5', 'E4 G4 C5 E5', 2),
        halves('A3 A4 C5 E5', 'C4 A4 C5 E5', 2),
        halves('D4 A4 D5 F5', 'F4 A4 D5 F5', 2),
        halves('G3 G4 B4 F5', 'B3 G4 B4 F5', 2),
        halves('C4 G4 C5 E5', 'A3 A4 C#5 G5', 2),
        halves('D4 A4 D5 F5', 'F4 A4 D5 F5', 2),
        halves('G3 G4 C5 E5', 'G3 G4 B4 F5', 2),
        ending('C4', 'G4+C5+E5'),
    ]
    scores[2] = [
        flow('A3 A4 C5 A4 C5 A4 A3 A4 F4 A4 C5 A4 C5 A4 F4 A4', [(0, 6, 'A3'), (6, 2, 'A3'), (8, 6, 'F4'), (14, 2, 'F4')]),
        flow('D4 A4 B4 A4 B4 A4 D4 A4 E4 G#4 D5 G#4 E5 G#4 E4 G#4', [(0, 6, 'D4'), (6, 2, 'D4'), (8, 6, 'E4'), (14, 2, 'E4')]),
        halves('A3 A4 C5 A4 E5 A4 C5 A4', 'G3 G4 B4 G4 F5 G4 B4 G4'),
        halves('C4 G4 C5 G4 E5 G4 C5 G4', 'B3 G#4 D5 G#4 E5 G#4 D5 G#4'),
        flow('A3 A4 C5 A4 F4 A4 C5 A4 D4 A4 B4 A4 E3 G#4 B4 G#4', [(0, 4, 'A3'), (4, 4, 'F4'), (8, 4, 'D4'), (12, 4, 'E3')]),
        halves('A3 A4 C5 A4 E5 A4 C5 A4', 'A3 G#4 B4 G#4 E5 G#4 B4 G#4'),
        halves('A3 A4 C5 A4 E5 A4 C5 A4', 'A3 G#4 D5 G#4 E5 G#4 D5 G#4'),
        ending('A3'),
    ]
    scores[3] = legacy(3)
    scores[4] = [
        halves('E3 G4 B4 G5 G4 B4', 'E3 G4 B4 E5 G4 B4'),
        repeat('E3 A4 C5 F#5 A4 C5'),
        halves('E3 A4 C5 F#5 A4 C5', 'E3 F#4 A4 D#5 F#4 A4'),
        repeat('E3 G4 B4 E5 G4 B4'),
        halves('D4 G#4 B4 F5 G#4 B4', 'D4 G#4 B4 E5 G#4 B4'),
        halves('C4 A4 C5 E5 A4 C5', 'A3 A4 C5 E5 A4 C5'),
        halves('B3 G4 B4 E5 G4 B4', 'B3 F#4 A4 D#5 F#4 A4'),
        {'bass': bass((0, 6, 'E3'), (6, 4, 'E4')), 'up': slots([None, 'G4', 'B4', 'E5', 'G4', 'B4']) + [(10, 2, 'R', None)]},
    ]
    scores[5] = [
        halves('D4 A4 D5 A4 F#5 A4 D5 A4', 'D#4 A4 B4 A4 F#5 A4 B4 A4'),
        repeat('E4 G4 B4 G4 G5 G4 B4 G4'),
        halves('A3 A4 C#5 A4 G5 A4 C#5 A4', 'A3 A4 C#5 A4 E5 A4 C#5 A4'),
        repeat('D4 A4 D5 A4 F#5 A4 D5 A4'),
        repeat('E4 G#4 D5 G#4 E5 G#4 D5 G#4'),
        halves('A3 A4 C#5 A4 E5 A4 C#5 A4', 'A3 A4 C#5 A4 G5 A4 C#5 A4'),
        halves('D4 A4 D5 A4 F#5 A4 D5 A4', 'A3 A4 C#5 A4 E5 A4 C#5 A4'),
        {'bass': bass((0, 8, 'D4'), (8, 4, 'D4')), 'up': slots([None, 'A4', 'D5', 'A4', 'F#5', 'A4', 'D5', 'A4']) + [(12, 4, 'R', None)]},
    ]
    def repeated_peak(low, a, b, c):
        return flow([low, a, b, c, c, c, c, c, low, a, b, c], [(0, 8, low), (8, 4, low)])
    scores[6] = [repeated_peak(*x.split()) for x in [
        'B3 F#4 B4 D5', 'B3 G4 B4 E5', 'B3 E4 G#4 B4', 'B3 F#4 B4 D5',
        'G3 D4 G4 B4', 'E3 G4 C5 E5', 'F#3 F#4 A#4 C#5', 'B3 F#4 B4 D5',
        'B3 F#4 A#4 C#5', 'B3 F#4 B4 D5', 'B3 E4 G#4 B4',
    ]] + [ending('B3', 'D4+F#4+B4', 8, 4)]
    scores[7] = legacy(7)
    scores[7][4] = repeat('A3 A4 C#5 A4 C#5 A4', 'A3 A4 C#5 A4 G5 A4')
    scores[7][5] = halves('D4 A4 D5 A4 F#5 A4', 'D#4 A4 C5 A4 G5 A4')
    scores[7][6] = halves('E4 A4 C#5 A4 E5 A4', 'E3 G#4 B4 G#4 E5 G#4')
    scores[7][7] = {'bass': bass((0, 6, 'A3'), (6, 4, 'A3')),
                    'up': [(0, 2, 'A4', None), (2, 2, 'C#5', None), (4, 2, 'E5', None), (6, 2, 'C#5', None), (8, 2, 'A5', None), (10, 2, 'R', None)]}
    scores[8] = legacy(8)
    scores[8][-1] = ending('F#3', 'A4+C#5+F#5', 8, 4)
    scores[8][-1]['bass'] = bass((0, 12, 'F#3'))
    # Printed bars in the E-major prelude contain two quarters despite the common-time sign.
    # Keep these divisions and the original durations, including its longer closing bar.
    def chords(low, chord):
        return flow([low, chord, chord, chord], [(0, 8, low)], 2)
    scores[9] = [
        chords('E3', 'G#4+B4+E5'), chords('E3', 'A4+C#5+E5'),
        # Bar 3: D natural shares each eighth-note chord's stem with B and E.
        chords('E3', 'B4+D5+E5'),
        chords('A3', 'A4+C#5+E5'), chords('A#3', 'G4+C#5+E5'), chords('B3', 'G#4+B4+E5'),
        chords('D4', 'A4+B4+F#5'), chords('E4', 'G4+B4+G5'),
        chords('D4', 'G4+B4+F5'), chords('C4', 'G4+C5+E5'),
        flow(['-', '-', 'G#4+D5+E5', 'G#4+D5+F5', 'G#4+D5+E5', 'G#4+D5+F5', 'G#4+D5+E5', 'G#4+D5+F5'], [(0, 8, 'B3')]),
        chords('A3', 'A4+C5+E5'), chords('A#3', 'G4+C#5+E5'), chords('B3', 'G#4+B4+E5'),
        chords('B3', 'A4+B4+D#5'), ending('E3', 'G#4+B4+E5'),
    ]
    scores[10] = [
        repeat('C#4 G#4 C#5 E5 C#5 G#4', step=2), repeat('D#4 G#4 B#4 F#5 B#4 G#4', step=2),
        halves('E#4 B4 D5 G#5 D5 B4', 'E4 B4 D5 G#5 D5 B4', 2),
        repeat('F#4 A4 C#5 A5 C#5 A4', step=2), repeat('F#4 B#4 D#5 G#5 D#5 B#4', step=2),
        repeat('E4 G#4 C#5 G#5 C#5 G#4', step=2),
        halves('D#4 A4 C#5 F#5 C#5 A4', 'G#3 D#4 G#4 B#4 G#4 D#4', 2),
        repeat('C#4 G#4 C#5 E5 C#5 G#4', step=2),
        halves('G#3 G#4 C#5 E5 C#5 G#4', 'G#3 E4 G#4 C#5 G#4 E4', 2),
        repeat('F#3 F#4 A4 C#5 A4 F#4', step=2), repeat('G#3 B#4 D#5 G#5 D#5 B#4', step=2),
        ending('C#4', 'E4+C#5', 16, 8),
    ]
    scores[11] = legacy(11)
    scores[11][2] = repeat('E4 G4 Bb4 E5 Bb4 G4')
    scores[11][5] = halves('D4 A4 D5 F5 D5 A4', 'Bb3 Bb4 D5 G5 D5 Bb4')
    scores[11][6] = halves('C4 A4 C5 F5 C5 A4', 'C4 Bb4 C5 E5 C5 Bb4')
    # Four eighths and a half rest in each of the first ten bars.
    dm = [
        ('D4', 'A4 D5 F5 D5'), ('A3', 'A4 C#5 E5 C#5'), ('A3', 'A4 C#5 F5 C#5'),
        ('D4', 'A4 D5 F5 D5'), ('C4', 'Bb4 C5 E5 C5'), ('F4', 'A4 C5 F5 C5'),
        ('E4', 'G#4 D5 E5 D5'), ('A3', 'A4 C#5 E5 C#5'), ('A3', 'A4 C#5 G5 C#5'),
        ('A3', 'A4 D5 F5 D5'),
    ]
    scores[12] = [dict(bass=bass((0, 8, low)), up=[(i*2, 2, p, None) for i,p in enumerate(notes.split())]+[(8, 8, 'R', None)]) for low, notes in dm]
    scores[12] += [dict(bass=bass((0, 8, 'A3'), (8, 8, 'A3')), up=[(i*2, 2, p, None) for i,p in enumerate('A4 C#5 E5 C#5 A4 C#5 G5 C#5'.split())]), ending('D4', 'A4+D5+F5')]
    scores[13] = legacy(13)
    scores[14] = legacy(14)
    scores[14][6] = halves('C4 C5 Eb5 A5 Eb5 C5', 'D4 A4 D5 F#5 D5 A4', 2)
    scores[15] = legacy(15)
    scores[15][0] = {'bass': bass((0,8,'Eb4'), (8,8,'G4')), 'up': [(1,1,'G4',None),(2,1,'Bb4',None),(3,1,'G4',None),(4,2,'Eb5',None),(6,2,'G4+Bb4+Eb5',None),(9,1,'Bb4',None),(10,1,'Eb5',None),(11,1,'Bb4',None),(12,2,'Bb5',None),(14,2,'Bb4+Eb5+Bb5',None)]}
    scores[15][1] = {'bass': bass((0,8,'F4'), (8,8,'Bb3')), 'up': [(1,1,'C5',None),(2,1,'Eb5',None),(3,1,'C5',None),(4,2,'A5',None),(6,2,'C5+Eb5+A5',None),(9,1,'Bb4',None),(10,1,'D5',None),(11,1,'Bb4',None),(12,2,'Ab5',None),(14,2,'Bb4+D5+Ab5',None)]}
    scores[15][2] = {'bass': bass((0,8,'B3'), (8,8,'C4')), 'up': [(1,1,'G4',None),(2,1,'B4',None),(3,1,'G4',None),(4,2,'F5',None),(6,2,'G4+B4+F5',None),(9,1,'G4',None),(10,1,'Bb4',None),(11,1,'G4',None),(12,2,'Eb5',None),(14,2,'G4+Bb4+Eb5',None)]}
    scores[15][3] = {'bass': bass((0,8,'Ab3'), (8,8,'Bb3')), 'up': [(1,1,'Ab4',None),(2,1,'C5',None),(3,1,'Ab4',None),(4,2,'F5',None),(6,2,'Ab4+C5+F5',None),(9,1,'F4',None),(10,1,'Ab4',None),(11,1,'F4',None),(12,2,'D5',None),(14,2,'F4+Ab4+D5',None)]}
    scores[15][4] = flow('Eb4 G4 Bb4 G4 Eb5 G4 Bb4 G4 Eb4 G4 Bb4 Eb5 Eb4 Bb4 Eb5 G5', [(0,8,'Eb4'),(8,4,'Eb4'),(12,4,'Eb4')])
    scores[15][5] = flow('F4 Bb4 D5 Bb4 F5 Bb4 D5 Bb4 Bb3 F4 A4 F4 D5 F4 A4 F4', [(0,8,'F4'),(8,8,'Bb3')])
    scores[15][6] = copy.deepcopy(scores[15][4])
    scores[15][7] = ending('Eb4', 'G4+Bb4+Eb5')
    scores[16] = legacy(16)
    def three(lows, notes):
        return flow(notes, [(i*4,4,p) for i,p in enumerate(lows.split())])
    scores[16][2] = three('B3 B3 B3', 'B3 F5 D5 G4 B3 G4 D5 F5 B3 F5 D5 G4')
    scores[16][4] = three('F4 F4 F4', 'F4 F5 D5 Ab4 F4 Ab4 D5 F5 F4 F5 D5 Ab4')
    scores[16][5] = three('F#4 F#4 F#4', 'F#4 A5 Eb5 C5 F#4 C5 Eb5 A5 F#4 A5 Eb5 C5')
    scores[16][6] = three('G4 G4 G3', 'G4 G5 Eb5 C5 G4 C5 Eb5 G5 G3 G4 B4 D5')
    scores[16][7] = three('C4 C4 C4', 'C4 Eb5 C5 G4 C4 G4 C5 Eb5 C4 G4 C5 Eb5')
    scores[16][8] = three('C4 C4 C4', 'C4 Eb5 C5 G4 C4 G4 C5 Eb5 C4 G4 C5 Eb5')
    scores[16][9] = ending('C4', 'G4+C5+Eb5', 8, 4)
    return scores


def main():
    times = {4:(6,8),6:(3,4),7:(6,8),8:(3,4),9:(2,4),10:(12,8),11:(6,8),13:(12,8),14:(12,8),16:(3,4)}
    for number, measures in originals().items():
        path = HERE / 'corrected' / f'prelude-{number:02d}.musicxml'
        write(str(path), f'Prelude {number} in {KEYS[number-1]}', FIFTHS[number-1], measures, time=times.get(number,(4,4)), group={1:8,9:8,10:12,12:8,13:12,14:12}.get(number))
        xml = ET.parse(path)
        if number == 9:
            # Preserve the source's printed common-time sign and underfull bars.
            time = xml.find('.//time'); time.set('symbol','common'); time.find('beats').text='4'
            xml.findall('.//measure')[-1].find('backup/duration').text = '16'
        if number == 16:
            time = xml.find('.//time'); time.set('symbol', 'common'); time.find('beats').text = '4'
        barline = ET.SubElement(xml.findall('.//measure')[-1], 'barline', location='right')
        ET.SubElement(barline, 'bar-style').text = 'light-heavy'
        xml.write(path, encoding='utf-8', xml_declaration=True)

if __name__ == '__main__':
    main()
