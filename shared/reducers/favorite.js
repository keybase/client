/* @flow */

import * as Constants from '../constants/favorite'
import {logoutDone} from '../constants/login'
import type {FavoriteAction} from '../constants/favorite'
import type {Folder} from '../constants/types/flow-types'

type State = {
  folders: ?Array<Folder>
}

const initialState = {
  folders: null
}

export default function (state: State = initialState, action: FavoriteAction): State {
  switch (action.type) {
    case Constants.favoriteList:
      return {
        ...state,
        folders: action.payload && action.payload.folders
      }
    case logoutDone: {
      return {
        ...state,
        folders: null
      }
    }
    default:
      return state
  }
}
