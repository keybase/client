// @flow
import * as I from 'immutable'
import * as Types from './types/waiting'
import type {RPCError} from '../util/errors'
import {isArray, isString} from 'lodash-es'

export const anyWaiting = (state: {+waiting: Types.State}, ...keys: Array<string>) => {
  return keys.reduce((acc, k) => acc + state.waiting.counts.get(k, 0), 0) > 0
}

export const anyErrors = (
  state: {+waiting: Types.State},
  keys: string | Array<string> | (string => boolean)
): ?RPCError => {
  if (isString(keys)) {
    return state.waiting.errors.get(keys, null)
  }

  if (isArray(keys)) {
    return keys.reduce((acc, k) => acc || state.waiting.errors.get(k, null), null)
  }

  return state.waiting.errors.find((v, k) => keys(k) && !!v)
}

export const makeState: I.RecordFactory<Types._State> = I.Record({
  counts: I.Map(),
  errors: I.Map(),
})
