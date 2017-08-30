// @flow
import * as Constants from '../constants/favorite'
import * as CommonConstants from '../constants/common'

const initialState: Constants.State = {
  folderState: {
    private: {
      isPublic: false,
      tlfs: [],
    },
    privateBadge: 0,
    public: {
      isPublic: true,
      tlfs: [],
    },
    publicBadge: 0,
  },
  fuseInstalling: false,
  fuseStatus: null,
  fuseStatusLoading: false,
  kbfsInstalling: false,
  kbfsOpening: false,
  kbfsStatus: {
    isAsyncWriteHappening: false,
  },
  kextPermissionError: false,
  viewState: {
    privateIgnoredOpen: false,
    publicIgnoredOpen: false,
    showingPrivate: true,
  },
}

export default function(
  state: Constants.State = initialState,
  action: Constants.FavoriteAction
): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.markTLFCreated: {
      if (action.error) {
        break
      }
      const folderCreated = action.payload.folder
      const stripMetaForCreatedFolder = f =>
        f.sortName === folderCreated.sortName && f.meta === 'new' ? {...f, meta: null} : f
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
          privateIgnoredOpen: action.payload.isPrivate
            ? !state.viewState.privateIgnoredOpen
            : state.viewState.privateIgnoredOpen,
          publicIgnoredOpen: action.payload.isPrivate
            ? state.viewState.publicIgnoredOpen
            : !state.viewState.publicIgnoredOpen,
        },
      }

    case Constants.kbfsStatusUpdated:
      return {
        ...state,
        kbfsStatus: action.payload,
      }

    case 'fs:fuseStatus':
      return {
        ...state,
        fuseStatusLoading: true,
      }
    case 'fs:fuseStatusUpdate':
      return {
        ...state,
        fuseStatus: action.payload.status,
        fuseStatusLoading: false,
      }
    case 'fs:installFuse':
      return {
        ...state,
        fuseInstalling: true,
        kextPermissionError: false,
      }
    case 'fs:installFuseResult':
      const {kextPermissionError} = action.payload
      return {
        ...state,
        kextPermissionError,
      }
    case 'fs:installFuseFinished':
      return {
        ...state,
        fuseInstalling: false,
      }
    case 'fs:clearFuseInstall':
      return {
        ...state,
        fuseInstalling: false,
        kextPermissionError: false,
      }
    case 'fs:installKBS':
      return {
        ...state,
        kbfsInstalling: true,
      }

    case 'fs:installKBSFinished':
      return {
        ...state,
        kbfsInstalling: false,
      }
    case 'fs:openDefaultPath':
      const {opening} = action.payload
      return {
        ...state,
        kbfsOpening: opening,
      }

    default:
      break
  }

  return state
}
