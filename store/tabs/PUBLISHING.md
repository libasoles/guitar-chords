# Guitar Tabs — publicación

1. Ejecutar `npm run build:ext:tabs`. Cargar `dist/extensions/tabs/` desde `chrome://extensions` con el modo desarrollador activado.
2. Verificar edición, copiar/pegar, cierre y reapertura, tutorial y ambos idiomas. La versión inicial es `0.1.0`.
3. Preparar capturas propias según [screenshots/README.md](screenshots/README.md). Usar el icono de tablatura de `dist/extensions/tabs/icons/icon-128.png`.
4. Crear una ficha independiente llamada **Guitar Tabs** en Chrome Web Store. Usar [listing.md](listing.md), categoría Productivity, idiomas inglés y español, distribución gratuita.
5. Subir **`dist/extensions/tabs.zip`**. El paquete de Guitar Chords y su ficha siguen siendo independientes.
6. Declarar un único propósito: bosquejar tablaturas de guitarra y copiarlas para pegarlas donde quieras (en inglés: «Draft guitar tablature ideas and copy them as plain text to paste anywhere.»). El mismo texto está en la descripción del manifiesto, de donde la tienda lo toma. Sin permisos especiales, acceso a la página activa ni recopilación de datos. El almacenamiento es local al perfil; no hay cuentas ni sincronización.
7. Usar la URL de privacidad compartida existente: `https://acordesdeguitarra.com.ar/store/privacy-policy.html`. Ejecutar y publicar el build del sitio para actualizar su contenido antes de enviar la ficha.

La publicación y la creación de la ficha pública requieren una acción manual del propietario; el build y CI solamente generan los paquetes.
