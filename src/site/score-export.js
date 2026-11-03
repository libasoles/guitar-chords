(function () {
  /* score-export.js — Cargar y exportar partituras (MusicXML, MIDI, PDF). Se baja la primera vez que se usa el menu del sitio,
     no con el editor: nadie descarga ni importa antes de haber escrito algo. */

  // editor lo arma score-editor.js: el estado vivo del editor (la partitura activa, el modelo, Verovio) sin compartir sus variables.
  window.createScoreExporter = function createExporter(editor) {
    const { M, t, say } = editor;
    const ScoreIO = window.ScoreIO;

    function download(blob, name) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function downloadFilename(exportScore, extension) {
      const filenameTitle = exportScore.title.trim() || 'partitura';
      const filenameAuthor = (exportScore.author || '').trim();
      return filenameTitle + (filenameAuthor ? ' - ' + filenameAuthor : '') + '.' + extension;
    }

    function exportMusicXml() {
      download(new Blob([M.toMusicXml(editor.score())], { type: 'application/vnd.recordare.musicxml+xml' }), downloadFilename(editor.score(), 'musicxml'));
    }

    function exportMidi() {
      download(new Blob([ScoreIO.toMidi(editor.score(), M)], { type: 'audio/midi' }), downloadFilename(editor.score(), 'mid'));
    }


    // Una partitura cargada se abre en una pestana nueva, sin tocar la actual.
    async function loadFile(file) {
      try {
        const midi = /\.midi?$/i.test(file.name);
        const loaded = midi ? ScoreIO.parseMidi(await file.arrayBuffer(), M) : ScoreIO.parseMusicXml(await file.text(), M);
        if (typeof loaded.title !== 'string' || !loaded.title) loaded.title = file.name.replace(/\.[^.]+$/, '') || editor.defaultTitle;
        editor.openScore(loaded);
        say(t.importDone);
      } catch (e) {
        say(t.importFailed);
      }
    }

    // Verovio numera el primer compas de cada renglon; en una partitura de uso personal sobran.
    function withoutMeasureNumbers(markup) {
      const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
      doc.querySelectorAll('g.mNum').forEach((node) => node.remove());
      return new XMLSerializer().serializeToString(doc);
    }

    // Draw TAB in the export SVG, using the PDF's own note positions (not the
    // responsive editor geometry). The extra layout spacing keeps it on its page.
    function pdfPageSvg(markup, exportScore, columns) {
      if (!exportScore.showTabs) return withoutMeasureNumbers(markup);
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden';
      host.innerHTML = markup;
      document.body.appendChild(host);
      try {
        const svg = host.querySelector('svg');
        svg.querySelectorAll('g.mNum').forEach((node) => node.remove());
        const ns = 'http://www.w3.org/2000/svg';
        const attacks = M.attacks(exportScore);
        svg.querySelectorAll('g.system').forEach((system) => {
          const measures = [...system.querySelectorAll('g.measure')];
          const first = measures[0]?.querySelector('g.staff > path');
          const last = measures[measures.length - 1]?.querySelector('g.staff > path');
          if (!first || !last) return;
          const staffLines = [...measures[0].querySelectorAll('g.staff > path')].slice(0, 5);
          const top = staffLines[0].getBBox().y;
          const bottom = staffLines[4].getBBox().y;
          const space = (bottom - top) / 4;
          const left = first.getBBox().x;
          const right = last.getBBox().x + last.getBBox().width;
          const content = system.getBBox();
          // Frets extend half a font above their string; leave a staff space clear.
          const y = Math.max(bottom + space * 3.5, content.y + content.height + space * 2);
          const step = space * 2.2;
          const font = space * 2;
          const group = document.createElementNS(ns, 'g');
          group.setAttribute('class', 'pdf-tab');
          function add(tag, attrs, text) {
            const node = document.createElementNS(ns, tag);
            Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
            if (text !== undefined) node.textContent = text;
            group.appendChild(node);
          }
          for (let string = 0; string < 6; string += 1) {
            add('line', { x1: left, x2: right, y1: y + step * string, y2: y + step * string, stroke: '#000', 'stroke-width': 12 });
          }
          add('line', { x1: left, x2: left, y1: top, y2: y + 5 * step, stroke: '#000', 'stroke-width': 18 });
          measures.forEach((measure) => {
            const line = measure.querySelector('g.staff > path').getBBox();
            add('line', { x1: line.x + line.width, x2: line.x + line.width, y1: y, y2: y + step * 5, stroke: '#000', 'stroke-width': 18 });
            const mi = Number(measure.id.slice(1));
            attacks.filter(attack => attack.mi === mi).forEach((attack) => {
              const events = M.measures(exportScore)[mi];
              const onsets = M.onsets(events);
              const heads = events.flatMap((event, i) => {
                const node = measure.querySelector('[id="e' + mi + '-' + i + '"] .notehead');
                return !event.rest && onsets[i] === attack.at && node ? [node] : [];
              });
              if (!heads.length) return;
              const x = heads.reduce((sum, head) => {
                const box = head.getBBox();
                const point = svg.createSVGPoint();
                point.x = box.x + box.width / 2;
                return sum + point.matrixTransform(system.getCTM().inverse().multiply(head.getCTM())).x;
              }, 0) / heads.length;
              (columns[attack.key] || []).forEach((fret, string) => {
                if (!Number.isInteger(fret)) return;
                add('text', { x, y: y + step * string, 'font-family': 'Montserrat Variable, Arial, sans-serif', 'font-size': font,
                  'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#000', stroke: '#fff',
                  'stroke-width': font * 0.18, 'paint-order': 'stroke' }, String(fret));
              });
            });
          });
          const clef = system.querySelector('g.clef');
          const clefBox = clef?.getBBox();
          const clefX = clefBox ? clefBox.x + clefBox.width / 2 : left + space;
          if (Number(measures[0].id.slice(1)) === 0) M.tuningLabels(exportScore).forEach((label, string) =>
            add('text', { x: left - font * 0.3, y: y + step * string,
              'font-family': 'Arial, sans-serif', 'font-size': font * 0.8, 'text-anchor': 'end',
              'dominant-baseline': 'central', fill: '#000', stroke: '#fff',
              'stroke-width': font * 0.18, 'paint-order': 'stroke' }, label));
          'TAB'.split('').forEach((letter, i) => add('text', { x: clefX, y: y + step * (1.5 + i),
            'font-family': 'Montserrat Variable, Arial, sans-serif', 'font-size': font, 'font-weight': 'bold',
            'text-anchor': 'middle', 'dominant-baseline': 'central' }, letter));
          system.appendChild(group);
        });
        return new XMLSerializer().serializeToString(svg);
      } finally {
        host.remove();
      }
    }

    function rasterize(svgMarkup, pixelWidth, pixelHeight) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml' }));
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          const g = canvas.getContext('2d');
          g.fillStyle = '#fff';
          g.fillRect(0, 0, pixelWidth, pixelHeight);
          g.drawImage(img, 0, 0, pixelWidth, pixelHeight);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('rasterize failed')); };
        img.src = url;
      });
    }

    async function exportPdf(button) {
      button.disabled = true;
      try {
        if (!(window.jspdf && window.jspdf.jsPDF)) await editor.loadScript(editor.vendorUrl('jspdf.umd.min.js'));
        // A4 a 200 ppp. El ancho de pagina esta en unidades de Verovio (como en pantalla) para que el pentagrama
        // conserve su proporcion; el alto sigue la relacion de A4 y se rasteriza a 1654 x 2339.
        const exportScore = JSON.parse(JSON.stringify(editor.score()));
        const attacks = M.attacks(exportScore);
        const fingered = window.ScoreFingering.assign(attacks.map(attack => attack.midis), M.tuningOf(exportScore).opens);
        const columns = Object.assign(Object.fromEntries(attacks.map((attack, i) =>
          [attack.key, window.ScoreFingering.toColumn(fingered[i])])), exportScore.tabs);
        const pdfWidth = 2400;
        const pdfToolkit = editor.newToolkit();
        pdfToolkit.setOptions({
          scale: editor.SCALE,
          pageWidth: pdfWidth,
          pageHeight: Math.round(pdfWidth * 297 / 210),
          adjustPageHeight: false,
          breaks: exportScore.showTabs ? 'line' : 'encoded',
          header: 'none',
          footer: 'none',
          svgViewBox: true,
          pageMarginLeft: 100,
          pageMarginRight: 100,
          pageMarginTop: exportScore.title || exportScore.author ? 230 : 150,
          pageMarginBottom: exportScore.showTabs ? 450 : 150,
          ...(exportScore.showTabs ? { spacingSystem: 48 } : {}),
          justifyVertically: false,
          minLastJustification: 0,
          mnumInterval: 0,
        });
        pdfToolkit.loadData(M.toMusicXml(exportScore));
        const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
        for (let page = 1; page <= pdfToolkit.getPageCount(); page += 1) {
          const image = await rasterize(pdfPageSvg(pdfToolkit.renderToSVG(page), exportScore, columns), 1654, 2339);
          if (page > 1) pdf.addPage();
          pdf.addImage(image, 'JPEG', 0, 0, 210, 297);
          if (page === 1 && exportScore.author) {
            pdf.setFont('times', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(120);
            pdf.text(exportScore.author, 201.25, 10, { align: 'right' });
            pdf.setTextColor(0);
          }
          if (page === 1 && exportScore.title) {
            pdf.setFont('times', 'bold');
            pdf.setFontSize(18);
            pdf.setFontSize(Math.min(18, 18 * 192 / pdf.getTextWidth(exportScore.title)));
            pdf.text(exportScore.title, 8.75, 15);
          }
        }
        pdf.save(downloadFilename(exportScore, 'pdf'));
      } catch (e) {
        say(t.pdfError);
      } finally {
        button.disabled = false;
      }
    }

    return { exportMusicXml, exportMidi, loadFile, exportPdf };
  }

})();
