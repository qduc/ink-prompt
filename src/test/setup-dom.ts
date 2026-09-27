import { Window } from 'happy-dom';

const window = new Window();
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: window.navigator,
});
