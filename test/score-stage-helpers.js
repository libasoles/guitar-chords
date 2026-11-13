'use strict';

// The editor re-renders once the page settles (a debounced resize), which closes any open popup. Open popups only after that.
async function waitForStableStage(page) {
  let previous = '', stable = 0;
  for (let i = 0; i < 100 && stable < 4; i++) {
    const current = await page.evaluate(() => document.getElementById('scoreStage').clientWidth + ':' + document.getElementById('scoreStage').innerHTML.length);
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    await page.waitForTimeout(100);
  }
}

module.exports = { waitForStableStage };
