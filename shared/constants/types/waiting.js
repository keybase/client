// @flow strict
import * as I from 'immutable'
import type {RPCError} from '../../util/errors'

export type _State = {
  counts: I.Map<string, number>,
  errors: I.Map<string, ?RPCError>,
}

export type State = I.RecordOf<_State>
