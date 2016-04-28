/* @flow */
import * as Constants from '../constants/devices'
import engine from '../engine'
import {navigateUpOnUnchanged} from './router'
import type {AsyncAction} from '../constants/types/flux'
import type {incomingCallMapType, revoke_revokeDevice_rpc, device_deviceList_rpc, login_paperKey_rpc} from '../constants/types/flow-types'
// import {loginTab} from '../constants/tabs'

export function loadDevices () : AsyncAction {
  return function (dispatch) {
    dispatch({
      type: Constants.loadingDevices,
      payload: null
    })

    const params : device_deviceList_rpc = {
      method: 'device.deviceList',
      param: {},
      incomingCallMap: {},
      callback: (error, devices) => {
        // Flow is weird here, we have to give it true or false directly instead of just giving it !!error
        if (error) {
          dispatch({
            type: Constants.showDevices,
            payload: error,
            error: true
          })
        } else {
          dispatch({
            type: Constants.showDevices,
            payload: devices,
            error: false
          })
        }
        // dispatch()
      }
    }

    engine.rpc(params)
  }
}

export function generatePaperKey () : AsyncAction {
  return function (dispatch) {
    dispatch({
      type: Constants.paperKeyLoading,
      payload: null
    })

    const incomingMap : incomingCallMapType = {
      'keybase.1.loginUi.promptRevokePaperKeys': (param, response) => {
        response.result(false)
      },
      'keybase.1.secretUi.getPassphrase': (param, response) => {
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

    const params : login_paperKey_rpc = {
      method: 'login.paperKey',
      param: {},
      incomingCallMap: incomingMap,
      callback: (error, paperKey) => {
        if (error) {
          dispatch({
            type: Constants.paperKeyLoaded,
            payload: error,
            error: true
          })
        }
      }
    }

    engine.rpc(params)
  }
}

export function removeDevice (deviceID: string) : AsyncAction {
  return navigateUpOnUnchanged((dispatch, getState, maybeNavigateUp) => {
    const params : revoke_revokeDevice_rpc = {
      method: 'revoke.revokeDevice',
      param: {deviceID, force: false},
      incomingCallMap: {},
      callback: error => {
        dispatch({
          type: Constants.deviceRemoved,
          payload: error,
          error: !!error
        })

        // TODO when device page is integrated
        // if (wasCurrentDevice) {
          // dispatch(setRevokedSelf(oldCurrentDeviceName))
          // dispatch(navigateTo('', loginTab))
          // dispatch(switchTab(loginTab))
        // } else

        if (!error) {
          dispatch(loadDevices())
          maybeNavigateUp()
        }
      }
    }

    engine.rpc(params)
  })
}
