import {NativeModules} from 'react-native'
import * as Constants from '../../constants/config'

export function getDevSettings () {
  return function (dispatch) {
    dispatch({
      type: Constants.devConfigLoading,
    })

    NativeModules.App.getDevConfig(devConfig => {
      dispatch({
        type: Constants.devConfigLoaded,
        payload: {devConfig},
      })
    })
  }
}

export function saveDevSettings () {
  return function (dispatch, getState) {
    const {config: {devConfig}} = getState()

    console.info(devConfig)
    NativeModules.App.setDevConfig(devConfig.configured)

    return dispatch({type: Constants.devConfigSaved})
  }
}

export function updateDevSettings (updates) {
  return {
    type: Constants.devConfigUpdate,
    payload: {updates},
  }
}
