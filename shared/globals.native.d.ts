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

// Stubs for DOM observer/element types used in merged platform files.
// Desktop build excludes this file so declare class is safe (no conflict with lib.dom).
interface Element {}
interface HTMLElement extends Element {}
interface HTMLDivElement extends HTMLElement {}

interface DOMRectReadOnly {
  readonly width: number
  readonly height: number
  readonly top: number
  readonly left: number
  readonly bottom: number
  readonly right: number
  readonly x: number
  readonly y: number
}

interface ResizeObserverEntry {
  readonly target: Element
  readonly contentRect: DOMRectReadOnly
}
declare class ResizeObserver {
  constructor(callback: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void)
  disconnect(): void
  observe(target: Element): void
  unobserve(target: Element): void
}

type IntersectionObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void
interface IntersectionObserverInit {
  root?: Element | Document | null
  rootMargin?: string
  threshold?: number | number[]
}
interface IntersectionObserverEntry {
  readonly isIntersecting: boolean
  readonly target: Element
  readonly time: number
  readonly intersectionRatio: number
  readonly rootBounds: DOMRectReadOnly | null
  readonly boundingClientRect: DOMRectReadOnly
  readonly intersectionRect: DOMRectReadOnly
}
declare class IntersectionObserver {
  readonly POLL_INTERVAL: number | null | undefined
  readonly USE_MUTATION_OBSERVER: boolean | undefined
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit)
  observe(target: Element): void
  unobserve(target: Element): void
  disconnect(): void
}

declare function requestAnimationFrame(callback: FrameRequestCallback): number
type FrameRequestCallback = (time: number) => void
