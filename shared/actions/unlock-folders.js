/* @flow */

import * as Constants from '../constants/unlock-folders'
import {routeAppend} from '../actions/router'

import type {RouteAppend} from '../constants/router'
import type {TypedAsyncAction} from '../constants/types/flux'
import type {LoadDevices, ToPaperKeyInput, CheckPaperKey, Finish, Close} from '../constants/unlock-folders'

// TODO this won't work in a remote component until we have a synchronous way to get the latest state in a remote component.

function nextPhase (): TypedAsyncAction<RouteAppend> {
  return (dispatch, getState) => {
    // TODO careful here since this will not be sync on a remote component!
    const phase: string = getState().unlockFolders.phase
    dispatch(routeAppend(phase))
  }
}

export function loadDevice (): TypedAsyncAction<LoadDevices | RouteAppend> {
  return dispatch => {
    // TODO: make engine call to get devices
    dispatch({type: Constants.loadDevices, payload: {devices: []}})
    // Then we go to the navigate to the next phase that the reducer determined
    dispatch(nextPhase())
  }
}

export function toPaperKeyInput (): TypedAsyncAction<ToPaperKeyInput> {
  return dispatch => {}
}

export function checkPaperKey (): TypedAsyncAction<CheckPaperKey> {
  return dispatch => {}
}

export function finish (): TypedAsyncAction<Finish> {
  return dispatch => {}
}

export function close (): Close {
  return {type: Constants.close, payload: {}}
}
