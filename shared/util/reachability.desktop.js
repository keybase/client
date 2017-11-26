// @flow
import * as GregorGen from '../actions/gregor-gen'
import type {Dispatch} from '../constants/types/flux'

function nativeReachabilityEvents(dispatch: Dispatch) {
  window.addEventListener('online', () => dispatch(GregorGen.createCheckReachability()))
  window.addEventListener('offline', () => dispatch(GregorGen.createCheckReachability()))
}

export {nativeReachabilityEvents}
