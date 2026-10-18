'use strict';

// Choose the browser language once; the localized document uses the shared editor.
const locale = chrome.i18n.getUILanguage().toLowerCase().startsWith('es') ? 'es' : 'en';
location.replace(chrome.runtime.getURL('popup.' + locale + '.html'));
