import * as React from 'react'

// These never get an explicit logout reset: the ref callback that sets
// portalNode fires with null on unmount, and the effect that sets
// portalContent clears it on unmount too. Both owning components live only
// inside the logged-in chat tree, so logout unmounts them and clears this
// module state as a side effect - no extra reset wiring needed.
let portalNode: HTMLElement | null = null
let portalContent: React.ReactElement | null = null
const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useInboxHeaderPortalNode = () =>
  React.useSyncExternalStore(subscribe, (): HTMLElement | null => portalNode, (): HTMLElement | null => null)

export const useInboxHeaderPortalContent = () =>
  React.useSyncExternalStore(
    subscribe,
    (): React.ReactElement | null => portalContent,
    (): React.ReactElement | null => null
  )

export const setInboxHeaderPortalNode = (node: HTMLElement | null) => {
  if (portalNode === node) {
    return
  }
  portalNode = node
  notify()
}

export const setInboxHeaderPortalContent = (content: React.ReactElement | null) => {
  if (portalContent === content) {
    return
  }
  portalContent = content
  notify()
}
