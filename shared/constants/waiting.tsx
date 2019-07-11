import * as I from 'immutable'
import * as Types from './types/waiting'
import {RPCError} from '../util/errors'

export const anyWaiting = (
  state: {
    readonly waiting: Types.State
  },
  ...keys: Array<string>
) => {
  return keys.reduce((acc, k) => acc + state.waiting.counts.get(k, 0), 0) > 0
}

export const anyErrors = (
  state: {
    readonly waiting: Types.State
  },
  keys: string | Array<string>
): RPCError | null => {
  if (!Array.isArray(keys)) {
    return state.waiting.errors.get(keys, null)
  }

  return keys.reduce<RPCError | null>((acc, k) => acc || state.waiting.errors.get(k, null), null)
}

export const makeState = I.Record<Types._State>({
  counts: I.Map(),
  errors: I.Map(),
})
