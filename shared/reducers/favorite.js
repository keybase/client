// @flow
import * as Constants from '../constants/favorite'
import * as CommonConstants from '../constants/common'
import type {FavoriteAction} from '../constants/favorite'
import type {Props} from '../folders/render'

type State = {
  folders: ?Props
}

const initialState = {
  folders: null,
}

export default function (state: State = initialState, action: FavoriteAction): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.favoriteList:
      return {
        ...state,
        folders: action.payload && action.payload.folders,
      }
    default:
      return state
  }
}
