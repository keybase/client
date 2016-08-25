// @flow
import * as Constants from '../../constants/kbfs'
import type {AsyncAction} from '../../constants/types/flux'
import {fsListRpc} from '../../constants/types/flow-types'
import {openInKBFS as platformOpenInKBFS} from './index.platform'

export function fsList (path: string) : AsyncAction {
  return (dispatch) => {
    fsListRpc({
      param: {path},
      callback: (error, result) => {
        console.log('fs.List: ', error, result)
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
    })
  }
}

export function openInKBFS (path: string = ''): AsyncAction {
  return platformOpenInKBFS(path)
}
