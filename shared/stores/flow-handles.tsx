import {registerExternalResetter} from '@/util/zustand'

type Handle = (...args: Array<any>) => void
type KeyedHandleEntry = {
  handle: Handle
  owner: string
  slot: string
}

const makeNamedKey = (owner: string, slot: string) => `${owner}:${slot}`

// Runtime registry for live listener callbacks that must survive route changes.
//
// This is intentionally not a Zustand store: nothing subscribes to these values as UI state.
// Use it for transient handlers that back multi-step RPC flows, especially when a screen needs
// to carry an opaque token through navigation and resolve the callback later.
//
// Keep only live handlers here. Do not store banners, form state, waiting state, or caches.
const keyed = new Map<string, KeyedHandleEntry>()
const named = new Map<string, Handle>()
let nextID = 0

export const callNamed = (owner: string, slot: string, ...args: Array<any>) => {
  named.get(makeNamedKey(owner, slot))?.(...args)
}

export const clearKeyed = (key: string) => {
  keyed.delete(key)
}

export const clearNamed = (owner: string, slot: string) => {
  named.delete(makeNamedKey(owner, slot))
}

export const clearOwner = (owner: string) => {
  for (const [key, entry] of keyed.entries()) {
    if (entry.owner === owner) {
      keyed.delete(key)
    }
  }
  const prefix = `${owner}:`
  for (const key of named.keys()) {
    if (key.startsWith(prefix)) {
      named.delete(key)
    }
  }
}

export const consumeKeyed = (key: string, ...args: Array<any>) => {
  const handle = keyed.get(key)?.handle
  keyed.delete(key)
  handle?.(...args)
}

export const registerKeyed = (owner: string, slot: string, handle: Handle) => {
  nextID += 1
  const key = `${owner}:${slot}:${nextID}`
  keyed.set(key, {handle, owner, slot})
  return key
}

export const setNamed = (owner: string, slot: string, handle?: Handle) => {
  const key = makeNamedKey(owner, slot)
  if (handle) {
    named.set(key, handle)
  } else {
    named.delete(key)
  }
}

export const clearAll = () => {
  keyed.clear()
  named.clear()
}

// Keep the token counter monotonic for the process lifetime. Reusing old IDs after a global reset
// can collide with stale route params that still carry a previously issued opaque token.
registerExternalResetter('flow-handles', clearAll)
