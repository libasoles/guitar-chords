'use strict';

const LINK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-2 preview-icon" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>';

// Decorate plain text links in trusted article HTML. Cards, downloads and
// modal controls already have their own classes and presentation.
function renderArticleLinks(html) {
  return html.replace(/<a\b([^>]*)>/g, function (tag, attributes) {
    if (!/\bhref=/.test(attributes) || /\b(?:class|download)=|\bdownload(?:\s|$)/.test(attributes)) return tag;
    return '<a class="article-link"' + attributes + '>' + LINK_ICON;
  });
}

module.exports = { renderArticleLinks };
