// @flow
import * as Constants from '../../constants/config'
import type {AsyncAction, Action} from '../../constants/types/flux'
import {NativeModules} from 'react-native'

export function getDevSettings (): AsyncAction {
  return (dispatch) => {
    dispatch({
      type: Constants.devConfigLoading,
      payload: {},
    })

    NativeModules.App.getDevConfig(devConfig => {
      dispatch({
        type: Constants.devConfigLoaded,
        payload: {devConfig},
      })
    })
  }
}

export function saveDevSettings (): AsyncAction {
  return (dispatch, getState) => {
    const {config: {devConfig}} = getState()

    console.info(devConfig)
    NativeModules.App.setDevConfig(devConfig.configured)

    return dispatch({
      type: Constants.devConfigSaved,
      payload: {},
    })
  }
}

export function updateDevSettings (updates: any): Action {
  return {
    type: Constants.devConfigUpdate,
    payload: {updates},
  }
}

export function readAppVersion () {
  const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine
  const version = nativeBridge.version
  return {
    type: Constants.readAppVersion,
    payload: {version},
  }
}
