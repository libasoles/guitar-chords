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

// Lucide lightbulb for tips.
const tipIcon = h('svg', {
  className: 'toast-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
},
  h('path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' }),
  h('path', { d: 'M9 18h6' }),
  h('path', { d: 'M10 22h4' }),
);

// The re-fingering tip: the keys and a before/after of the same pitch moving from String 5 to String 4.
function refingerTip() {
  const tab = (...lines) => h('pre', { className: 'toast-tip-tab', 'aria-hidden': true }, ...lines);
  const key = (label, ariaLabel) => h('kbd', { 'aria-label': ariaLabel }, label);
  return h('div', { className: 'toast-tip-body' },
    h('p', null, strings.toastRefingerTip),
    h('p', { className: 'toast-tip-keys' },
      key('Shift'), ' + ', key('↑', strings.toastRefingerUp), ' / ', key('Shift'), ' + ', key('↓', strings.toastRefingerDown)),
    h('div', { className: 'toast-tip-demo' },
      tab('e|-----\nB|-----\nG|-----\nD|-----\nA|--', h('mark', null, '7'), '--\nE|-----'),
      h('span', { className: 'toast-tip-arrow', 'aria-hidden': true }, '→'),
      tab('e|-----\nB|-----\nG|-----\nD|--', h('mark', null, '2'), '--\nA|-----\nE|-----'),
    ),
  );
}

// The tip variant renders the re-fingering lesson in place of a message. `onClose` fires only when the
// X button is pressed, not when the toast times out or is replaced by another one.
function render(message, duration, variant, onClose) {
  const alert = variant === 'alert';
  const tip = variant === 'tip';
  flushSync(() => root.render(
    h(Toast.Provider, { duration: 6000, label: strings.toastLabel, swipeDirection: 'right' },
      message || tip ? h(Toast.Root, { key: ++sequence, className: alert ? 'toast toast-alert' : tip ? 'toast toast-tip' : 'toast', duration: duration || (alert ? ALERT_DURATION : undefined) },
        alert ? alertIcon : tip ? tipIcon : null,
        h(Toast.Description, { className: 'toast-description', asChild: tip }, tip ? refingerTip() : message),
        h(Toast.Close, { className: 'toast-close', 'aria-label': strings.toastClose, onClick: onClose },
          h('span', { 'aria-hidden': true }, '×')),
      ) : null,
      h(Toast.Viewport, { className: 'toast-viewport', label: strings.toastViewportLabel }),
    ),
  ));
}

window.SiteToast = {
  show(message, { duration, variant, onClose } = {}) { render(message, duration, variant, onClose); },
  clear() { render(null); },
};
