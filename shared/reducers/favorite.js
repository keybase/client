// @flow
import * as Constants from '../constants/favorite'
import * as CommonConstants from '../constants/common'
import type {FavoriteAction, FavoriteState} from '../constants/favorite'

const initialState: FavoriteState = {
  folderState: {
    privateBadge: 0,
    private: {
      isPublic: false,
      tlfs: [],
    },
    publicBadge: 0,
    public: {
      isPublic: true,
      tlfs: [],
    },
  },
  viewState: {
    showingPrivate: true,
    publicIgnoredOpen: false,
    privateIgnoredOpen: false,
  },
  kbfsStatus: {
    isAsyncWriteHappening: false,
  },
}

export default function (state: FavoriteState = initialState, action: FavoriteAction): FavoriteState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.markTLFCreated: {
      if (action.error) { break }
      const folderCreated = action.payload.folder
      const stripMetaForCreatedFolder = f => f.sortName === folderCreated.sortName && f.meta === 'new' ? {...f, meta: null} : f
      // TODO(mm) this is ugly. Would be cleaner with immutable
      if (folderCreated.isPublic) {
        return {
          ...state,
          folderState: {
            ...state.folderState,
            public: {
              ...state.folderState.public,
              tlfs: state.folderState.public.tlfs.map(stripMetaForCreatedFolder),
            },
          },
        }
      } else {
        return {
          ...state,
          folderState: {
            ...state.folderState,
            private: {
              ...state.folderState.private,
              tlfs: state.folderState.private.tlfs.map(stripMetaForCreatedFolder),
            },
          },
        }
      }
    }

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
