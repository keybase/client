'use strict'

import { NativeModules } from 'react-native'
import * as Constants from '../constants/config'
import { autoLogin } from './login2'
import engine from '../engine'

export function startup () {
  return dispatch => {
    dispatch({type: Constants.startupLoading})

    engine.rpc('config.getConfig', {}, {}, (error, config) => {
      if (error) {
        dispatch({ type: Constants.startupLoaded, payload: error, error: true })
        return
      }
      engine.rpc('config.getCurrentStatus', {}, {}, (error, status) => {
        if (error) {
          dispatch({ type: Constants.startupLoaded, payload: error, error: true })
          return
        }

        dispatch({
          type: Constants.startupLoaded,
          payload: { config, status }
        })

        if (status.loggedIn) {
          dispatch(autoLogin())
        }
      })
    })
  }
}

export function getDevSettings () {
  return dispatch => {
    dispatch({
      type: Constants.devConfigLoading
    })

    NativeModules.App.getDevConfig(devConfig => {
      dispatch({
        type: Constants.devConfigLoaded,
        payload: devConfig
      })
    })
  }
}

export function saveDevSettings () {
  return (dispatch, getState) => {
    const { config: { devConfig } } = getState()

    console.info(devConfig)
    NativeModules.App.setDevConfig(devConfig.configured)

    return dispatch({
      type: Constants.devConfigSaved
    })
  }
}

export function updateDevSettings (updates) {
  return {
    type: Constants.devConfigUpdate,
    payload: updates
  }
}
