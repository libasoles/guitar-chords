'use strict';
/* structured-data.js — JSON-LD (schema.org) para la home y las guias.
   La home es una herramienta (WebApplication + WebSite); cada guia es
   contenido educativo (Article + BreadcrumbList). Todo se deriva de los mismos
   valores que alimentan canonical, hreflang y meta description, para que los
   datos estructurados coincidan con lo que la pagina muestra. */

function publisher(opts) {
  return { '@type': 'Organization', name: opts.siteName, url: opts.baseUrl + '/' };
}

function homeJsonLd(opts) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': opts.homeUrl + '#website',
        name: opts.siteName,
        url: opts.homeUrl,
        inLanguage: opts.locale,
      },
      {
        '@type': 'WebApplication',
        '@id': opts.homeUrl + '#app',
        name: opts.name,
        description: opts.description,
        url: opts.url,
        inLanguage: opts.locale,
        applicationCategory: 'MusicApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        image: opts.ogImage,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isPartOf: { '@id': opts.homeUrl + '#website' },
      },
    ],
  };
}

function guideJsonLd(opts) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: opts.name,
        description: opts.description,
        url: opts.url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
        inLanguage: opts.locale,
        image: opts.ogImage,
        learningResourceType: 'guide',
        author: publisher(opts),
        publisher: publisher(opts),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: opts.siteName, item: opts.homeUrl },
          { '@type': 'ListItem', position: 2, name: opts.name, item: opts.url },
        ],
      },
    ],
  };
}

function toScriptTag(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return '<script type="application/ld+json">' + json + '</script>';
}

function injectJsonLd(html, data) {
  return html.replace('</head>', '    ' + toScriptTag(data) + '\n  </head>');
}

module.exports = { homeJsonLd, guideJsonLd, toScriptTag, injectJsonLd };
