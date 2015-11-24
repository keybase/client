import * as Constants from '../constants/devices'
import engine from '../engine'
import {navigateUpOnUnchanged} from './router'

export function loadDevices () {
  return function (dispatch) {
    dispatch({
      type: Constants.loadingDevices
    })

    engine.rpc('device.deviceList', {}, {}, (error, devices) => {
      dispatch({
        type: Constants.showDevices,
        payload: error || devices,
        error: !!error
      })
    })
  }
}

export function generatePaperKey () {
  return function (dispatch) {
    dispatch({
      type: Constants.paperKeyLoading
    })

    const incomingMap = {
      'keybase.1.loginUi.promptRevokePaperKeys': (param, response) => {
        response.result(false)
      },
      'keybase.1.secretUi.getSecret': (param, response) => {
        console.log(param)
      },
      'keybase.1.loginUi.displayPaperKeyPhrase': ({phrase: paperKey}, response) => {
        dispatch({
          type: Constants.paperKeyLoaded,
          payload: paperKey
        })
        response.result()
      }
    }

    engine.rpc('login.paperKey', {}, incomingMap, (error, paperKey) => {
      if (error) {
        dispatch({
          type: Constants.paperKeyLoaded,
          payload: error,
          error: true
        })
      }
    })
  }
}

export function removeDevice (deviceID) {
  return navigateUpOnUnchanged((dispatch, getState, maybeNavigateUp) => {
    const incomingMap = {
      'keybase.1.logUi.log': (param, response) => {
        console.log(param)
        response.result()
      }
    }

    engine.rpc('revoke.revokeDevice', {deviceID, force: false}, incomingMap, error => {
      dispatch({
        type: Constants.deviceRemoved,
        payload: error,
        error: !!error
      })

      if (!error) {
        dispatch(loadDevices())
        maybeNavigateUp()
      }
    })
  })
}
