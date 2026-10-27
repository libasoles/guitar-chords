import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

const host = document.createElement('div');
document.body.appendChild(host);
const root = createRoot(host);

// Resolves true when the person confirms, false on cancel or Escape.
function ask({ title, description, confirm, cancel }) {
  return new Promise((resolve) => {
    const finish = (answer) => {
      flushSync(() => root.render(null));
      resolve(answer);
    };
    flushSync(() => root.render(
      h(AlertDialog.Root, { open: true, onOpenChange: (open) => { if (!open) finish(false); } },
        h(AlertDialog.Portal, null,
          h(AlertDialog.Overlay, { className: 'confirm-overlay' }),
          h(AlertDialog.Content, { className: 'confirm-content' },
            h(AlertDialog.Title, { className: 'confirm-title' }, title),
            h(AlertDialog.Description, { className: 'confirm-description' }, description),
            h('div', { className: 'confirm-actions' },
              h(AlertDialog.Cancel, { className: 'confirm-button' }, cancel),
              h(AlertDialog.Action, { className: 'confirm-button confirm-danger', onClick: () => finish(true) }, confirm),
            ),
          ),
        ),
      ),
    ));
  });
}

window.ScoreConfirm = { ask };
