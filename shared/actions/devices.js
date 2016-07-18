/* @flow */
import * as Constants from '../constants/devices'
import {devicesTab, loginTab} from '../constants/tabs'
import {navigateTo, navigateUp, switchTab} from './router'
import {Map} from 'immutable'
import type {AsyncAction} from '../constants/types/flux'
import {loginDeprovisionRpc, revokeRevokeDeviceRpc, deviceDeviceHistoryListRpc, loginPaperKeyRpc} from '../constants/types/flow-types'
import {setRevokedSelf} from './login'
import HiddenString from '../util/hidden-string'

export function loadDevices () : AsyncAction {
  return function (dispatch) {
    dispatch({
      type: Constants.loadingDevices,
      payload: null,
    })

    deviceDeviceHistoryListRpc({
      callback: (error, devices) => {
        // Flow is weird here, we have to give it true or false directly instead of just giving it !!error
        if (error) {
          dispatch({
            type: Constants.showDevices,
            payload: error,
            error: true,
          })
        } else {
          dispatch({
            type: Constants.showDevices,
            payload: devices,
            error: false,
          })
        }
      },
    })
  }
}

export function generatePaperKey () : AsyncAction {
  return function (dispatch) {
    dispatch({
      type: Constants.paperKeyLoading,
      payload: null,
    })

    const incomingCallMap = {
      'keybase.1.loginUi.promptRevokePaperKeys': (param, response) => {
        response.result(false)
      },
      'keybase.1.secretUi.getPassphrase': (param, response) => {
        console.log(param)
      },
      'keybase.1.loginUi.displayPaperKeyPhrase': ({phrase: paperKey}, response) => {
        dispatch({
          type: Constants.paperKeyLoaded,
          payload: new HiddenString(paperKey),
        })
        response.result()
      },
    }

    loginPaperKeyRpc({
      incomingCallMap,
      callback: (error, paperKey) => {
        if (error) {
          dispatch({
            type: Constants.paperKeyLoaded,
            payload: error,
            error: true,
          })
        }
      },
    })
  }
}

export function removeDevice (deviceID: string, name: string, currentDevice: boolean): AsyncAction {
  return (dispatch, getState) => {
    if (currentDevice) {
      // Revoking the current device uses the "deprovision" RPC instead.
      const username = getState().config.username
      if (!username) {
        console.warn('No username in removeDevice')
        return
      }
      loginDeprovisionRpc({
        param: {username, doRevoke: true},
        callback: error => {
          dispatch({
            type: Constants.deviceRemoved,
            payload: error,
            error: !!error,
          })
          if (!error) {
            dispatch(loadDevices())
            dispatch(setRevokedSelf(name))
            dispatch(navigateTo('', loginTab))
            dispatch(switchTab(loginTab))
          }
        },
      })
    } else {
      revokeRevokeDeviceRpc({
        param: {deviceID, force: false},
        callback: error => {
          dispatch({
            type: Constants.deviceRemoved,
            payload: error,
            error: !!error,
          })
          if (!error) {
            dispatch(loadDevices())
            dispatch(navigateUp(devicesTab, Map({path: 'root'})))
          }
        },
      })
    }
  }
}
