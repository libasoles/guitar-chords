# Fuentes confiables de partituras

Dónde buscar y bajar partituras de dominio público (guitarra clásica) y qué se comprobó de cada una. Todo lo que se
use como original va copiado en `resources/` (carpeta no versionada) para poder revisar después.

## Probadas

| Fuente | Qué da | Descarga por script | Notas |
|---|---|---|---|
| [Internet Archive](https://archive.org) | Escaneos de ediciones antiguas. Ej.: [Ditson 1853](https://archive.org/details/newimprovedmeth00carc) del método de Carcassi, Op. 59 (140 págs.) | Sí: `https://archive.org/download/<id>/<id>.pdf`. A veces responde 503: reintentar | Es el mismo escaneo de IMSLP (Boston Public Library). Ya está en `resources/Libro Carcassi - Metodo.pdf` |
| [Mutopia Project](https://www.mutopiaproject.org) | Partituras en LilyPond (`.ly`), PDF y MIDI, con licencia clara | Sí | Del Op. 59 de Carcassi solo tiene los preludios (edición Santisteban 1906). Hay Op. 1 y Op. 26 |
| [IMSLP](https://imslp.org) | La mayor colección de escaneos y de ediciones tipografiadas. Op. 59 en [su ficha](https://imslp.org/wiki/M%C3%A9thode_compl%C3%A8te_pour_la_guitare,_Op.59_(Carcassi,_Matteo)): Schott (104 págs.), Ditson 1853 (140), Jacobs 1896 (46) | **No**: una redirección con JavaScript bloquea `curl`. Hay que bajar a mano desde el navegador | Sirve para ver qué ediciones existen y su numeración |
| [Classclef](https://www.classclef.com/matteo-carcassi/) | PDF, GPX (Guitar Pro) y MIDI por pieza, con TAB. Op. 59 Nos. 1–39 y 46–47 | Sí (URLs en la página) | Sin licencia declarada: tratar como referencia, no como fuente de publicación |
| Lista «Carcassi Op. 59» del canal Guitar Notes (YouTube) | PDF con TAB, exportados de MuseScore 4, de los Nos. 1–36. El segundo link de cada descripción es el MuseScore | PDF sí; MuseScore no se bajó | Vectoriales: las notas se leen sin OCR (ver la skill `partituras-con-tablatura`). Están en `resources/carcassi-op59-youtube/` |
| [This Is Classical Guitar](https://www.thisisclassicalguitar.com/matteo-carcassi-free-sheet-music-pdf/) | PDF con digitación y video | Sí | Ediciones con copyright del sitio (Bradford Werner): no redistribuir |
| [Classical Guitar Library](https://www.cglib.org/composers/) | PDF, licencia CC BY-SA 4.0 | Sí | Carcassi: Op. 5, Op. 60 y otros, sin el Op. 59 |
| [Mutopia · Sor](https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=SorF) | LilyPond, PDF y MIDI de Sor: Op. 60 (13 de 25 lecciones), Op. 35 (23 de 24), Op. 6 (12), Op. 29 n.º 13. CC BY-SA 2.5/3.0/4.0 según la pieza | Sí: `https://sca.uwaterloo.ca/Mutopia/ftp/SorF/O60/sor_op60-01/sor_op60-01.ly` | Sin LilyPond instalado: `scripts/sor/ly_to_musicxml.py` lee el `.ly`. El MIDI sirve para comprobar notas y posiciones, no octavas |
| [IMSLP · Sor, Op. 60](https://imslp.org/wiki/Introduction_%C3%A0_l%27%C3%A9tude_de_la_guitare,_Op.60_(Sor,_Fernando)) | Solo PDF (escaneos de dominio público: Gitarrefreund Múnich 1915-17, París) | No: la descarga tiene captcha | Las 12 lecciones que Mutopia no tiene (14 a 25) se transcriben a mano; ver `scripts/sor/README.md` |
| [IMSLP · Sor, Méthode (1830)](https://imslp.org/wiki/M%C3%A9thode_compl%C3%A8te_pour_la_guitare_(Sor,_Fernando)) | Escaneos del método de 1830 (94 págs) y sus «Exemples et figures» (62) | Sí, por `https://s9.imslp.org/files/imglnks/usimg/8/83/IMSLP246100-PMLP58779-Sor_Methode.pdf` (la ruta `/images/` da una página de bot-check) | Difusos, sin formato editable y casi todo son ejemplos cortos y arreglos de ópera, no piezas: descartado como fuente de piezas |
| [IMSLP · Sagreras, libro 1](https://imslp.org/wiki/Las_lecciones_de_guitarra_(Sagreras,_Julio_Salvador)) | Transcripción de Marieh (2020, CC BY-NC 4.0, IMSLP610099): PDF vectorial de MuseScore 2/3 con TAB, lecciones 1–86 | Sí: `https://s9.imslp.org/files/imglnks/usimg/1/19/IMSLP610099-PMLP417963-Sagreras_First_Lessons_for_Guitar_Book1.pdf` | Se leen las notas sin OCR (`scripts/sagreras/`) y se cotejan con la TAB impresa. Originales en `resources/sagreras/` |
| [IMSLP · Barrios Mangoré](https://imslp.org/wiki/Category:Barrios_Mangor%C3%A9,_Agust%C3%ADn) | Ediciones de Stefan Apke (2015–2019, CC BY-SA 4.0): PDF vectoriales de MuseScore 2, sin TAB, con dedos, cuerdas y posiciones. Estudios, minuetos y preludios | Sí, pero `/images/...` da un bot-check: `https://s9.imslp.org/files/imglnks/usimg/<a>/<ab>/IMSLP<id>-PMLP<obra>-<archivo>` (el `<id>` sale del enlace `Special:ImagefromIndex/<id>` de cada edición) | Fuente `MScore` con códigos propios de MuseScore 2.1 (ver `scripts/barrios/README.md`). Algunas piezas llevan dos guitarras (Estudio en Si menor) o casillas, cambios de tono y armónicos. Originales en `resources/barrios/imslp/` |
| [IMSLP · Giuliani, 24 Esercizi Op. 48](https://imslp.org/wiki/24_Etudes,_Op.48_(Giuliani,_Mauro)) | Edición de Stefan Apke (2026, CC BY-SA 4.0): PDF vectorial de MuseScore 2.2 con los 24 estudios, sin TAB, con dedos y ligados | Sí: `https://s9.imslp.org/files/imglnks/usimg/1/1c/IMSLP1038590-PMLP58657-Giuliani_M-24_Etudes_Op48+mid.pdf` | Mismo lector que Barrios más `scripts/giuliani/slurs.py` (ligados) y `fingers.py` (dedos). Original en `resources/giuliani-op48/` |
| [IMSLP · Giuliani, Op. 1](https://imslp.org/wiki/Studio_per_la_chitarra,_Op.1_(Giuliani,_Mauro)) | «Degli arpeggi» (#660049): los 120 ejercicios de mano derecha, edición de Marieh (2020, **CC0 1.0**), PDF vectorial de MuseScore 3.4.2 con TAB, sin tresillos impresos | Sí: `https://s9.imslp.org/files/imglnks/usimg/c/ca/IMSLP660049-PMLP58675-Giuliani_Op.1_Parte_1_tab.pdf` | Misma transcriptora y programa que Sagreras: se lee con `scripts/sagreras/` (ver `scripts/giuliani-arpegios/README.md`). El Op. 1 de Mutopia es otra sección (estudios, no los arpegios). Original en `resources/giuliani-arpegios/` |
| [Portal Guaraní · Barrios](https://portalguarani.com/891_agustin_pio_mangore_barrios/14136_agustin_pio_barrios__partituras_para_guitarra__music_for_guitar.html) y [Classical Guitar Shed](https://classicalguitarshed.com/sm-agustin-barrios-sheet-music/) | Índices de PDF sueltos de Barrios | No se usaron | Remiten a escaneos y a las mismas ediciones; IMSLP trae vectoriales con licencia clara |

## Por probar

- [Free-scores.com](https://www.free-scores.com): transcripciones de usuarios, con y sin TAB. No se encontró el Op. 59 en una búsqueda.
- [MuseScore.com](https://musescore.com): transcripciones de usuarios; requiere sesión.
- Classical Guitar Shed, Classical Guitar Corner: PDF del método completo (por revisar).

## Criterios

1. **Dominio público.** Carcassi murió en 1853. Una edición moderna (digitación, TAB, tipografía) tiene su propio copyright:
   aprovechar las notas, no copiar la edición.
2. **Preferir lo vectorial a lo escaneado.** Un PDF vectorial (MuseScore, LilyPond, Finale) se lee con exactitud; un
   escaneo antiguo no se lee bien ni a ojo ni con OCR.
3. **Guardar el original.** Copia en `resources/`, con una nota de dónde salió. No se versiona (`.gitignore`).
4. **Cotejar con el impreso.** Orden, compás, armadura, estructura (repeticiones, Fine, D.C.) y notas contra el libro.
