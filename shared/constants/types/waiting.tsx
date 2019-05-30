import * as I from 'immutable'
import {RPCError} from '../../util/errors'

export type _State = {
  counts: I.Map<string, number>
  errors: I.Map<string, RPCError | null>
}

export type State = I.RecordOf<_State>
