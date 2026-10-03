import {registerExternalResetter} from '@/util/zustand'

type Handle = (...args: Array<any>) => void
type NamedHandleEntry = {
  handle: Handle
  token: number
}

const makeNamedKey = (owner: string, slot: string) => `${owner}:${slot}`

// Runtime registry for live listener callbacks that must survive route changes.
//
// This is intentionally not a Zustand store: nothing subscribes to these values as UI state.
// Use it for transient handlers that back multi-step RPC flows.
//
// Keep only live handlers here. Do not store banners, form state, waiting state, or caches.
const named = new Map<string, NamedHandleEntry>()
let nextID = 0

export const callNamed = (owner: string, slot: string, ...args: Array<any>) => {
  named.get(makeNamedKey(owner, slot))?.handle(...args)
}

// The disposer is token-aware, so stale cleanup from an older flow cannot clear a newer replacement
// handler for the same owner/slot.
export const setNamedScoped = (owner: string, slot: string, handle: Handle) => {
  nextID += 1
  const token = nextID
  const key = makeNamedKey(owner, slot)
  named.set(key, {handle, token})
  return {
    dispose: () => {
      if (named.get(key)?.token === token) {
        named.delete(key)
      }
    },
  }
}

const clearAll = () => {
  named.clear()
}

// The token counter stays monotonic for the process lifetime: an older flow's disposer can run after
// a reset, and a reused token would let it clear a newer flow's handler.
registerExternalResetter('flow-handles', clearAll)
