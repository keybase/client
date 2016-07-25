// @flow
import * as Constants from '../constants/favorite'
import * as CommonConstants from '../constants/common'
import type {FavoriteAction, FavoriteState} from '../constants/favorite'

const initialState: FavoriteState = {
  folderState: {
    privateBadge: 0,
    private: {
      isPublic: false,
    },
    publicBadge: 0,
    public: {
      isPublic: true,
    },
  },
  showingPrivate: true,
}

export default function (state: FavoriteState = initialState, action: FavoriteAction): FavoriteState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.favoriteList:
      if (action.error) {
        break
      }
      return {
        ...state,
        folderState: action.payload.folders,
      }

    case Constants.favoriteSwitchTab:
      if (action.error) {
        break
      }
      return {
        ...state,
        showingPrivate: action.payload.showingPrivate,
      }

    default:
      break
  }

  return state
}
