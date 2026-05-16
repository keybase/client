export interface IntersectionObserverBounds {
  readonly height: number
  readonly width: number
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

export interface MockIntersectionObserverEntry {
  readonly time: number | null
  readonly rootBounds: IntersectionObserverBounds | null
  readonly boundingClientRect: IntersectionObserverBounds | null
  readonly intersectionRect: IntersectionObserverBounds | null
  readonly intersectionRatio: number | null
  readonly target: HTMLElement | null
  readonly isIntersecting: boolean
}

export interface IntersectionObserverOptions {
  root?: HTMLElement | null
  pollInterval?: number | null
  useMutationObserver?: boolean
  rootMargin?: string
  threshold?: number | number[]
  initialIsIntersecting?: boolean
}

export type UseIntersectionObserverCallback = (
  entry: MockIntersectionObserverEntry,
  observer: unknown
) => unknown
