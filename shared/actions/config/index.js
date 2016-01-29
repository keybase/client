/* @flow */
import * as Constants from '../../constants/config'
import engine from '../../engine'

// $FlowFixMe
import * as native from './index.native'

import type {AsyncAction} from '../../constants/types/flux'
import type {config_getConfig_rpc, config_getCurrentStatus_rpc} from '../../constants/types/flow-types'

export function getConfig (): AsyncAction {
  return dispatch => {
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
          resolve()
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
