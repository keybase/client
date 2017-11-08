// @flow
import * as I from 'immutable'
import {type TypedState} from './reducer'

export type State = I.Map<string, number>

const anyWaiting = (state: TypedState, ...keys: Array<string>) => {
  return keys.reduce((acc, k) => acc + state.waiting.get(k, 0), 0) > 0
}

export {anyWaiting}
