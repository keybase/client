import * as Constants from '../../constants/config'
import engine from '../../engine'
import * as native from './index.native'

const loggingIncomingMap = {
  'keybase.1.logUi.log': (param, response) => {
    console.log(param)
    response.result()
  }
}

function getConfig (): (dispatch: Dispatch) => Promise<void> {
  return dispatch => {
    return new Promise((resolve, reject) => {
      engine.rpc('config.getConfig', {}, loggingIncomingMap, (error, config) => {
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
      engine.rpc('config.getCurrentStatus', {}, loggingIncomingMap, (error, status) => {
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

export function updateDevSettings (updates) {
  return native.updateDevSettings(updates)
}
