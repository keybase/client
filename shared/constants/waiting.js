// @flow
import * as I from 'immutable'
import type {State} from './types/waiting'
import type {TypedState} from './reducer'

const anyWaiting = (state: TypedState, ...keys: Array<string>) => {
  return keys.reduce((acc, k) => acc + state.waiting.get(k, 0), 0) > 0
}

const initialState: State = I.Map()

export {anyWaiting, initialState}
