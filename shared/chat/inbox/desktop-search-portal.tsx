import * as React from 'react'

let portalNode: HTMLElement | null = null
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

export const useDesktopInboxSearchPortalNode = () =>
  React.useSyncExternalStore(subscribe, () => portalNode, () => null)

export const setDesktopInboxSearchPortalNode = (node: HTMLElement | null) => {
  if (portalNode === node) {
    return
  }
  portalNode = node
  notify()
}
