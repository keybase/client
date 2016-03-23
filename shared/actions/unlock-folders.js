/* @flow */

import engine from '../engine'
import HiddenString from '../util/hidden-string'
import * as Constants from '../constants/unlock-folders'

import type {TypedAsyncAction} from '../constants/types/flux'
import type {LoadDevices, ToPaperKeyInput, OnBackFromPaperKey, CheckPaperKey, Finish, Close, Waiting} from '../constants/unlock-folders'
import type {device_deviceList_rpc} from '../constants/types/flow-types'

export function loadDevice (): TypedAsyncAction<LoadDevices> {
  return dispatch => {
    const params : device_deviceList_rpc = {
      method: 'device.deviceList',
      param: {},
      incomingCallMap: {},
      callback: (error, devices) => {
        if (error) {
          console.log('Error fetching devices. Not handling this error')
          dispatch({
            type: Constants.loadDevices,
            error: true,
            payload: {error}
          })
        } else {
          dispatch({
            type: Constants.loadDevices,
            payload: {devices}
          })
        }
      }
    }

    engine.rpc(params)
  }
}

export function toPaperKeyInput (): ToPaperKeyInput {
  return {type: Constants.toPaperKeyInput, payload: {}}
}

export function onBackFromPaperKey (): OnBackFromPaperKey {
  return {type: Constants.onBackFromPaperKey, payload: {}}
}

function waiting (currentlyWaiting: boolean): Waiting {
  return {type: Constants.waiting, payload: currentlyWaiting}
}

export function checkPaperKey (paperKey: HiddenString): TypedAsyncAction<CheckPaperKey | Waiting> {
  return dispatch => {
    // TODO figure out what service request to ask for
    // TODO Use the waiting ability of the engine instead of manually dispatching

    dispatch(waiting(true))
    setTimeout(() => {
      dispatch(waiting(false))
      dispatch({type: Constants.checkPaperKey, payload: {success: true}})
    }, 1e3)
  }
}

export function finish (): Finish {
  return {type: Constants.finish, payload: {}}
}

export function close (): Close {
  return {type: Constants.close, payload: {}}
}
