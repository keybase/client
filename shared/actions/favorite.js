/* @flow */

import engine from '../engine'
import * as Constants from '../constants/favorite'

import type {Folder} from '../constants/types/flow-types'
import type {Dispatch} from '../constants/types/flux'

import type {FavoriteList} from '../constants/favorite'

export function favoriteList (): (dispatch: Dispatch) => void {
  return dispatch => {
    engine.rpc('favorite.favoriteList', {}, {}, (error, folders: Array<Folder>) => {
      if (error) {
        console.error('Err in favorite.favoriteList', error)
        return
      }

      const action: FavoriteList = {type: Constants.favoriteList, payload: {folders}}
      dispatch(action)
    })
  }
}
