/* @flow */

import * as Constants from '../../constants/kbfs'
import type {AsyncAction} from '../../constants/types/flux'
import type {fsListRpc} from '../../constants/types/flow-types'
import engine from '../../engine'

export function fsList (path: string) : AsyncAction {
  return function (dispatch) {
    const params : fsListRpc = {
      method: 'fs.list',
      param: {
        path,
      },
      incomingCallMap: {},
      callback: (error, result) => {
        console.log('fs.list: ', error, result)
        if (error) {
          dispatch({
            type: Constants.fsList,
            payload: error,
            error: true,
          })
        } else {
          dispatch({
            type: Constants.fsList,
            payload: result,
            error: false,
          })
        }
      },
    }

    engine.rpc(params)
  }
}

export function openInKBFS (path: string = ''): AsyncAction {
  return (dispatch, getState) => {}
}
