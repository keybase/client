// @flow

import * as Constants from '../constants/gregor'
import {NetInfo} from 'react-native'

function nativeReachabilityEvents (dispatch) {
  NetInfo.addEventListener(
    'change',
    () => dispatch({type: Constants.checkReachability, payload: undefined})
  )
}

export {
  nativeReachabilityEvents,
}
