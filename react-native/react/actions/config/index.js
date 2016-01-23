/* @flow */
import * as Constants from '../../constants/config'
import engine from '../../engine'

// $FlowFixMe
import * as native from './index.native'

import type {Dispatch} from '../../constants/types/flux'

export function getConfig (): (dispatch: Dispatch) => Promise<void> {
  return dispatch => {
    return new Promise((resolve, reject) => {
      engine.rpc('config.getConfig', {}, {}, (error, config) => {
        if (error) {
          reject(error)
        }

        dispatch({type: Constants.configLoaded, payload: {config}})
        resolve()
      })
    })
  }
}

export function getCurrentStatus (): (dispatch: Dispatch) => Promise<void> {
  return dispatch => {
    return new Promise((resolve, reject) => {
      engine.rpc('config.getCurrentStatus', {}, {}, (error, status) => {
        if (error) {
          reject(error)
          return
        }

        dispatch({
          type: Constants.statusLoaded,
          payload: {status}
        })

        resolve()
      })
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
