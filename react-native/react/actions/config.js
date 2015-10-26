'use strict'

import { NativeModules } from 'react-native'
import * as LoginConstants from '../constants/login2'
import * as Constants from '../constants/config'
import { autoLogin } from './login2'
import engine from '../engine'
import * as LocalDebug from '../local-debug'

export function startup () {
  return function (dispatch) {
    dispatch({type: Constants.startupLoading})

    const getConfig = new Promise((resolve, reject) => {
      engine.rpc('config.getConfig', {}, {}, (error, config) => {
        if (error && !LocalDebug.allowStartupFailure) {
          reject(new Error(error))
        } else {
          resolve(config)
        }
      })
    })

    const getStatus = new Promise((resolve, reject) => {
      engine.rpc('config.getCurrentStatus', {}, {}, (error, status) => {
        if (error && !LocalDebug.allowStartupFailure) {
          reject(new Error(error))
        } else {
          resolve(status)
        }
      })
    })

    const getConfiguredAccounts = new Promise((resolve, reject) => {
      engine.rpc('login.getConfiguredAccounts', {}, {}, (error, configuredAccounts) => {
        if (error && !LocalDebug.allowStartupFailure) {
          reject(new Error(error))
        } else {
          resolve(configuredAccounts)
        }
      })
    })

    Promise.all([getConfig, getStatus, getConfiguredAccounts]).then(([config, status, configuredAccounts]) => {
      dispatch({
        type: Constants.startupLoaded,
        payload: { config, status, configuredAccounts }
      })

      if (status) {
        if (!status.registered) {
          dispatch({ type: LoginConstants.needsRegistering })
        } else if (!status.loggedIn) {
          dispatch({ type: LoginConstants.needsLogin })
        }

        if (status.loggedIn) {
          dispatch(autoLogin())
        }
      }
    }).catch(error => {
      dispatch({ type: Constants.startupLoaded, payload: error, error: true })
    })
  }
}

export function getDevSettings () {
  return function (dispatch) {
    dispatch({
      type: Constants.devConfigLoading
    })

    NativeModules.App.getDevConfig((devConfig) => {
      dispatch({
        type: Constants.devConfigLoaded,
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
      type: Constants.devConfigSaved
    })
  }
}

export function updateDevSettings (updates) {
  return {
    type: Constants.devConfigUpdate,
    updates
  }
}
