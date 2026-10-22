# Valses del Op. 59 de Carcassi

Página `/articulos/valses-de-carcassi`: los valses de la Tercera parte del *Método completo para guitarra*, Op. 59
(numeración del libro, ver `resources/Libro Carcassi - Metodo.pdf`, pdf 87+). Carcassi murió en 1853: la obra es de
dominio público.

## Fuente

Los PDF de `resources/carcassi-op59-youtube/` (carpeta no versionada, de solo lectura) vienen de las descripciones de la
lista de reproducción «Carcassi Op. 59» del canal Guitar Notes en YouTube: exportaciones de MuseScore 4 con la fuente
Leland. Son vectoriales, así que las notas se leen de la geometría del PDF sin OCR (`pdf_notes.py`) y se cotejan con el
libro. El libro escaneado de Ditson 1853 (Internet Archive) es la referencia impresa.
IMSLP bloquea la descarga por script; Mutopia solo tiene los preludios del Op. 59.

## Reproducir

```sh
.venv-carcassi/bin/python scripts/carcassi-valses/transcribe_valses.py 2   # corrected/waltz-02.musicxml
.venv-carcassi/bin/python scripts/carcassi-valses/build.py 2               # PDF, MusicXML y SVG con TAB
```

Requiere `pymupdf` además de lo que pide `carcassi-preludios/README.md`. El PDF y el MusicXML publicados salen del
motor (`backend/engine/tabify.py`); la TAB es una propuesta del motor con detección de arpegios por compás
(`arpeggio="auto"`). Las melodías por grados conjuntos conservan las cuerdas
que elige el Viterbi; no se les aplica la penalización de repetir cuerda de los
arpegios. Ver `docs/criterios-de-digitacion.md`, §8.1.
Un tiempo = una semicorchea. Los compases de anacrusa y de cierre suman juntos un compás completo.

## Correcciones cotejadas

Vals 2, compás 17 (18 contando la anacrusa): acorde sol3–sol4–re5 de negra,
seguido de re♯5 de corchea, sin superposición. La plica descendente de la
corchea se había interpretado como otra voz al inicio del compás, produciendo
la posición imposible `x475x3`. Se cotejó con Ditson, página impresa 77, y
con `op59-02.pdf`. La corrección se conserva también en `convert(2)`.
