import type {RPCError} from '@/util/errors'
import type {WaitingChange} from '@/engine/types'
import type {WaitingKey, WaitingKeys} from '@/constants/waiting-key-type'
import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {releaseOnce} from '@/util/release-once'

// This store has no dependencies on other stores and is safe to import directly from other stores.
const initialStore: T.Waiting.State = {
  counts: new Map(),
  errors: new Map(),
}

export type State = T.Waiting.State & {
  dispatch: {
    resetState: () => void
    // Drops counts too, so it is only for a key no RPC holds (an RPC's tracker owns its count)
    clear: (keys: WaitingKeys) => void
    clearErrors: (keys: WaitingKeys) => void
    increment: (keys: WaitingKeys) => void
    decrement: (keys: WaitingKeys, error?: RPCError) => void
    batch: (changes: ReadonlyArray<WaitingChange>) => void
  }
}

const getKeys = (k?: WaitingKeys): ReadonlyArray<WaitingKey> => {
  if (k === undefined) return []
  if (typeof k === 'string') return [k]
  return k
}

// One change to one key's count, on the store's draft
const changeCount = (
  s: {counts: Map<string, number>; errors: Map<string, RPCError | undefined>},
  k: string,
  diff: 1 | -1,
  error?: RPCError
) => {
  const oldCount = s.counts.get(k) || 0
  // going from 0 => 1, clear errors
  if (oldCount === 0 && diff === 1) {
    s.errors.delete(k)
  } else if (error) {
    s.errors.set(k, error)
  }
  let newCount = oldCount + diff
  if (newCount < 0) {
    if (__DEV__) {
      logger.warn(`waiting: ${k} released more often than it was held`)
    }
    newCount = 0
  }
  if (newCount === 0) {
    s.counts.delete(k)
  } else {
    s.counts.set(k, newCount)
  }
}

export const useWaitingState = Z.createZustand<State>('waiting', set => {
  const changeHelper = (keys: WaitingKeys, diff: 1 | -1, error?: RPCError) => {
    set(s => {
      getKeys(keys).forEach(k => changeCount(s, k, diff, error))
    })
  }

  const dispatch: State['dispatch'] = {
    // One store update for the whole batch, so no reader sees part of it
    batch: changes => {
      set(s => {
        changes.forEach(c => {
          getKeys(c.key).forEach(k => {
            if (c.increment === undefined) {
              s.errors.set(k, c.error)
            } else {
              changeCount(s, k, c.increment ? 1 : -1, c.error)
            }
          })
        })
      })
    },
    clear: keys => {
      set(s => {
        getKeys(keys).forEach(k => {
          s.counts.delete(k)
          s.errors.delete(k)
        })
      })
    },
    clearErrors: keys => {
      set(s => {
        getKeys(keys).forEach(k => {
          s.errors.delete(k)
        })
      })
    },
    decrement: (keys, error) => {
      changeHelper(keys, -1, error)
    },
    increment: keys => {
      changeHelper(keys, 1)
    },
    // Counts track calls still in flight, and every one of those decrements its count when it
    // settles, so a logout keeps them: clearing them would send the count negative when those calls
    // end. Errors belong to the account's screens and go.
    resetState: () => {
      set(s => {
        s.errors.clear()
      })
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})

export const useAnyWaiting = (k?: WaitingKeys) =>
  useWaitingState(s => !!getKeys(k).some(k => (s.counts.get(k) ?? 0) > 0))

export const useAnyErrors = (k: WaitingKeys) =>
  useWaitingState(s => {
    const errorKey = getKeys(k).find(k => s.errors.get(k))
    return errorKey ? s.errors.get(errorKey) : undefined
  })

// A screen clears the error its key shows; the count belongs to whatever is still in flight
export const useDispatchClearWaiting = () => useWaitingState(s => s.dispatch.clearErrors)

// Holds a key on for work outside an RPC; the release runs once
export const holdWaiting = (key: WaitingKey): (() => void) => {
  const {decrement, increment} = useWaitingState.getState().dispatch
  increment(key)
  return releaseOnce(() => decrement(key))
}

// Holds a key on while f runs, however it ends
export const withWaiting = async <R,>(key: WaitingKey, f: () => Promise<R>): Promise<R> => {
  const release = holdWaiting(key)
  try {
    return await f()
  } finally {
    release()
  }
}
