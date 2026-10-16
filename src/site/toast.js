import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as Toast from '@radix-ui/react-toast';

const strings = window.PARTITURA_CONFIG.strings;
const host = document.createElement('div');
document.body.appendChild(host);
const root = createRoot(host);
let sequence = 0;

// A fresh Root gives repeated messages their own full duration and announcement.
// Callers may override the default duration for an individual notification.
function render(message, duration) {
  flushSync(() => root.render(
    h(Toast.Provider, { duration: 6000, label: strings.toastLabel, swipeDirection: 'right' },
      message ? h(Toast.Root, { key: ++sequence, className: 'toast', duration },
        h(Toast.Description, { className: 'toast-description' }, message),
        h(Toast.Close, { className: 'toast-close', 'aria-label': strings.toastClose },
          h('span', { 'aria-hidden': true }, '×')),
      ) : null,
      h(Toast.Viewport, { className: 'toast-viewport', label: strings.toastViewportLabel }),
    ),
  ));
}

window.SiteToast = {
  show(message, { duration } = {}) { render(message, duration); },
  clear() { render(null); },
};
