// https://github.com/jaredLunde/react-hook/blob/master/packages/intersection-observer/src/index.tsx
import * as React from 'react'
import type {IntersectionObserverOptions, MockIntersectionObserverEntry} from './use-intersection-observer'

function useIntersectionObserver<T extends HTMLElement = HTMLElement>(
  target: React.RefObject<T> | T | null,
  options: IntersectionObserverOptions = {}
): MockIntersectionObserverEntry | IntersectionObserverEntry {
  const {
    root = null,
    pollInterval = null,
    useMutationObserver = false,
    rootMargin = '0px 0px 0px 0px',
    threshold = 0,
    initialIsIntersecting = false,
  } = options
  const [entry, setEntry] = React.useState<IntersectionObserverEntry | MockIntersectionObserverEntry>(() => ({
    boundingClientRect: null,
    intersectionRatio: 0,
    intersectionRect: null,
    isIntersecting: initialIsIntersecting,
    rootBounds: null,
    target: null,
    time: 0,
  }))
  const thresholdKey = JSON.stringify(threshold)
  const getThreshold = React.useEffectEvent(() => threshold)

  React.useLayoutEffect(() => {
    const observer = getIntersectionObserver(
      {
        pollInterval,
        root,
        rootMargin,
        threshold: getThreshold(),
        useMutationObserver,
      },
      thresholdKey
    )
    const targetEl = target && 'current' in target ? target.current : target
    if (!observer || !targetEl) return
    let didUnsubscribe = false
    observer.observer.observe(targetEl)

    const callback = (entries: IntersectionObserverEntry[]) => {
      if (didUnsubscribe) return
      // eslint-disable-next-line
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        if (!entry) {
          continue
        }
        if (entry.target === targetEl) {
          setEntry(entry)
        }
      }
    }

    observer.subscribe(callback)

    return () => {
      didUnsubscribe = true
      observer.observer.unobserve(targetEl)
      observer.unsubscribe(callback)
    }
  }, [target, root, rootMargin, pollInterval, useMutationObserver, thresholdKey])

  return entry
}

function createIntersectionObserver({
  root = null,
  pollInterval = null,
  useMutationObserver = false,
  rootMargin = '0px 0px 0px 0px',
  threshold = 0,
}: IntersectionObserverOptions) {
  const callbacks: Set<IntersectionObserverCallback> = new Set()
  if (typeof IntersectionObserver === 'undefined') return null
  const observer = new IntersectionObserver(
    entries => {
      for (const callback of callbacks) callback(entries, observer)
    },
    {root, rootMargin, threshold}
  ) as IntersectionObserver & {
    POLL_INTERVAL?: number | null
    USE_MUTATION_OBSERVER?: boolean
  }
  observer.POLL_INTERVAL = pollInterval
  observer.USE_MUTATION_OBSERVER = useMutationObserver

  return {
    getListeners() {
      return callbacks
    },
    observer,
    subscribe: (callback: IntersectionObserverCallback) => callbacks.add(callback),
    unsubscribe: (callback: IntersectionObserverCallback) => callbacks.delete(callback),
  }
}

const _intersectionObserver: Map<
  HTMLElement | null | undefined,
  Record<string, ReturnType<typeof createIntersectionObserver>>
> = new Map()

function getIntersectionObserver(options: IntersectionObserverOptions, thresholdKey: string) {
  const {root, ...keys} = options
  const key = JSON.stringify({...keys, threshold: thresholdKey})
  let base = _intersectionObserver.get(root)
  if (!base) {
    base = {}
    _intersectionObserver.set(root, base)
  }
  return !base[key] ? (base[key] = createIntersectionObserver(options)) : base[key]
}

export default useIntersectionObserver
