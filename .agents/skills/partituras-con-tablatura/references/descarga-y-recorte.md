# Descargar y separar métodos de guitarra

## Fuentes y archivos editables

- **IMSLP:** una redirección con JavaScript o un control de acceso en la ficha no demuestra que todas las descargas
  por script fallen. En Sagreras y Aguado funcionaron enlaces públicos de archivos en
  `https://s9.imslp.org/files/imglnks/usimg/...`. Obtén la ruta de la ficha o de un enlace publicado, comprueba la
  respuesta y el archivo; si requiere autenticación, usa otra fuente pública o informa la limitación.
  La afirmación general de bloqueo en `docs/fuentes-de-partituras.md` refleja una prueba anterior.
- **TabGuitar:** consulta el [catálogo del editor](https://www.tabguitar.it/autori/aguado-metodi-e-studi/).
  Para el Nuevo método de Aguado se descargaron directamente 20 pares PDF/MSCZ que cubren 21 piezas.
  Busca los archivos que publica el transcriptor en su propio sitio además de su ficha de MuseScore.
  Descarga gratuita y licencia de redistribución son datos distintos: conserva los créditos y registra la licencia
  declarada para esa edición, o su ausencia, antes de decidir qué publicar.
- **Mutopia:** puede aportar fuentes LilyPond aunque solo cubra una pieza del libro. Su
  [Study in A Minor](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1833) identifica el ejercicio 10 de la
  sección segunda del método de Aguado, la edición usada y una corrección de digitación.
- Distingue obra, edición y cobertura: el Nuevo método de Aguado de 1843 es distinto de la Escuela de 1825 y de
  la Nouvelle méthode op. 6. Una selección de lecciones o una ficha con «otras versiones» no acredita una descarga
  completa en formato editable. Informa exactamente qué archivos se consiguieron y qué quedó solo en PDF.
- Verifica los bytes descargados antes de convertir: un estado HTTP correcto puede contener HTML. Abre los PDF
  y comprueba su paginación; en los MSCZ valida el ZIP y analiza el `.mscx` indicado por el contenedor.
  Esto comprueba integridad, no fidelidad musical: el cotejo con el libro sigue siendo necesario.
- Registra en `resources/<colección>/` la URL de la ficha y de cada archivo, edición, idioma, créditos, licencia,
  fecha de consulta y cobertura. Un manifiesto con SHA-256 permite identificar qué original se usó. Conserva
  intacto el libro completo y guarda los extractos aparte.

## Recortar PDF sin transcribir las notas

- Haz primero un mapa de la estructura del libro. Lecciones, ejercicios de cada mano, estudios y preludios pueden
  reiniciar su numeración; usa carpetas o prefijos distintos. Cuenta cada secuencia por separado.
- Mapea las páginas del PDF desde 1, además de la numeración impresa cuando haga falta. Un índice CSV debe indicar
  qué páginas fuente contiene cada extracto, incluidas las continuaciones y las láminas a las que remite el texto.
  Comprueba apéndices y páginas sin número: una lección puede depender de una lámina situada mucho después.
- `pdftotext -bbox-layout` ayuda a localizar títulos y párrafos; su capa OCR puede desplazar las coordenadas respecto
  de la imagen y confundir cifras (3/5, 13/15). Usa la secuencia impresa y la imagen para decidir los cortes.
  La presencia de texto extraíble no convierte un escaneo en un PDF musical vectorial ni en notación editable.
- Con `pypdf`, los recortes se expresan en puntos desde abajo; convierte las coordenadas medidas desde arriba usando
  las cajas de la página fuente. El recorte cambia el área visible: el contenido exterior puede seguir dentro del PDF.
- Separa por pieza cuando el diseño lo permita. Conserva juntas las piezas que comparten un pentagrama si separarlas
  compromete la lectura; indica el rango en el nombre y en el índice (Aguado: 22 preludios en tres páginas).
- Termina la generación antes de renderizar o calcular hashes. Renderiza la versión final en un directorio temporal
  nuevo para que las imágenes de una ejecución anterior no aparenten páginas que ya no existen.
- Revisa todas las páginas extraídas, incluidas continuaciones: título en el archivo correcto, notas y digitaciones
  completas, ausencia de fragmentos de la pieza vecina y de páginas vacías creadas por cortar antes de un encabezado.
  Las hojas de contacto ayudan a recorrer el conjunto; amplía los cortes dudosos sobre el original.

Un PDF recortado es un extracto del facsímil, no una transcripción a MusicXML. Entrega el índice y declara la cobertura
editable por separado. Los scripts específicos de una extracción pueden guardarse con los recursos locales;
la habilidad debe conservar los criterios reutilizables, no coordenadas de un libro concreto.
