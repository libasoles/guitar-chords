'use strict';

// Runs before the shared wheel script, which reads the document language
// to choose between solfège and letter note names.
const message = key => chrome.i18n.getMessage(key);
document.documentElement.lang = chrome.i18n.getUILanguage().toLowerCase().startsWith('es') ? 'es' : 'en';
document.title = message('appName');
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wordmark').textContent = message('appName');
  const link = document.getElementById('site-link');
  document.getElementById('site-link-label').textContent = message('siteLabel');
  link.href = message('siteUrl');
});
