import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

const host = document.createElement('div');
document.body.appendChild(host);
const root = createRoot(host);

// Lucide "x".
const xIcon = () => h('svg', {
  className: 'lucide', viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}, h('path', { d: 'M18 6 6 18' }), h('path', { d: 'm6 6 12 12' }));

// Resolves true when the person confirms, false on cancel or Escape.
function ask({ title, description, confirm, cancel }) {
  return new Promise((resolve) => {
    // Closing re-renders with open: false so Radix keeps the dialog mounted until the fade-out ends.
    const render = (open) => flushSync(() => root.render(
      h(AlertDialog.Root, { open, onOpenChange: (next) => { if (!next) finish(false); } },
        h(AlertDialog.Portal, null,
          h(AlertDialog.Overlay, { className: 'confirm-overlay' }),
          h(AlertDialog.Content, { className: 'confirm-content' },
            h(AlertDialog.Title, { className: 'confirm-title' }, title),
            h(AlertDialog.Description, { className: 'confirm-description' }, description),
            h('div', { className: 'confirm-actions' },
              h(AlertDialog.Cancel, { className: 'confirm-button confirm-cancel' }, xIcon(), cancel),
              h(AlertDialog.Action, { className: 'confirm-button confirm-danger', onClick: () => finish(true) }, confirm),
            ),
          ),
        ),
      ),
    ));
    const finish = (answer) => {
      render(false);
      resolve(answer);
    };
    render(true);
  });
}

window.ScoreConfirm = { ask };
