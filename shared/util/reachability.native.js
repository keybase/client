// @flow

import * as Constants from '../constants/gregor'
import {NetInfo} from 'react-native'
import type {Dispatch} from '../constants/types/flux'

function nativeReachabilityEvents(dispatch: Dispatch) {
  NetInfo.addEventListener('change', () => dispatch({type: Constants.checkReachability, payload: undefined}))
}

export {nativeReachabilityEvents}
