import * as I from 'immutable'
import * as Types from './types/waiting'
import {RPCError} from '../util/errors'
import {isString} from 'lodash-es'

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
  if (isString(keys)) {
    return state.waiting.errors.get(keys as string, null)
  }

  return (keys as string[]).reduce((acc, k) => acc || state.waiting.errors.get(k, null), null)
}

export const makeState: I.Record.Factory<Types._State> = I.Record({
  counts: I.Map() as I.Map<string, number>,
  errors: I.Map() as I.Map<string, RPCError>,
})
