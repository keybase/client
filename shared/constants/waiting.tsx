import type {RPCError} from '../util/errors'
import type * as Types from './types/waiting'
import * as Z from '../util/zustand'

const initialStore: Types.State = {
  counts: new Map(),
  errors: new Map(),
}

type State = Types.State & {
  dispatch: {
    resetState: () => void
    clear: (keys: string | Array<string>) => void
    increment: (keys: string | Array<string>) => void
    decrement: (keys: string | Array<string>, error?: RPCError) => void
    batch: (changes: Array<{key: string | Array<string>; increment: boolean; error?: RPCError}>) => void
  }
}

const getKeys = (k?: string | Array<string>) => {
  if (k === undefined) return []
  if (typeof k === 'string') return [k]
  return k
}

export const useWaitingState = Z.createZustand(
  Z.immerZustand<State>(set => {
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

    const increment = (keys: string | Array<string>) => {
      changeHelper(keys, 1)
    }
    const decrement = (keys: string | Array<string>, error?: RPCError) => {
      changeHelper(keys, -1, error)
    }
    const dispatch = {
      batch: (changes: Array<{key: string | Array<string>; increment: boolean; error?: RPCError}>) => {
        changes.forEach(c => {
          if (c.increment) {
            increment(c.key)
          } else {
            decrement(c.key, c.error)
          }
        })
      },
      clear: (keys: string | Array<string>) => {
        set(s => {
          getKeys(keys).forEach(k => {
            s.counts.delete(k)
            s.errors.delete(k)
          })
        })
      },
      decrement,
      increment,
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
    }

    return {
      ...initialStore,
      dispatch,
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

export const useDispatchClearWaiting = () => useWaitingState(s => s.dispatch.clear)
