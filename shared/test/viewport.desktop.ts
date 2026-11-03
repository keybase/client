// jsdom has no layout engine; the real lists only draw rows into a viewport with a size. Importing
// this gives every element one.
const viewport = {height: 600, width: 800}
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {configurable: true, get: () => viewport.height})
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {configurable: true, get: () => viewport.width})
HTMLElement.prototype.getBoundingClientRect = () =>
  ({...viewport, bottom: viewport.height, left: 0, right: viewport.width, top: 0, x: 0, y: 0}) as DOMRect
