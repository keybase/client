// https://github.com/jaredLunde/react-hook/blob/master/packages/resize-observer/src/index.tsx
import * as React from 'react'

function useResizeObserver<T extends Element>(
  target: React.RefObject<T> | React.ForwardedRef<T> | T | null,
  callback: UseResizeObserverCallback
): ResizeObserver {
  const resizeObserver = getResizeObserver()
  const storedCallback = React.useRef(callback)
  storedCallback.current = callback

  React.useLayoutEffect(() => {
    let didUnsubscribe = false
    const targetEl = target && 'current' in target ? target.current : target
    if (!targetEl) return () => {}

    function cb(entry: ResizeObserverEntry, observer: ResizeObserver) {
      if (didUnsubscribe) return
      storedCallback.current(entry, observer)
    }

    resizeObserver.subscribe(targetEl as Element, cb)

    return () => {
      didUnsubscribe = true
      resizeObserver.unsubscribe(targetEl as Element, cb)
    }
  }, [target, resizeObserver, storedCallback])

  return resizeObserver.observer
}

function createResizeObserver() {
  let ticking = false
  let allEntries: ResizeObserverEntry[] = []

  const callbacks: Map<any, Array<UseResizeObserverCallback>> = new Map()

  const observer = new window.ResizeObserver((entries: ResizeObserverEntry[], obs: ResizeObserver) => {
    allEntries = allEntries.concat(entries)
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const triggered = new Set<Element>()
        // eslint-disable-next-line
        for (let i = 0; i < allEntries.length; i++) {
          // @ts-ignore
          if (triggered.has(allEntries[i].target)) continue
          // @ts-ignore
          triggered.add(allEntries[i].target)
          // @ts-ignore
          const cbs = callbacks.get(allEntries[i].target)
          // eslint-disable-next-line
          cbs?.forEach(cb => cb(allEntries[i]!, obs))
        }
        allEntries = []
        ticking = false
      })
    }
    ticking = true
  })

  return {
    observer,
    subscribe(target: Element, callback: UseResizeObserverCallback) {
      observer.observe(target)
      const cbs = callbacks.get(target) ?? []
      cbs.push(callback)
      callbacks.set(target, cbs)
    },
    unsubscribe(target: Element, callback: UseResizeObserverCallback) {
      const cbs = callbacks.get(target) ?? []
      if (cbs.length === 1) {
        observer.unobserve(target)
        callbacks.delete(target)
        return
      }
      const cbIndex = cbs.indexOf(callback)
      if (cbIndex !== -1) cbs.splice(cbIndex, 1)
      callbacks.set(target, cbs)
    },
  }
}

let _resizeObserver: ReturnType<typeof createResizeObserver> | undefined

const getResizeObserver = () =>
  !_resizeObserver ? (_resizeObserver = createResizeObserver()) : _resizeObserver

export type UseResizeObserverCallback = (entry: ResizeObserverEntry, observer: ResizeObserver) => any
export default useResizeObserver
