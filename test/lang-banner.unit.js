/* Decision de la sugerencia de idioma. Run: node --test test/lang-banner.unit.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestLanguage } = require('../src/site/lang-banner.js');

test('navegador en pt-BR o en: sugiere esa version desde el inicio en espanol', () => {
  assert.equal(suggestLanguage(['pt-BR'], 'es'), 'pt');
  assert.equal(suggestLanguage(['pt'], 'es'), 'pt');
  assert.equal(suggestLanguage(['en-US'], 'es'), 'en');
});

test('con varios idiomas manda el primero soportado', () => {
  assert.equal(suggestLanguage(['fr', 'pt-BR', 'en'], 'es'), 'pt');
  assert.equal(suggestLanguage(['de-DE', 'en-GB', 'es'], 'es'), 'en');
});

test('un idioma no soportado sugiere ingles', () => {
  assert.equal(suggestLanguage(['fr-FR'], 'es'), 'en');
  assert.equal(suggestLanguage(['ja', 'de'], 'es'), 'en');
});

test('sin sugerencia: mismo idioma o sin preferencia', () => {
  assert.equal(suggestLanguage(['es-AR'], 'es'), null);
  assert.equal(suggestLanguage(['es', 'pt'], 'es'), null);
  assert.equal(suggestLanguage([], 'es'), null);
  assert.equal(suggestLanguage(undefined, 'es'), null);
  assert.equal(suggestLanguage([''], 'es'), null);
});
