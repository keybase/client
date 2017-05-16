// @flow

import * as Constants from '../constants/gregor'
import type {Dispatch} from '../constants/types/flux'

function nativeReachabilityEvents(dispatch: Dispatch) {
  window.addEventListener('online', () => dispatch({type: Constants.checkReachability, payload: undefined}))
  window.addEventListener('offline', () => dispatch({type: Constants.checkReachability, payload: undefined}))
}

export {nativeReachabilityEvents}
