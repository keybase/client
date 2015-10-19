'use strict'

import { NativeModules } from 'react-native'
import * as types from '../constants/config-action-types'
import { autoLogin } from './login'
import engine from '../engine'

export function startup () {
  return function (dispatch) {
    dispatch({type: types.STARTUP_LOADING})

    engine.rpc('config.getConfig', {}, {}, (error, config) => {
      if (error) {
        dispatch({ type: types.STARTUP_LOADED, payload: error, error: true })
      } else {
        engine.rpc('config.getCurrentStatus', {}, {}, (error, status) => {
          if (error) {
            dispatch({ type: types.STARTUP_LOADED, payload: error, error: true })
          } else {
            dispatch({
              type: types.STARTUP_LOADED,
              payload: { config, status }
            })

            if (status.loggedIn) {
              dispatch(autoLogin())
            }
          }
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
