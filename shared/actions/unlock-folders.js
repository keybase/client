/* @flow */

import engine from '../engine'
import HiddenString from '../util/hidden-string'
import * as Constants from '../constants/unlock-folders'
import _ from 'lodash'

import type {TypedAsyncAction} from '../constants/types/flux'
import type {LoadDevices, ToPaperKeyInput, OnBackFromPaperKey, CheckPaperKey, Finish, Close, Waiting,
  RegisterRekeyListenerAction, NewRekeyPopupAction} from '../constants/unlock-folders'
import type {device_deviceList_rpc, incomingCallMapType} from '../constants/types/flow-types'
import type {Dispatch} from '../constants/types/flux'

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

export function registerRekeyListener (): (dispatch: Dispatch) => void {
  return dispatch => {
    // TEMP so we get a callback
    setTimeout(() => {
      const devices = [
        {name: 'a', type: 'desktop', deviceID: 'deadbeef'},
        {name: 'b', type: 'desktop', deviceID: 'deadbeee'},
        {name: 'c', type: 'desktop', deviceID: 'deadbeea'}
      ]
      dispatch(({type: Constants.newRekeyPopup, payload: {devices}}: NewRekeyPopupAction))
    }, 2000)
    // TEMP

    // engine.listenOnConnect('registerRekeyUI', () => {
      // const params: any [> delegateUiCtl_registerRekeyUI_rpc<] = { // TODO real type when register call exists
        // method: 'delegateUiCtl.registerRekeyUI',
        // param: {},
        // incomingCallMap: {},
        // callback: (error, response) => {
          // if (error != null) {
            // console.warn('error in registering rekey ui: ', error)
          // } else {
            // console.log('Registered rekey ui')
          // }
        // }
      // }

      // engine.rpc(params)
    // })

    // dispatch(({type: Constants.registerRekeyListener, payload: {started: true}}: RegisterRekeyListenerAction))

    // const rekeyListeners = rekeyListenersCreator(dispatch)
    // engine.listenGeneralIncomingRpc(rekeyListeners)
  }
}

// function uglyResponse (sessionID: number, result: any, err: ?any): void {
  // const response = uglySessionIDResponseMapper[sessionID]
  // if (response == null) {
    // console.log('lost response reference')
    // return
  // }

  // if (err != null) {
    // response.error(err)
  // } else {
    // response.result(result)
  // }

  // delete uglySessionIDResponseMapper[sessionID]
// }

// const uglySessionIDResponseMapper: {[key: number]: any} = {}
// function rekeyListenersCreator (dispatch: Dispatch): incomingCallMapType {
  // return {
    // 'keybase.1.rekeyUi.refresh': ({sessionID, tlfs}, response) => {
      // console.log('Asked for rekey')

  // // type: DeviceType,
  // // name: string,
  // // deviceID: DeviceID
      // const devices = _.flatten(tlfs.map(t => {
        // return t.solutions.map(s => ( // TODO s is a KID but needs to be something else
          // {
            // name: s,
            // type: 'desktop',
            // deviceID: 'deadbeef'
          // }
        // ))
      // }))

      // dispatch(({type: Constants.newRekeyPopup, payload: {devices}}: NewRekeyPopupAction))

      // response.result()
      // // Maybe we don't need this?
      // // uglySessionIDResponseMapper[sessionID] = response
    // }
  // }
// }

