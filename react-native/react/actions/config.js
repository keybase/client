'use strict'

import { NativeModules } from 'react-native'
import * as types from '../constants/configActionTypes'
import engine from '../engine'

export function getConfig () {
  return function (dispatch) {
    dispatch({
      type: types.CONFIG_LOADING
    })

    engine.rpc('config.getConfig', {}, {}, (error, config) => {
      if (error) {
        dispatch({
          type: types.CONFIG_ERRORED,
          error: error
        })
      } else {
        dispatch({
          type: types.CONFIG_LOADED,
          config: config
        })
      }
    })
  }
}

export function getDevSettings () {
  return function (dispatch) {
    dispatch({
      type: types.DEV_CONFIG_LOADING
    })

    NativeModules.App.getDevConfig((devConfig) => {
      dispatch({
        type: types.DEV_CONFIG_LOADED,
        devConfig
      })
    })
  }
}

export function saveDevSettings () {
  return function (dispatch, getState) {
    const { config: { devConfig } } = getState()

    console.info(devConfig)
    NativeModules.App.setDevConfig(devConfig.configured)

    return dispatch({
      type: types.DEV_CONFIG_SAVED
    })
  }
}

export function updateDevSettings (updates) {
  return {
    type: types.DEV_CONFIG_UPDATE,
    updates
  }
}
