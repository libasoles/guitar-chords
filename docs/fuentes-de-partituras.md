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
