// @flow

import * as Constants from '../constants/gregor'

import type {PushState} from '../constants/gregor'
import type {State as GregorState} from '../constants/types/flow-types-gregor'
import type {PushReason} from '../constants/types/flow-types'

function pushState (state: GregorState, reason: PushReason): PushState {
  return {type: Constants.pushState, payload: {state, reason}}
}

export {
  pushState,
}
