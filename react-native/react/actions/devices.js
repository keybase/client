'use strict'

import * as types from '../constants/devicesActionTypes'
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
