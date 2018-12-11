// @flow strict
import * as I from 'immutable'

export type _State = {
  counts: I.Map<string, number>,
  errors: I.Map<string, string>,
}

export type State = I.RecordOf<_State>
