# Círculo de quintas — publicación

1. Ejecutar `npm run build:ext:fifths`. Cargar `dist/extensions/fifths/` desde `chrome://extensions` con el modo desarrollador activado.
2. Verificar el popup en ambos idiomas: tonalidades al pasar el cursor, fijar con clic, navegación con flechas y el enlace «Abrir en el sitio». La versión inicial es `0.1.0`.
3. Imágenes de la tienda: usar las de [screenshots/](screenshots/README.md) (capturas 1280 × 800, tile pequeño 440 × 280 y marquee 1400 × 560, en inglés y en `es/`). El icono de 128 × 128 es `dist/extensions/fifths/icons/icon-128.png`.
4. Crear una ficha independiente llamada **Circle of Fifths** (en español, **Círculo de quintas**) en Chrome Web Store. Usar [listing.md](listing.md), categoría Education, idiomas inglés y español, distribución gratuita.
5. Subir **`dist/extensions/fifths.zip`**. Los paquetes de Guitar Chords y Guitar Tabs y sus fichas siguen siendo independientes.
6. Declarar un único propósito: explorar el círculo de quintas y ver la armadura y los acordes diatónicos de cada tonalidad (en inglés: «Explore the circle of fifths: see each key's signature and diatonic chords.»). Sin permisos especiales, acceso a la página activa ni recopilación de datos; no guarda nada.
7. Usar la URL de privacidad compartida existente: `https://acordesdeguitarra.com.ar/store/privacy-policy.html`. Ejecutar y publicar el build del sitio para actualizar su contenido antes de enviar la ficha.

La publicación y la creación de la ficha pública requieren una acción manual del propietario; el build y CI solamente generan los paquetes.
