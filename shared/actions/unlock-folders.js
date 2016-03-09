/* @flow */

import engine from '../engine'
import * as Constants from '../constants/unlock-folders'

import type {TypedAsyncAction} from '../constants/types/flux'
import type {LoadDevices, ToPaperKeyInput, CheckPaperKey, Finish} from '../constants/unlock-folders'
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

export function checkPaperKey (): TypedAsyncAction<CheckPaperKey> {
  return dispatch => {
    // TODO figure out what service request to ask for
    dispatch({type: Constants.checkPaperKey, payload: {success: true}})
  }
}

export function finish (): Finish {
  return {type: Constants.finish, payload: {}}
}
