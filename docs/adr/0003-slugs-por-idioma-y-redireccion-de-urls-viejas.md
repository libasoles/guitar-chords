# Slugs por idioma y redirección de las URL inglesas antiguas

Cada página registra un slug en español y otro en inglés (`/slug` y `/en/slug`), desde un único registro que alimenta enlaces internos, `hreflang` y sitemap. Toda página nueva debe registrar su slug inglés. Las páginas inglesas que existían con slug español dejan un HTML mínimo (`canonical` a la URL nueva, `meta refresh` y `noindex`) hasta que haya un ruteador; esas rutas no entran al sitemap. Las páginas nuevas no llevan redirección.

## Alternativas descartadas

- **Duplicar archivos por idioma.** Más mantenimiento y riesgo de divergencia; las plantillas ya se renderizan por idioma.
- **Slug español en `/en/`.** Es lo que había; perjudica el SEO en inglés.

## Consecuencias

- El hosting es estático (GitHub Pages): sin redirecciones de servidor, por eso los HTML de redirección.
- Las claves del `lastmod` del sitemap se migran para que las URL renombradas no figuren como modificadas hoy.
