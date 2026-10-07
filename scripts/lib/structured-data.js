'use strict';
/* structured-data.js — JSON-LD (schema.org) para la home y las guias.
   La home es una herramienta (WebApplication + WebSite); cada guia es
   contenido educativo (Article + BreadcrumbList); una pagina-herramienta
   (p. ej. el editor de tablaturas) es WebApplication + BreadcrumbList, y
   FAQPage si muestra preguntas frecuentes. Todo se deriva de los mismos
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
      breadcrumbs(opts),
    ],
  };
}

function breadcrumbs(opts) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: opts.siteName, item: opts.homeUrl },
      { '@type': 'ListItem', position: 2, name: opts.name, item: opts.url },
    ],
  };
}

const stripTags = (html) => html.replace(/<[^>]+>/g, '');

/* opts.faq: [{ q, a }] con el mismo texto (HTML) que se ve en la pagina. */
function toolJsonLd(opts) {
  const graph = [
    {
      '@type': 'WebApplication',
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
      publisher: publisher(opts),
    },
    breadcrumbs(opts),
  ];
  if (opts.faq && opts.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: opts.faq.map((item) => ({
        '@type': 'Question',
        name: stripTags(item.q),
        acceptedAnswer: { '@type': 'Answer', text: stripTags(item.a) },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function toScriptTag(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return '<script type="application/ld+json">' + json + '</script>';
}

function injectJsonLd(html, data) {
  return html.replace('</head>', '    ' + toScriptTag(data) + '\n  </head>');
}

module.exports = { homeJsonLd, guideJsonLd, toolJsonLd, toScriptTag, injectJsonLd };
