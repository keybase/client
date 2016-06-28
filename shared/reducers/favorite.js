// @flow
import * as Constants from '../constants/favorite'
import * as CommonConstants from '../constants/common'
import type {FavoriteAction, State} from '../constants/favorite'

const initialState: State = {
  privateBadge: 0,
  private: {
    isPublic: false,
  },
  publicBadge: 0,
  public: {
    isPublic: true,
  },
}

export default function (state: State = initialState, action: FavoriteAction): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.favoriteList:
      return {
        ...state,
        ...(action.payload && action.payload.folders),
      }
    default:
      return state
  }
}
