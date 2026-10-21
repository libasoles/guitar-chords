'use strict';

const { escapeAttr } = require('./score-svg');

// Lucide chevron-left and chevron-right. Follow the collection's published order.
const CHEVRONS = ['m15 18-6-6 6-6', 'm9 18 6-6-6-6'];

function scoreNavigation(pieces, piece, prefix, name, locale, { mobile = false } = {}) {
  const index = pieces.indexOf(piece);
  const labels = locale === 'es' ? ['Partitura anterior', 'Partitura siguiente'] : ['Previous score', 'Next score'];
  const buttons = [pieces[index - 1], pieces[index + 1]].map((target, i) => {
    const attrs = target
      ? 'popovertarget="' + prefix + target.number + '" popovertargetaction="show" aria-label="' + escapeAttr(labels[i] + ': ' + name(target, locale)) + '"'
      : 'disabled aria-label="' + labels[i] + '"';
    return '<button type="button" class="modal-step" ' + attrs + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + CHEVRONS[i] + '"/></svg></button>';
  });
  return '<div class="modal-navigation' + (mobile ? ' modal-navigation-mobile' : '') + '">' + buttons.join('') + '</div>';
}

module.exports = { scoreNavigation };
