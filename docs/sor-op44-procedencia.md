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

La página incluye las piezas **1 a 4 y 6 a 10**.
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

### N.º 4: Allegretto moderato en Do mayor

25 compases escritos, más la anacrusa de corchea, en 2/4. Transcripción de #837753, p. 3, cotejada
con #470296, p. 5. La primera repetición retoma el compás 1 tras el Sol que cierra el 8. La segunda
lleva dos casillas y termina con un compás de 3/8 que completa la anacrusa. Se conservan la ligadura de
prolongación del compás 15, las dos articulaciones de staccato y la voz interior del compás 10.
Se consultó la [transcripción de Weed](https://www.wussu.com/guitar/sor_op44_24_pieces_progressives_no04_allegretto_moderato_in_c.txt)
para confirmar la lectura del Sol con puntillo del compás 9 y el inicio de la repetición. La TAB se genera
a partir de la transcripción del facsímil en afinación estándar. En el compás 8, el Sol sostenido se
asigna a la cuarta cuerda para poder volver a atacar esa altura en la tercera.

### N.º 6: Moderato en Sol mayor

32 compases y anacrusa de negra en 3/4. Fuente #837753, p. 4, cotejada con #470296, p. 7.
Se conservan los bajos y notas con plicas independientes, las alteraciones de paso y el silencio de negra
que precede a la repetición final. La TAB se genera en afinación estándar. Se consultó la
[transcripción de Weed](https://www.wussu.com/guitar/sor_op44_24_pieces_progressives_no06_moderato_in_g.txt)
para contrastar las alturas de los pasajes con líneas adicionales y las notas sostenidas.

### N.º 7: Andante Allegro en Sol mayor

20 compases escritos y dos anacrusas de corchea en 2/4. Fuente #837753, p. 5, cotejada con
#470296, p. 8. Se conservan las dos repeticiones, las figuras con puntillo y las dos ligaduras del
compás 7: la de prolongación entre los dos Re y la de expresión del segundo Re al Do sostenido.
La TAB se genera en afinación estándar. Se consultó la
[transcripción de Weed](https://www.wussu.com/guitar/sor_op44_24_pieces_progressives_no07_andante_allegro_in_g.txt)
como referencia adicional de alturas.

### N.º 8: Allegretto en Sol mayor

48 compases en 2/4. Transcripción de #837753, p. 5, cotejada con #470296, p. 9.
Se mantienen las dos voces, las alteraciones de paso y el staccato en los pasajes de corcheas.
Como comprobación adicional de alturas se consultó la [transcripción de Weed](https://www.wussu.com/guitar/sor_op44_24_pieces_progressives_no08_allegretto_in_g.txt).

### N.º 9: Andantino en Sol mayor

18 compases escritos en compás común. Transcripción de #837753, p. 6, cotejada con #470296, p. 10.
Se conservan las dos parejas de casillas de repetición, la ligadura del Sol de los compases 1 y 2,
las voces intermedias y las alteraciones de paso. Se consultó la [transcripción de Weed](https://www.wussu.com/guitar/sor_op44_24_pieces_progressives_no09_andantino_in_g_wd.txt)
como referencia adicional de alturas.

### N.º 10: Allegretto en Sol mayor

26 compases escritos y tres anacrusas en 6/8. Transcripción de #837753, p. 6, cotejada con #470296, p. 11.
Se conservan las dos repeticiones, las notas de adorno, el Sol ligado y el ligado de Si a Sol.
Se consultó la [transcripción de Weed](https://www.wussu.com/guitar/sor_op44_24_pieces_progressives_no10_allegretto_in_g.txt)
como referencia adicional de alturas.

### N.º 11: Andante en Mi menor

16 compases en compás común. Transcripción de #837753, p. 6, cotejada con #470296, p. 12.
Se conservan las dos repeticiones, las ligaduras de expresión y la prolongación del Si entre
los compases 10 y 11. El Re sostenido y el Fa sostenido del compás 13 se mantienen en la
tablatura. Se consultó la [transcripción de Weed](https://www.classtab.org/sor_op44_24_pieces_progressives_no11_andante_in_em.txt)
como referencia adicional de alturas.

## Verificación

Pruebas de conversión y compases; artefactos, metadatos y licencias por pieza; página, índice,
descargas y navegación del visor en español, inglés y portugués. Las imágenes de revisión permanecen
fuera del repositorio. La obra original completa se conserva para continuar la colección.
