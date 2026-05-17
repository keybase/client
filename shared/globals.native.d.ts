// Globals available on React Native's `global` object.
// `location` and `window` only exist in Chrome DevTools remote debugging builds.
declare var location: unknown
declare var window:
  | {
      __perfReact?: unknown
      requestIdleCallback?: (
        cb: (info: {didTimeout: boolean; timeRemaining: () => number}) => void,
        opts?: {timeout?: number}
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }
  | undefined

// Minimal File/DataTransfer stubs for shared files that use these types
// (actual drag-and-drop only runs on desktop, but the code is in shared files)
interface File {
  readonly type: string
  readonly name: string
}
interface DataTransfer {
  readonly files: ReadonlyArray<File>
  readonly types: ReadonlyArray<string>
}

declare function requestAnimationFrame(callback: () => void): number

// Minimal DOM element stubs for desktop-only branches of merged files
interface Element {
  tagName?: string
}
interface HTMLElement extends Element {}

// Minimal stubs for browser observer APIs used in desktop-only branches of merged files
interface IntersectionObserverEntry {
  readonly boundingClientRect: DOMRectReadOnly | null
  readonly intersectionRatio: number
  readonly intersectionRect: DOMRectReadOnly | null
  readonly isIntersecting: boolean
  readonly rootBounds: DOMRectReadOnly | null
  readonly target: Element
  readonly time: number
}
type IntersectionObserverCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void
interface IntersectionObserverInit {
  root?: Element | null
  rootMargin?: string
  threshold?: number | number[]
}
declare class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit)
  observe(target: Element): void
  unobserve(target: Element): void
  disconnect(): void
  POLL_INTERVAL?: number | null
  USE_MUTATION_OBSERVER?: boolean
}
interface ResizeObserverEntry {
  readonly contentRect: DOMRectReadOnly
  readonly target: Element
}
declare class ResizeObserver {
  constructor(callback: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void)
  observe(target: Element): void
  unobserve(target: Element): void
  disconnect(): void
}
interface DOMRectReadOnly {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}
