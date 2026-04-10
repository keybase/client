import * as React from 'react'

let portalNode: HTMLElement | null = null
let portalContent: React.ReactNode = null
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
  React.useSyncExternalStore(subscribe, () => portalNode, () => null)

export const useInboxHeaderPortalContent = () =>
  React.useSyncExternalStore(subscribe, () => portalContent, () => null)

export const setInboxHeaderPortalNode = (node: HTMLElement | null) => {
  if (portalNode === node) {
    return
  }
  portalNode = node
  notify()
}

export const setInboxHeaderPortalContent = (content: React.ReactNode) => {
  if (portalContent === content) {
    return
  }
  portalContent = content
  notify()
}
