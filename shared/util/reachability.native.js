// @flow
import * as GregorGen from '../actions/gregor-gen'
import {NetInfo} from 'react-native'
import type {Dispatch} from '../constants/types/flux'

function nativeReachabilityEvents(dispatch: Dispatch) {
  NetInfo.addEventListener('connectionChange', () => dispatch(GregorGen.createCheckReachability()))
}

export {nativeReachabilityEvents}
