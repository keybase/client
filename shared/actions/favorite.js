/* @flow */

import engine from '../engine'
import * as Constants from '../constants/favorite'

import type {Folder, favorite_favoriteList_rpc} from '../constants/types/flow-types'
import type {Dispatch} from '../constants/types/flux'

import type {FavoriteList} from '../constants/favorite'

export function favoriteList (): (dispatch: Dispatch) => void {
  return dispatch => {
    const params : favorite_favoriteList_rpc = {
      method: 'favorite.favoriteList',
      param: {},
      incomingCallMap: {},
      callback: (error, folders: Array<Folder>) => {
        if (error) {
          console.error('Err in favorite.favoriteList', error)
          return
        }

        if (!folders) {
          folders = []
        }

        const action: FavoriteList = {type: Constants.favoriteList, payload: {folders}}
        dispatch(action)
      }
    }
    engine.rpc(params)
  }
}
