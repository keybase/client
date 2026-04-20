import {registerExternalResetter} from '@/util/zustand'

type Handle = (...args: Array<any>) => void
type ScopedKeyedHandle = {
  dispose: () => void
  key: string
}
type ScopedNamedHandle = {
  dispose: () => void
  token: number
}
type KeyedHandleEntry = {
  handle: Handle
  owner: string
  slot: string
}
type NamedHandleEntry = {
  handle: Handle
  token: number
}

const makeNamedKey = (owner: string, slot: string) => `${owner}:${slot}`

// Runtime registry for live listener callbacks that must survive route changes.
//
// This is intentionally not a Zustand store: nothing subscribes to these values as UI state.
// Use it for transient handlers that back multi-step RPC flows, especially when a screen needs
// to carry an opaque token through navigation and resolve the callback later.
//
// Keep only live handlers here. Do not store banners, form state, waiting state, or caches.
//
// Prefer the scoped helpers below:
// - `setNamedScoped(...)` for named owner/slot handlers that a flow replaces over time
// - `registerKeyedScoped(...)` for one-shot keyed handlers carried through route params
//
// Both return disposers so cleanup lives next to registration. Named disposers are token-aware so
// stale cleanup from an older flow cannot clear a newer replacement handler.
const keyed = new Map<string, KeyedHandleEntry>()
const named = new Map<string, NamedHandleEntry>()
let nextID = 0

export const callNamed = (owner: string, slot: string, ...args: Array<any>) => {
  named.get(makeNamedKey(owner, slot))?.handle(...args)
}

export const clearKeyed = (key: string) => {
  keyed.delete(key)
}

export const clearNamed = (owner: string, slot: string) => {
  named.delete(makeNamedKey(owner, slot))
}

export const clearNamedIfToken = (owner: string, slot: string, token: number) => {
  const key = makeNamedKey(owner, slot)
  if (named.get(key)?.token === token) {
    named.delete(key)
  }
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

// Preferred keyed API: keep the disposer next to the registration site and pass only the opaque key
// through navigation. The disposer is safe to call after consume; it becomes a no-op.
export const registerKeyedScoped = (owner: string, slot: string, handle: Handle): ScopedKeyedHandle => {
  nextID += 1
  const key = `${owner}:${slot}:${nextID}`
  keyed.set(key, {handle, owner, slot})
  return {
    dispose: () => {
      keyed.delete(key)
    },
    key,
  }
}

export const registerKeyed = (owner: string, slot: string, handle: Handle) => {
  return registerKeyedScoped(owner, slot, handle).key
}

// Preferred named API: the disposer is token-aware, so stale cleanup from an older flow cannot
// clear a newer replacement handler for the same owner/slot.
export const setNamedScoped = (owner: string, slot: string, handle: Handle): ScopedNamedHandle => {
  nextID += 1
  const token = nextID
  named.set(makeNamedKey(owner, slot), {handle, token})
  return {
    dispose: () => {
      clearNamedIfToken(owner, slot, token)
    },
    token,
  }
}

export const setNamed = (owner: string, slot: string, handle?: Handle) => {
  const key = makeNamedKey(owner, slot)
  if (handle) {
    return setNamedScoped(owner, slot, handle).token
  } else {
    named.delete(key)
    return undefined
  }
}

export const clearAll = () => {
  keyed.clear()
  named.clear()
}

// Keep the token counter monotonic for the process lifetime. Reusing old IDs after a global reset
// can collide with stale route params that still carry a previously issued opaque token.
registerExternalResetter('flow-handles', clearAll)
