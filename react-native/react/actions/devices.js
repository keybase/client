'use strict'

import * as types from '../constants/devices-action-types'
import engine from '../engine'

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
      }
    }

    /*
    engine.rpc('login.paperKey', {}, incomingMap, (error, paperKey) => {
      dispatch({
        type: types.PAPER_KEY_LOADED,
        payload: error ? error : paperKey,
        error: !!error
      })
    })
    */

     const error = null
     const paperKey = 'TODO call engine: 123'
     setTimeout(() => {
        dispatch({
          type: types.PAPER_KEY_LOADED,
          payload: error ? error : paperKey,
          error: !!error
        })
     }, 1000)
  }
}

export function removeDevice (deviceID) {
  return function (dispatch) {
    setTimeout( () => {
      console.log('TODO REMOVE DEVICE:', deviceID)
    }, 1000)
  }
}
