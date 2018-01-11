// @flow
import * as I from 'immutable'

export type _State = {
  counter: number,
}

export type State = I.RecordOf<_State>
