#!/usr/bin/env python3
"""Local folklore TAB editor. Run with the lab's Verovio Python environment."""
import argparse
import copy
import importlib.util
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import tempfile
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import verovio

HERE = Path(__file__).resolve().parent
MEI = 'http://www.music-encoding.org/ns/mei'
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', MEI)
XML_ID = '{http://www.w3.org/XML/1998/namespace}id'
SETS = [('arpegios', 'Primera tanda', 'folklore-arpegios/coleccion.json')] + [
    (key, label, f'folklore-por-ritmo/{key}.json') for key, label in
    [('milonga', 'Milonga'), ('zamba', 'Zamba'), ('chamame', 'Chamamé'),
     ('chacarera', 'Chacarera'), ('vals', 'Vals criollo'), ('polca', 'Polca paraguaya')]]
OPEN = [64, 59, 55, 50, 45, 40]
PITCHES = ['c', 'c', 'd', 'd', 'e', 'f', 'f', 'g', 'g', 'a', 'a', 'b']
SHARPS = {1, 3, 6, 8, 10}


class Exercise:
    def __init__(self, generator, collection, exercise, edits):
        self.exercise = exercise
        self.bars = generator.expand(collection, exercise)
        self.notes = {}
        root = ET.fromstring(generator.musicxml(exercise, self.bars))
        # Give paired notation/TAB notes stable IDs before importing MusicXML.
        for bar_index, measure in enumerate(root.findall('./part/measure')):
            for staff, prefix in [(1, 'n'), (2, 't')]:
                xml_notes = iter(n for n in measure.findall('note')
                                 if n.findtext('staff') == str(staff) and n.find('pitch') is not None)
                for voice, events in self.bars[bar_index]['voices'].items():
                    for event_index, event in enumerate(events):
                        for cell_index, cell in enumerate(event['cells']):
                            key = f'{bar_index}-{voice}-{event_index}-{cell_index}'
                            next(xml_notes).set('id', prefix + key)
                            if staff == 1:
                                string, fret = map(int, cell.split('/'))
                                self.notes[key] = dict(key=key, bar=bar_index + 1, voice=voice,
                                                       at=event['at'], duration=event['duration'],
                                                       string=string, fret=fret)
        self.xml = root
        self.groups = {}
        for note in self.notes.values():
            note['active'] = True
            group = note['key'].rsplit('-', 1)[0]
            note['group'] = group
            self.groups.setdefault(group, []).append(note['key'])
        self.attacks = {}
        for note in list(self.notes.values()):
            self.attacks.setdefault((note['bar'], note['at']), []).append(note['key'])
        # Reserve six positions per attack, including the original notes. New
        # notes join the upper voice when present and inherit its duration.
        for (bar, at), keys in self.attacks.items():
            anchor = self.notes[keys[0]]
            for index in range(6 - len(keys)):
                key = f'{bar - 1}-extra-{at}-{index}'
                self.notes[key] = dict(anchor, key=key, active=False)
                self.groups[anchor['group']].append(key)

        self.toolkit = verovio.toolkit()
        self.toolkit.setOptions(dict(pageWidth=2100, pageHeight=12000, scale=50,
            adjustPageHeight=True, breaks='encoded', header='none', footer='none',
            spacingStaff=10, spacingSystem=8, svgViewBox=True, minLastJustification=0.0,
            svgHtml5=True, svgFormatRaw=True, xmlIdSeed=exercise['numero']))
        if not self.toolkit.loadData(ET.tostring(root, encoding='unicode')):
            raise ValueError('No se pudo leer la partitura')
        mei = ET.fromstring(self.toolkit.getMEI())
        for parent in mei.iter():
            for child in list(parent):
                if child.tag in {f'{{{MEI}}}tabDurSym', f'{{{MEI}}}grpSym'}:
                    parent.remove(child)
                elif parent.tag == f'{{{MEI}}}staffDef' and parent.get('n') == '2' and child.tag == f'{{{MEI}}}meterSig':
                    parent.remove(child)
        parents = {child: parent for parent in mei.iter() for child in parent}
        elements = {node.get(XML_ID): node for node in mei.iter() if node.get(XML_ID)}
        for prefix in ('n', 't'):
            for group, keys in self.groups.items():
                original = elements[prefix + keys[0]]
                parent = parents[original]
                if parent.tag not in {f'{{{MEI}}}chord', f'{{{MEI}}}tabGrp'}:
                    chord = ET.Element(f'{{{MEI}}}chord', {XML_ID: prefix + 'group-' + group})
                    for attr in ('dur', 'dur.ppq', 'dots', 'stem.dir'):
                        if attr in original.attrib:
                            chord.set(attr, original.attrib.pop(attr))
                    parent.insert(list(parent).index(original), chord)
                    parent.remove(original)
                    chord.append(original)
                else:
                    chord = parent
                    chord_id = chord.get(XML_ID)
                    if chord_id:
                        for node in mei.iter():
                            for attr, value in list(node.attrib.items()):
                                if value == '#' + chord_id:
                                    node.set(attr, '#' + prefix + 'group-' + group)
                    chord.set(XML_ID, prefix + 'group-' + group)
                for index, key in enumerate(keys):
                    if prefix + key not in elements:
                        note = ET.SubElement(chord, f'{{{MEI}}}note', dict(original.attrib))
                        note.set(XML_ID, prefix + key)
                        note.set('visible', 'false')
                        if prefix == 'n':
                            # Separate placeholders during the one horizontal layout
                            # so hidden unisons cannot displace heads or stems.
                            note.set('pname', ('c', 'e', 'g', 'b', 'd', 'f')[index])
                            note.set('oct', str(7 + index // 4))
        # Reserve an accidental node even when none is printed, so later pitch
        # edits never need to reload or horizontally lay out the document.
        for note in mei.iter(f'{{{MEI}}}note'):
            ident = note.get(XML_ID, '')
            if ident.startswith('n') and ident[1:] in self.notes:
                acc = note.find(f'{{{MEI}}}accid')
                if acc is None:
                    acc = ET.SubElement(note, f'{{{MEI}}}accid')
                acc.set(XML_ID, 'a' + ident[1:])
                for attr in ('accid', 'accid.ges'):
                    if attr in note.attrib:
                        acc.set(attr, note.attrib.pop(attr))
        self.fermatas = {node.get(XML_ID): node.get('startid', '').lstrip('#')
                         for node in mei.iter(f'{{{MEI}}}fermata')}
        if not self.toolkit.loadData(ET.tostring(mei, encoding='unicode')):
            raise ValueError('No se pudo preparar la partitura')
        self.attributes = {node.get(XML_ID): dict(node.attrib) for node in mei.iter() if node.get(XML_ID)}
        self.svg = self.toolkit.renderToSVG(1)  # Establish the immutable horizontal layout.
        self.refresh()
        self.layout_svg = self.svg
        for key, position in edits.items():
            if key not in self.notes:
                raise ValueError('Nota desconocida en las ediciones guardadas')
            if position is None:
                self.notes[key]['active'] = False
            else:
                self.check_position(key, *position)
                self.notes[key].update(string=position[0], fret=position[1], active=True)
        if edits:
            self.refresh()

    def set_attribute(self, ident, attribute, value):
        value = str(value)
        if self.attributes[ident].get(attribute, '') != value:
            self.actions.append(dict(action='set', param=dict(
                elementId=ident, attribute=attribute, value=value)))
            self.attributes[ident][attribute] = value

    def refresh(self):
        # Recalculate only pitch positions. Never call loadData/redoLayout here.
        # See Verovio Toolkit::RedoPagePitchPosLayout / Page::LayOutPitchPos.
        self.actions = []
        accidentals = {}
        representatives = {group: next((self.notes[key] for key in keys if self.notes[key]['active']), None)
                           for group, keys in self.groups.items()}
        fifths = self.exercise['quintas']
        for key, note in sorted(self.notes.items(), key=lambda item: (item[1]['bar'], item[1]['at'])):
            for prefix in ('n', 't'):
                self.set_attribute(prefix + key, 'visible', 'true' if note['active'] else 'false')
            if not note['active']:
                reference = representatives[note['group']]
                midi = OPEN[reference['string'] - 1] + reference['fret'] if reference else 60
                self.set_attribute('n' + key, 'pname', PITCHES[midi % 12])
                self.set_attribute('n' + key, 'oct', midi // 12 - 1)
                continue
            midi = OPEN[note['string'] - 1] + note['fret']
            pname, sharp, octave = PITCHES[midi % 12], int(midi % 12 in SHARPS), midi // 12 - 1
            # MEI retains sounding octaves; the guitar clef supplies the display octave.
            self.set_attribute('n' + key, 'pname', pname)
            self.set_attribute('n' + key, 'oct', octave)
            default = int(pname.upper() in 'FCGDAEB'[:fifths])
            context = (note['bar'], pname, octave)
            previous = accidentals.get(context, default)
            self.set_attribute('a' + key, 'accid', ('s' if sharp else 'n') if sharp != previous else '')
            accidentals[context] = sharp
            for attr, value in [('tab.course', note['string']), ('tab.fret', note['fret'])]:
                self.set_attribute('t' + key, attr, value)
        for group, keys in self.groups.items():
            visible = any(self.notes[key]['active'] for key in keys)
            for prefix in ('n',):
                self.set_attribute(prefix + 'group-' + group, 'visible', 'true' if visible else 'false')
        if self.actions and not self.toolkit.edit(dict(action='chain', param=self.actions)):
            raise ValueError('No se pudo actualizar la nota')
        self.toolkit.redoPagePitchPosLayout()
        self.svg = self.render_svg()

    def render_svg(self):
        """Refresh cached notation marks from active tones without horizontal layout."""
        root = ET.fromstring(self.toolkit.renderToSVG(1))
        nodes = {node.get("data-id"): node for node in root.iter() if node.get("data-id")}
        parents = {child: parent for parent in root.iter() for child in parent}
        tag = lambda name: f"{{{SVG}}}{name}"
        for group, keys in self.groups.items():
            chord = nodes["ngroup-" + group]
            dots = chord.find(f'./{tag("g")}[@class="dots"]')
            if dots is None or not len(dots):
                continue
            template = dict(dots[0].attrib)
            dots.clear()
            dots.set("class", "dots")
            staff = parents[chord]
            while staff.get("class") != "staff":
                staff = parents[staff]
            lines = [child for child in staff if child.tag == tag("path")]
            line_y = [float(re.search(r"M[-\d.]+[ ,]+([-\d.]+)", line.get("d")).group(1)) for line in lines[:2]]
            step = line_y[1] - line_y[0]
            pitches = set()
            for key in keys:
                if self.notes[key]["active"]:
                    head = nodes["n" + key].find(f'./{tag("g")}[@class="notehead"]/{tag("use")}')
                    pitches.add(float(re.search(r"translate\([-\d.]+[ ,]+([-\d.]+)", head.get("transform")).group(1)))
            used = set()
            for y in sorted(pitches):
                on_line = abs((y - line_y[0]) / step - round((y - line_y[0]) / step)) < .001
                position = y - step / 2 if on_line else y
                if position in used:
                    position += step
                used.add(position)
                ET.SubElement(dots, tag("ellipse"), dict(template, cy=str(position)))
        for ident, anchor in self.fermatas.items():
            fermata = nodes.get(ident)
            if fermata is None:
                continue
            group = anchor[len('ngroup-'):] if anchor.startswith('ngroup-') else self.notes.get(anchor[1:], {}).get('group')
            keys = self.groups.get(group, [])
            active = [key for key in keys if self.notes[key]['active']]
            if not active:
                fermata.set('visibility', 'hidden')
                continue
            chord = nodes['ngroup-' + group]
            staff = parents[chord]
            while staff.get('class') != 'staff':
                staff = parents[staff]
            line = next(child for child in staff if child.tag == tag('path'))
            top = float(re.search(r'M[-\d.]+[ ,]+([-\d.]+)', line.get('d')).group(1))
            heights = [top]
            for key in active:
                head = nodes['n' + key].find(f'./{tag("g")}[@class="notehead"]/{tag("use")}')
                heights.append(float(re.search(r'translate\([-\d.]+[ ,]+([-\d.]+)', head.get('transform')).group(1)))
            for stem in chord.findall(f'./{tag("g")}[@class="stem"]/{tag("path")}'):
                heights.extend(float(y) for y in re.findall(r'[ML][-\d.]+[ ,]+([-\d.]+)', stem.get('d')))
            y = min(heights) - 300
            for glyph in fermata.iter(tag('use')):
                glyph.set('transform', re.sub(r'translate\(([-\d.]+)[ ,]+[-\d.]+\)',
                    lambda match: f'translate({match.group(1)}, {y:g})', glyph.get('transform')))
        # Verovio also caches ledger segments in pitch-only layout. Rebuild
        # them from active heads so removed/moved notes leave no stray lines.
        for staff in root.iter(tag('g')):
            if staff.get('class') != 'staff':
                continue
            heads = []
            for node in staff.iter(tag('g')):
                key = node.get('data-id', '')
                if key.startswith('n') and key[1:] in self.notes and self.notes[key[1:]]['active']:
                    head = node.find(f'./{tag("g")}[@class="notehead"]/{tag("use")}')
                    x, y = map(float, re.search(r'translate\(([-\d.]+)[ ,]+([-\d.]+)', head.get('transform')).groups())
                    heads.append((x, y))
            if not heads and not any(node.get('data-id', '').startswith('n') for node in staff.iter()):
                continue
            for ledger in list(staff.iter(tag('g'))):
                if 'ledgerLines' in ledger.get('class', '').split():
                    parents[ledger].remove(ledger)
            lines = [child for child in staff if child.tag == tag('path')]
            if len(lines) < 5:
                continue
            ys = [float(re.search(r'M[-\d.]+[ ,]+([-\d.]+)', line.get('d')).group(1)) for line in lines[:5]]
            step = ys[1] - ys[0]
            segments = {}
            for x, y in heads:
                for edge, direction in ((ys[0], -1), (ys[-1], 1)):
                    line = edge + direction * step
                    while direction * (y - line) >= -.01:
                        segments.setdefault(line, []).append((x - .3 * step, x + 1.5 * step))
                        line += direction * step
            for y, spans in segments.items():
                merged = []
                for left, right in sorted(spans):
                    if merged and left <= merged[-1][1]:
                        merged[-1][1] = max(merged[-1][1], right)
                    else:
                        merged.append([left, right])
                ledger = ET.SubElement(staff, tag('g'), {'class': 'ledgerLines above' if y < ys[0] else 'ledgerLines below'})
                for left, right in merged:
                    ET.SubElement(ledger, tag('path'), {'d': f'M{left:g} {y:g} L{right:g} {y:g}', 'stroke-width': str(round(.12 * step))})
        ET.register_namespace("", SVG)
        ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
        try:
            return ET.tostring(root, encoding="unicode")
        finally:
            ET.register_namespace("", MEI)

    def check_position(self, key, string, fret):
        if key not in self.notes or type(string) is not int or type(fret) is not int or not 1 <= string <= 6 or not 0 <= fret <= 19:
            raise ValueError('Elegí una cuerda de 1 a 6 y un traste de 0 a 19')

    def payload(self):
        return dict(number=self.exercise['numero'], title=self.exercise['titulo'],
                    objective=self.exercise['objetivo'], meter=self.exercise['compas'],
                    notes=list(self.notes.values()), svg=self.svg, layoutSvg=self.layout_svg)

    def musicxml(self):
        root = copy.deepcopy(self.xml)
        # Rebuild each original rhythmic event as a chord, or a hidden rest
        # when its last note was removed. Backups and onset positions stay put.
        for measure in root.findall('./part/measure'):
            for prefix in ('n', 't'):
                for group, keys in self.groups.items():
                    originals = [node for node in measure.findall('note')
                                 if node.get('id', '')[1:].rsplit('-', 1)[0] == group
                                 and node.get('id', '').startswith(prefix)]
                    if not originals:
                        continue
                    index = list(measure).index(originals[0])
                    template = copy.deepcopy(originals[0])
                    for node in originals:
                        measure.remove(node)
                    active = [self.notes[key] for key in keys if self.notes[key]['active']]
                    for offset, note in enumerate(active or [None]):
                        node = copy.deepcopy(template)
                        for chord in node.findall('chord'):
                            node.remove(chord)
                        if note:
                            node.set('id', prefix + note['key'])
                            if offset:
                                node.insert(0, ET.Element('chord'))
                                for tag in ('beam', 'notations'):
                                    for child in node.findall(tag):
                                        node.remove(child)
                                if prefix == 't':
                                    technical = ET.SubElement(ET.SubElement(node, 'notations'), 'technical')
                                    ET.SubElement(technical, 'string')
                                    ET.SubElement(technical, 'fret')
                        else:
                            node.attrib.pop('id', None)
                            node.set('print-object', 'no')
                            for tag in ('pitch', 'accidental', 'stem', 'beam', 'notations'):
                                for child in node.findall(tag):
                                    node.remove(child)
                            node.insert(0, ET.Element('rest'))
                        measure.insert(index + offset, node)
        for node in root.findall('.//note'):
            key = node.get('id', '')[1:]
            if key not in self.notes:
                continue
            note = self.notes[key]
            midi = OPEN[note['string'] - 1] + note['fret']
            pitch = node.find('pitch')
            pitch.clear()
            ET.SubElement(pitch, 'step').text = PITCHES[midi % 12].upper()
            if midi % 12 in SHARPS:
                ET.SubElement(pitch, 'alter').text = '1'
            ET.SubElement(pitch, 'octave').text = str(midi // 12 - 1)
            accidental = node.find('accidental')
            if accidental is not None:
                node.remove(accidental)
            # Explicit accidentals keep both voices unambiguous on re-import.
            insert_at = list(node).index(node.find('type')) + 1
            while insert_at < len(node) and node[insert_at].tag == 'dot':
                insert_at += 1
            accidental = ET.Element('accidental')
            accidental.text = 'sharp' if midi % 12 in SHARPS else 'natural'
            node.insert(insert_at, accidental)
            technical = node.find('./notations/technical')
            if technical is not None:
                technical.find('string').text = str(note['string'])
                technical.find('fret').text = str(note['fret'])
        return ET.tostring(root, encoding='unicode', xml_declaration=True)


class Library:
    def __init__(self, lab):
        self.lab = lab
        spec = importlib.util.spec_from_file_location('folklore_score', lab / 'folklore-arpegios/build.py')
        self.generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.generator)
        self.save_path = lab / 'editor/ediciones.json'
        self.saved = json.loads(self.save_path.read_text()) if self.save_path.exists() else {}
        self.current = None
        self.exercises = {}

    def load(self, key):
        if key == self.current:
            return
        source = next((source for ident, _, source in SETS if ident == key), None)
        if source is None:
            raise ValueError('Set desconocido')
        collection = json.loads((self.lab / source).read_text())
        exercises = {str(e['numero']): Exercise(self.generator, collection, e,
            self.saved.get(key, {}).get(str(e['numero']), {})) for e in collection['ejercicios']}
        self.current, self.exercises = key, exercises

    def edit(self, data):
        self.load(data['set'])
        exercise = self.exercises[str(data['exercise'])]
        # Batch a whole measure atomically: moving a note between strings may
        # update several cells, but its attack, voice and duration stay fixed.
        changes = data.get('changes', [data])
        if not isinstance(changes, list) or not changes or len(changes) > len(exercise.notes):
            raise ValueError('Edición inválida')
        keys = set()
        for change in changes:
            key = change['key']
            if key not in exercise.notes or type(change.get('active', True)) is not bool:
                raise ValueError('Nota inválida')
            if change.get('active', True):
                exercise.check_position(key, change['string'], change['fret'])
            if key in keys:
                raise ValueError('Nota repetida')
            keys.add(key)
        before = copy.deepcopy(exercise.notes)
        old_saved = copy.deepcopy(self.saved)
        try:
            for change in changes:
                note = exercise.notes[change['key']]
                note['active'] = change.get('active', True)
                if note['active']:
                    note.update(string=change['string'], fret=change['fret'])
            occupied = set()
            for note in exercise.notes.values():
                if not note['active']:
                    continue
                cell = (note['bar'], note['at'], note['string'])
                if cell in occupied:
                    raise ValueError('Dos notas del mismo ataque no pueden ocupar la misma cuerda')
                occupied.add(cell)
            exercise.refresh()
            saved = self.saved.setdefault(self.current, {}).setdefault(str(data['exercise']), {})
            for change in changes:
                saved[change['key']] = [change['string'], change['fret']] if change.get('active', True) else None
            self.save_path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile('w', dir=self.save_path.parent, delete=False) as file:
                json.dump(self.saved, file, ensure_ascii=False, indent=2)
                temp = Path(file.name)
            temp.replace(self.save_path)
        except Exception:
            exercise.notes = before
            self.saved = old_saved
            exercise.refresh()
            raise
        return exercise.payload()


def handler(library):
    class Handler(BaseHTTPRequestHandler):
        def reply(self, data, content_type='application/json; charset=utf-8', status=200):
            if not isinstance(data, str):
                data = json.dumps(data, ensure_ascii=False)
            body = data.encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlparse(self.path).path
            try:
                if path == '/api/sets':
                    return self.reply([dict(id=k, label=label) for k, label, _ in SETS
                                       if (library.lab / _).exists()])
                if path.startswith('/api/set/'):
                    library.load(path.rsplit('/', 1)[1])
                    return self.reply([e.payload() for e in library.exercises.values()])
                if path.startswith('/api/musicxml/'):
                    _, _, _, collection, number = path.split('/')
                    library.load(collection)
                    return self.reply(library.exercises[number].musicxml(), 'application/vnd.recordare.musicxml+xml')
                if path == '/ascii-tabs.js':
                    return self.reply((HERE.parents[1] / 'vendor/ascii-tabs.js').read_text(), 'text/javascript; charset=utf-8')
                files = {'/': 'index.html', '/editor.js': 'editor.js', '/editor.css': 'editor.css'}
                if path in files:
                    mime = {'/': 'text/html', '/editor.js': 'text/javascript', '/editor.css': 'text/css'}[path]
                    return self.reply((HERE / files[path]).read_text(), mime + '; charset=utf-8')
                self.reply(dict(error='No encontrado'), status=404)
            except (ValueError, KeyError) as error:
                self.reply(dict(error=str(error)), status=400)

        def do_POST(self):
            # A page on another origin must not be able to write local edits.
            if self.headers.get('Origin') not in (None, f'http://{self.headers.get("Host")}'):
                return self.reply(dict(error='Origen no permitido'), status=403)
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if urlparse(self.path).path != '/api/edit' or not 0 < length < 32768:
                    raise ValueError('Petición inválida')
                self.reply(library.edit(json.loads(self.rfile.read(length))))
            except (ValueError, KeyError, TypeError) as error:
                self.reply(dict(error=str(error)), status=400)
            except OSError:
                self.reply(dict(error='No se pudo guardar en el laboratorio'), status=500)
    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lab', type=Path, default=HERE.parents[1] / 'lab')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    verovio.enableLog(False)
    server = HTTPServer(('127.0.0.1', args.port), handler(Library(args.lab.resolve())))
    print(f'Editor de folklore: http://127.0.0.1:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
