# OCR en Fargate, resto en Lambda

El reconocimiento óptico (Audiveris, Java, varios GB de memoria) corre en una tarea Fargate arm64 efímera; la preparación (digitación y preview) y la exportación (music21, Verovio, rsvg, fuente Leipzig) corren en una Lambda con imagen de contenedor arm64, sin Java. Step Functions orquesta ambas ramas.

## Por qué dos motores

- **Latencia de exportación.** Una sola imagen en Fargate obligaría a esperar el arranque de la tarea (decenas de segundos) en cada exportación y re-exportación. En Lambda tarda segundos.
- **Costo.** Fargate cobra por segundo de tarea; el OCR (~US$0,01 por PDF de 5 minutos) es lo único que lo necesita. Mantener Java fuera de la imagen de Lambda la deja liviana.
- **MusicXML nunca toca Fargate.** Las entradas MusicXML saltan el OCR y no pagan arranque ni cupo de OCR.
- **Una imagen más.** Hay que construir y desplegar dos imágenes; se acepta porque comparten el código del motor y solo difieren en dependencias.

## Consecuencias

- Concurrencia de OCR acotada a 2; el tercero recibe `busy`.
- Tiempo máximo de 15 minutos por Trabajo; si se cuelga, termina en `timeout`.
- Fargate en subred pública con IP pública solo durante la tarea, sin NAT ni balanceador.
