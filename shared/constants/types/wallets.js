// @flow
import * as I from 'immutable'

export type _State = {
  hello: string,
}
export type State = I.RecordOf<_State>
