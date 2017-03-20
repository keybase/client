// @flow

import * as Constants from '../constants/gregor'

function nativeReachabilityEvents (dispatch) {
  window.addEventListener('online', () => dispatch({type: Constants.checkReachability, payload: undefined}))
  window.addEventListener('offline', () => dispatch({type: Constants.checkReachability, payload: undefined}))
}

export {
  nativeReachabilityEvents,
}
