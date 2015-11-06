'use strict'

import * as types from '../constants/devices-action-types'
import engine from '../engine'
import { navigateUpOnUnchanged } from './router'

export function loadDevices () {
  return function (dispatch) {
    dispatch({
      type: types.LOADING_DEVICES
    })

    engine.rpc('device.deviceList', {}, {}, (error, devices) => {
      dispatch({
        type: types.SHOW_DEVICES,
        devices,
        error
      })
    })
  }
}

export function generatePaperKey () {
  return function (dispatch) {
    dispatch({
      type: types.PAPER_KEY_LOADING
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
          type: types.PAPER_KEY_LOADED,
          payload: paperKey
        })
        response.result()
      }
    }

    engine.rpc('login.paperKey', {}, incomingMap, (error, paperKey) => {
      if (error) {
        dispatch({
          type: types.PAPER_KEY_LOADED,
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

    engine.rpc('revoke.revokeDevice', {deviceID, force: false}, incomingMap, (error) => {
      dispatch({
        type: types.DEVICE_REMOVED,
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
