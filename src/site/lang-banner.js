/* lang-banner.js — Sugerencia de idioma en la primera visita al inicio en espanol.
   Solo del lado del cliente: no redirige ni cambia lo que ven los buscadores.
   Aceptar, descartar o elegir un idioma en el menu se recuerda y nunca se pisa.
   La logica de decision (suggestLanguage) es pura para poder testearla en Node. */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LangBanner = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'langChoice';
  const SUPPORTED = ['es', 'en', 'pt'];

  /* Idioma a sugerir segun los idiomas preferidos del navegador (en orden), o null.
     - sin preferencias: null (la pagina no cambia)
     - el primer idioma soportado (es, en, pt/pt-BR) manda
     - si ninguno es soportado, ingles
     - si coincide con el idioma de la pagina: null */
  function suggestLanguage(languages, pageLang) {
    const list = (languages || []).filter(Boolean).map(function (l) { return String(l).toLowerCase().split('-')[0]; });
    if (!list.length) return null;
    const preferred = list.find(function (l) { return SUPPORTED.indexOf(l) !== -1; }) || 'en';
    return preferred === pageLang ? null : preferred;
  }

  function readChoice() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveChoice(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* sin almacenamiento: se vuelve a ofrecer */ }
  }

  function banner(config, target) {
    const offer = config[target];
    const el = document.createElement('div');
    el.className = 'lang-banner';
    el.setAttribute('role', 'region');
    el.setAttribute('lang', offer.lang);
    el.setAttribute('aria-label', offer.text);
    const text = document.createElement('p');
    text.textContent = offer.text;
    const accept = document.createElement('a');
    accept.className = 'lang-banner-accept';
    accept.href = offer.href;
    accept.hreflang = offer.lang;
    accept.textContent = offer.accept;
    accept.addEventListener('click', function () { saveChoice(target); });
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'lang-banner-dismiss';
    dismiss.setAttribute('aria-label', offer.dismiss);
    dismiss.textContent = '×';
    dismiss.addEventListener('click', function () {
      saveChoice('dismissed');
      el.remove();
    });
    el.appendChild(text);
    el.appendChild(accept);
    el.appendChild(dismiss);
    return el;
  }

  function init() {
    const config = window.LANG_BANNER_CONFIG;
    if (!config || readChoice()) return;
    const languages = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
    const target = suggestLanguage(languages, document.documentElement.lang.split('-')[0]);
    if (!target || !config[target]) return;
    const show = function () {
      const header = document.querySelector('.site-header');
      const el = banner(config, target);
      if (header && header.parentNode) header.parentNode.insertBefore(el, header.nextSibling);
      else document.body.insertBefore(el, document.body.firstChild);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') init();

  return { suggestLanguage: suggestLanguage, STORAGE_KEY: STORAGE_KEY, SUPPORTED: SUPPORTED };
});
