"""Fuentes curadas tras cotejar los casos pendientes con el PDF de Marieh.

    python scripts/sagreras/recover.py N

No cambia el lector ni regenera las fuentes ya publicadas. Una cabeza compartida
es un solo ataque en la TAB, incluso cuando ambas plicas tienen igual duración.
"""
import sys
from collections import Counter

import transcribe as T


def validate(lesson, measures):
    full = lesson['time'][0] * 16 // lesson['time'][1] * T.SCALE
    read = Counter()
    for data in measures:
        assert data['length'] == full
        attacks = set()
        for voice in data['voices']:
            end = 0
            for onset, duration, pitch, *_ in voice['events']:
                assert end <= onset and 0 < duration and onset + duration <= full
                end = onset + duration
                attacks.update((onset, p) for p in pitch.split('+') if p != 'R')
        read.update(T.written_midi(p) for _, p in attacks)
    printed = Counter(p + 12 for _, p in lesson['tab'])
    assert read == printed, (read - printed, printed - read)


def recover(number, lessons):
    if number not in {62}:
        raise ValueError(f'Leccion sin cotejo curado: {number}')
    lesson = lessons[number]
    measures = T.lesson_measures(lesson)
    validate(lesson, measures)
    (T.SOURCES / f'{number:02d}.musicxml').write_text(T.to_xml(number, lesson, measures), encoding='utf-8')
    T.record_measures(number, len(measures))
    print(f'{number}: {len(measures)} compases; alturas y duraciones verificadas')


if __name__ == '__main__':
    lessons = T.read_lessons()
    for arg in sys.argv[1:]:
        recover(int(arg), lessons)
