/* @flow */

import engine from '../engine'
import * as Constants from '../constants/favorite'

import type {Folder, favorite_favoriteList_rpc} from '../constants/types/flow-types'
import type {Dispatch} from '../constants/types/flux'

import type {FavoriteList} from '../constants/favorite'

export function favoriteList (): (dispatch: Dispatch) => void {
  return (dispatch, getState) => {
    const params : favorite_favoriteList_rpc = {
      method: 'favorite.favoriteList',
      param: {},
      incomingCallMap: {},
      callback: (error, folders: Array<Folder>) => {
        if (error) {
          console.warn('Err in favorite.favoriteList', error)
          return
        }

        if (!folders) {
          folders = []
        }

        const config = getState && getState().config
        const currentUser = config && config.status && config.status.user && config.status.user.username

        const action: FavoriteList = {type: Constants.favoriteList, payload: {folders, currentUser}}
        dispatch(action)
      }
    }
    engine.rpc(params)
  }
}
