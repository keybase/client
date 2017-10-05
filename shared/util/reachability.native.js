// @flow

import * as Constants from '../constants/gregor'
import {NetInfo} from 'react-native'
import type {Dispatch} from '../constants/types/flux'

function nativeReachabilityEvents(dispatch: Dispatch) {
  NetInfo.addEventListener('connectionChange', () =>
    dispatch({type: Constants.checkReachability, payload: undefined})
  )
}

export {nativeReachabilityEvents}
