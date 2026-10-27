import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as Toast from '@radix-ui/react-toast';

// Strings come from the Partitura tool page config, or from the score editor's own strings block.
const strings = window.PARTITURA_CONFIG
  ? window.PARTITURA_CONFIG.strings
  : JSON.parse(document.getElementById('scoreStrings').textContent);
const host = document.createElement('div');
document.body.appendChild(host);
const root = createRoot(host);
let sequence = 0;

// A fresh Root gives repeated messages their own full duration and announcement.
// Callers may override the default duration for an individual notification.
// Alerts last longer and carry a lucide circle-alert icon.
const ALERT_DURATION = 9000;
const alertIcon = h('svg', {
  className: 'toast-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
},
  h('circle', { cx: 12, cy: 12, r: 10 }),
  h('line', { x1: 12, x2: 12, y1: 8, y2: 12 }),
  h('line', { x1: 12, x2: 12.01, y1: 16, y2: 16 }),
);

function render(message, duration, variant) {
  const alert = variant === 'alert';
  flushSync(() => root.render(
    h(Toast.Provider, { duration: 6000, label: strings.toastLabel, swipeDirection: 'right' },
      message ? h(Toast.Root, { key: ++sequence, className: alert ? 'toast toast-alert' : 'toast', duration: duration || (alert ? ALERT_DURATION : undefined) },
        alert ? alertIcon : null,
        h(Toast.Description, { className: 'toast-description' }, message),
        h(Toast.Close, { className: 'toast-close', 'aria-label': strings.toastClose },
          h('span', { 'aria-hidden': true }, '×')),
      ) : null,
      h(Toast.Viewport, { className: 'toast-viewport', label: strings.toastViewportLabel }),
    ),
  ));
}

window.SiteToast = {
  show(message, { duration, variant } = {}) { render(message, duration, variant); },
  clear() { render(null); },
};
