/* @flow */
import * as Constants from '../../constants/config'
import engine from '../../engine'

import {switchTab} from '../../actions/tabbed-router'
import {navigateTo} from '../../actions/router'
import {loginTab, moreTab} from '../../constants/tabs'

// $FlowFixMe
import * as native from './index.native'

import type {AsyncAction} from '../../constants/types/flux'
import type {config_getConfig_rpc, config_getExtendedStatus_rpc, config_getCurrentStatus_rpc} from '../../constants/types/flow-types'

function switchTabs(dispatch, getState) {
  const {config: {status}} = getState()
  if (!status) {
    return
  }

  if (!status.registered) {
    dispatch(switchTab(loginTab))
    // dispatch(navigateTo([]))
  } else if (!status.loggedIn) {
    dispatch(switchTab(loginTab))
    // dispatch(navigateTo(['login']))
  } else if (status.loggedIn) {
    dispatch(switchTab(moreTab))
    dispatch(navigateTo([]))
  }
}

export function getConfig (): AsyncAction {
  return (dispatch, getState) => {
    return new Promise((resolve, reject) => {
      const params : config_getConfig_rpc = {
        method: 'config.getConfig',
        param: {},
        incomingCallMap: {},
        callback: (error, config) => {
          if (error) {
            reject(error)
          }

          dispatch({type: Constants.configLoaded, payload: {config}})
          switchTabs(dispatch, getState)
          resolve()
        }
      }

      engine.rpc(params)
    })
  }
}

export function getExtendedConfig (): AsyncAction {
  return dispatch => {
    return new Promise((resolve, reject) => {
      const params : config_getExtendedStatus_rpc = {
        method: 'config.getExtendedStatus',
        param: {},
        incomingCallMap: {},
        callback: (error, extendedConfig) => {
          if (error) {
            reject(error)
          }

          dispatch({type: Constants.extendedConfigLoaded, payload: {extendedConfig}})
          resolve(extendedConfig)
        }
      }

      engine.rpc(params)
    })
  }
}

export function getCurrentStatus (): AsyncAction {
  return dispatch => {
    return new Promise((resolve, reject) => {
      const params : config_getCurrentStatus_rpc = {
        method: 'config.getCurrentStatus',
        param: {},
        incomingCallMap: {},
        callback: (error, status) => {
          if (error) {
            reject(error)
            return
          }

          dispatch({
            type: Constants.statusLoaded,
            payload: {status}
          })

          resolve()
        }
      }

      engine.rpc(params)
    })
  }
}

export function getDevSettings () {
  return native.getDevSettings()
}

export function saveDevSettings () {
  return native.saveDevSettings()
}

export function updateDevSettings (updates: any) {
  return native.updateDevSettings(updates)
}
