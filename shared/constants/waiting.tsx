import type {RPCError} from '@/util/errors'
import type * as T from './types'
import * as Z from '@/util/zustand'

const initialStore: T.Waiting.State = {
  counts: new Map(),
  errors: new Map(),
}

interface State extends T.Waiting.State {
  dispatch: {
    resetState: 'default'
    clear: (keys: string | ReadonlyArray<string>) => void
    increment: (keys: string | ReadonlyArray<string>) => void
    decrement: (keys: string | ReadonlyArray<string>, error?: RPCError) => void
    batch: (
      changes: ReadonlyArray<{key: string | ReadonlyArray<string>; increment: boolean; error?: RPCError}>
    ) => void
  }
}

const getKeys = (k?: string | ReadonlyArray<string>) => {
  if (k === undefined) return []
  if (typeof k === 'string') return [k]
  return k
}

export const _useState = Z.createZustand<State>((set, get) => {
  const changeHelper = (keys: string | ReadonlyArray<string>, diff: 1 | -1, error?: RPCError) => {
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

  const dispatch: State['dispatch'] = {
    batch: changes => {
      changes.forEach(c => {
        if (c.increment) {
          get().dispatch.increment(c.key)
        } else {
          get().dispatch.decrement(c.key, c.error)
        }
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
    decrement: (keys, error) => {
      changeHelper(keys, -1, error)
    },
    increment: keys => {
      changeHelper(keys, 1)
    },
    resetState: 'default',
  }

  return {
    ...initialStore,
    dispatch,
  }
})

export const useAnyWaiting = (k?: string | Array<string>) =>
  _useState(s => !!getKeys(k).some(k => (s.counts.get(k) ?? 0) > 0))

export const useAnyErrors = (k: string | Array<string>) =>
  _useState(s => {
    const errorKey = getKeys(k).find(k => s.errors.get(k))
    return errorKey ? s.errors.get(errorKey) : undefined
  })

export const useDispatchClearWaiting = () => _useState(s => s.dispatch.clear)
