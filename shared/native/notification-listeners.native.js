// @flow
import shared from './notification-listeners.shared'

import type {Dispatch} from '../constants/types/flux'
import type {incomingCallMapType} from '../constants/types/flow-types'

// TODO(mm) Move these to their own actions
export default function(
  dispatch: Dispatch,
  getState: () => Object,
  notify: any
): incomingCallMapType {
  const fromShared = shared(dispatch, getState, notify)
  return {
    ...fromShared,
  }
}
