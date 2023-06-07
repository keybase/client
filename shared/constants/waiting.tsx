import type {RPCError} from '../util/errors'
import type * as Types from './types/waiting'
// normally util.container but it re-exports from us so break the cycle
import {create as createZustand} from 'zustand'
import {immer as immerZustand} from 'zustand/middleware/immer'

const initialState: Types.State = {
  counts: new Map(),
  errors: new Map(),
}

type ZState = Types.State & {
  dispatchReset: () => void
  dispatchClear: (keys: string | Array<string>) => void
  dispatchIncrement: (keys: string | Array<string>) => void
  dispatchDecrement: (keys: string | Array<string>, error?: RPCError) => void
  dispatchBatch: (changes: Array<{key: string | Array<string>; increment: boolean; error?: RPCError}>) => void
}

const getKeys = (k?: string | Array<string>) => {
  if (k === undefined) return []
  if (typeof k === 'string') return [k]
  return k
}

export const useWaitingState = createZustand(
  immerZustand<ZState>(set => {
    const dispatchReset = () => {
      set(() => initialState)
    }

    const changeHelper = (keys: string | Array<string>, diff: 1 | -1, error?: RPCError) => {
      set(s => {
        getKeys(keys).forEach(k => {
          const oldCount = s.counts.get(k) || 0
          // going from 0 => 1, clear errors
          if (oldCount === 0 && diff === 1) {
            s.errors.delete(k)
          } else {
            if (error) {
              s.errors.set(k, error)
            }
          }
          const newCount = oldCount + diff
          if (newCount === 0) {
            s.counts.delete(k)
          } else {
            s.counts.set(k, newCount)
          }
        })
      })
    }

    const dispatchIncrement = (keys: string | Array<string>) => {
      changeHelper(keys, 1)
    }
    const dispatchDecrement = (keys: string | Array<string>, error?: RPCError) => {
      changeHelper(keys, -1, error)
    }
    const dispatchBatch = (
      changes: Array<{key: string | Array<string>; increment: boolean; error?: RPCError}>
    ) => {
      changes.forEach(c => {
        if (c.increment) {
          dispatchIncrement(c.key)
        } else {
          dispatchDecrement(c.key, c.error)
        }
      })
    }

    const dispatchClear = (keys: string | Array<string>) => {
      set(s => {
        getKeys(keys).forEach(k => {
          s.counts.delete(k)
          s.errors.delete(k)
        })
      })
    }

    return {
      ...initialState,
      dispatchBatch,
      dispatchClear,
      dispatchDecrement,
      dispatchIncrement,
      dispatchReset,
    }
  })
)

export const useAnyWaiting = (k?: string | Array<string>) =>
  useWaitingState(s => !!getKeys(k).some(k => (s.counts.get(k) ?? 0) > 0))

export const useAnyErrors = (k: string | Array<string>) =>
  useWaitingState(s => {
    const errorKey = getKeys(k).find(k => s.errors.get(k))
    return errorKey ? s.errors.get(errorKey) : undefined
  })

export const useDispatchClearWaiting = () => useWaitingState(s => s.dispatchClear)
