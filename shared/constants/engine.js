// @flow
import * as I from 'immutable'

type _State = {
  rpcWaitingStates: I.Map<string, boolean>,
}
export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  rpcWaitingStates: I.Map(),
})
