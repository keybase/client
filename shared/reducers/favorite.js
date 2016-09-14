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
  viewState: {
    showingPrivate: true,
    publicIgnoredOpen: false,
    privateIgnoredOpen: false,
  },
}

export default function (state: FavoriteState = initialState, action: FavoriteAction): FavoriteState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.favoriteListed:
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
        viewState: {
          ...state.viewState,
          showingPrivate: action.payload.showingPrivate,
        },
      }

    case Constants.favoriteToggleIgnored:
      if (action.error) {
        break
      }
      return {
        ...state,
        viewState: {
          ...state.viewState,
          publicIgnoredOpen: action.payload.isPrivate ? state.viewState.publicIgnoredOpen : !state.viewState.publicIgnoredOpen,
          privateIgnoredOpen: action.payload.isPrivate ? !state.viewState.privateIgnoredOpen : state.viewState.privateIgnoredOpen,
        },
      }

    default:
      break
  }

  return state
}
