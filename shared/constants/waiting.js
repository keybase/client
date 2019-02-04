// @flow
import * as I from 'immutable'
import * as Types from './types/waiting'
import type {RPCError} from '../util/errors'
import {isString} from 'lodash-es'

export const anyWaiting = (state: {+waiting: Types.State}, ...keys: Array<string>) => {
  return keys.reduce((acc, k) => acc + state.waiting.counts.get(k, 0), 0) > 0
}

export const anyErrors = (state: {+waiting: Types.State}, keys: string | Array<string>): ?RPCError => {
  if (isString(keys)) {
    return state.waiting.errors.get(keys, null)
  }

  return keys.reduce((acc, k) => acc || state.waiting.errors.get(k, null), null)
}

export const makeState: I.RecordFactory<Types._State> = I.Record({
  counts: I.Map(),
  errors: I.Map(),
})
