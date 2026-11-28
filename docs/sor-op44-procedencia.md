# Sor, Op. 44: procedencia y piezas publicadas

Descarga: 27 de noviembre de 2026. Originales intactos en `resources/sor-op44/` (sin versionar).
La página es independiente del Op. 60 y corresponde a las **24 petites pièces progressives** para guitarra sola,
no a los seis valses para dos guitarras del Op. 44 bis.

## Fuentes

La [ficha de IMSLP](https://imslp.org/wiki/24_Petites_pi%C3%A8ces_progressives,_Op.44_(Sor,_Fernando))
identifica 24 piezas, primera publicación en París en 1831, dedicadas a Rolando.

- `imslp/IMSLP837753.pdf`: París, chez l’auteur et Pacini; dominio público; fuente principal. [Descarga](https://s9.imslp.org/files/imglnks/usimg/b/be/IMSLP837753-PMLP736835-Sor_F-24_Petites_pieces_Op44.pdf).
  SHA-256: `8aaa6c718a944630aa7a1be68abddd79f0227dc28cda14e0781d87ebdbfcfa48`.
  PDF abierto y decodificado: 13 páginas.
- `imslp/IMSLP470296.pdf`: París, l’Editeur et Auteur; dominio público; cotejo. El archivo incluye material adicional tras las 24 piezas. [Descarga](https://s9.imslp.org/files/imglnks/usimg/3/3f/IMSLP470296-PMLP736835-Sor_op.44.pdf).
  SHA-256: `e5f80a3d018e0dec9aba8ad46739179138990f624a8573d015b5114b5baf7764`.
  PDF abierto y decodificado: 53 páginas.
- `mutopia/guitar-skole-no-03-lys.zip`: Louie van Bommel, Mutopia-2009/06/08-1657, CC BY 3.0; Op. 44 n.º 2 en Guitar-Skole de A. Eggers. [Descarga](https://www.mutopiaproject.org/ftp/SorF/guitar-skole-no-03/guitar-skole-no-03-lys.zip).
  SHA-256: `3dfb5ce43af9d4f9bcbbc7b17e3b0ccc69787d3a444b43d919f30bc31d694638`.

## Publicación

La página incluye las piezas **1 a 3**.
Cada incorporación tiene su propio commit con fuente, MusicXML, PDF, vista previa y páginas del visor.
El catálogo `scripts/sor/opus44.json` usa claves 4401, 4402…; `n` conserva el número impreso.
Se generan mediante `scripts/sor/build.py opus44 convert 4401` y `scripts/sor/build.py opus44 4401`.

### N.º 1: Andante en Do mayor

33 compases contando la anacrusa de negra. Fuente #837753, p. 2; cotejo con #470296, p. 2.
Se mantienen los bajos y las plicas independientes desde el compás 13, los acordes y la pequeña nota
Do de adorno antes del acorde final. No se añaden dedos de mano izquierda ni mano derecha.
PDF de una página y visor cotejados; TAB comprobada sin interrupciones de voces sostenidas.

Como ayuda de lectura se consultó el PDF moderno de Classical Guitar Shed
([referencia](https://classicalguitarshed.com/wp-content/uploads/2024/09/AAA-Fernando-Sor-Etude-no1-ClassicalGuitarShed.pdf),
`cgs-reading-reference.pdf`, solo local). No se reproduce su tipografía, TAB, digitación, marcas de estudio
ni simplificaciones de la notación; decide el impreso de Sor. La consulta de la guía de la Universidad
de Chihuahua no produjo una descarga utilizable y no se usa como fuente.

### N.º 2: Allegretto en Do mayor

32 compases, 2/4. Fuente editable de Louie van Bommel en Mutopia, CC BY 3.0 (no BY-SA).
Se conservan el original descargado y su atribución. Se coteja con #837753, p. 2, y #470296, p. 3.
Se restituye «Allegretto» frente al «Moderato» con metrónomo de Eggers; se omiten sus dedos y acentos.
El Do bajo entre 11 y 12 permanece ligado como en París. Dos voces independientes; sin fusión por
coincidencia rítmica. PDF de una página y visor revisados; TAB sin conflictos de cuerdas sostenidas.

### N.º 3: Andantino en Do mayor

40 compases, 3/4. Transcripción de #837753, p. 3, cotejada con #470296, p. 4.
Las dos voces conservan sus duraciones independientes y el Sol agudo se liga entre los compases 21 y 22.
La TAB se genera en afinación estándar, sin trasladar los números de dedo del impreso.

## Verificación

Pruebas de conversión y compases; artefactos, metadatos y licencias por pieza; página, índice,
descargas y navegación del visor en español, inglés y portugués. Las imágenes de revisión permanecen
fuera del repositorio. La obra original completa se conserva para continuar la colección.
