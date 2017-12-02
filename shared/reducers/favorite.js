// @flow
import * as Constants from '../constants/favorite'
import * as Types from '../constants/types/favorite'
import * as FavoriteGen from '../actions/favorite-gen'
import * as KBFSGen from '../actions/kbfs-gen'

// TODO use immutable for this when we rewrite it for the in-app-finder
export default function(
  state: Types.State = Constants.initialState,
  action: FavoriteGen.Actions | KBFSGen.Actions
): Types.State {
  switch (action.type) {
    case FavoriteGen.resetStore:
      return {...Constants.initialState}

    case FavoriteGen.markTLFCreated: {
      const folderCreated = action.payload.folder
      const stripMetaForCreatedFolder = f =>
        f.sortName === folderCreated.sortName && f.meta === 'new' ? {...f, meta: null} : f
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

    case FavoriteGen.favoriteListed:
      return {
        ...state,
        folderState: action.payload.folders,
      }

    case FavoriteGen.favoriteSwitchTab:
      return {
        ...state,
        viewState: {
          ...state.viewState,
          showingPrivate: action.payload.showingPrivate,
        },
      }

    case FavoriteGen.favoriteToggleIgnored:
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

    case FavoriteGen.kbfsStatusUpdated:
      const {status} = action.payload
      return {
        ...state,
        kbfsStatus: status,
      }

    case KBFSGen.fuseStatus:
      return {
        ...state,
        fuseStatusLoading: true,
      }
    case KBFSGen.fuseStatusUpdate:
      return {
        ...state,
        fuseStatus: action.payload.status,
        fuseStatusLoading: false,
      }
    case KBFSGen.installFuse:
      return {
        ...state,
        fuseInstalling: true,
        kextPermissionError: false,
      }
    case KBFSGen.installFuseResult:
      const {kextPermissionError} = action.payload
      return {
        ...state,
        kextPermissionError,
      }
    case KBFSGen.installFuseFinished:
      return {
        ...state,
        fuseInstalling: false,
      }
    case KBFSGen.clearFuseInstall:
      return {
        ...state,
        fuseInstalling: false,
        kextPermissionError: false,
      }
    case KBFSGen.installKBFS:
      return {
        ...state,
        kbfsInstalling: true,
      }

    case KBFSGen.installKBFSFinished:
      return {
        ...state,
        kbfsInstalling: false,
      }
    case KBFSGen.openDefaultPath:
      const {opening} = action.payload
      return {
        ...state,
        kbfsOpening: opening,
      }
    // Saga only actions
    case FavoriteGen.favoriteAdd:
    case FavoriteGen.favoriteAdded:
    case FavoriteGen.favoriteIgnore:
    case FavoriteGen.favoriteIgnored:
    case FavoriteGen.favoriteList:
    case FavoriteGen.setupKBFSChangedHandler:
    case KBFSGen.installKBFSResult:
    case KBFSGen.list:
    case KBFSGen.listed:
    case KBFSGen.open:
    case KBFSGen.openInFileUI:
    case KBFSGen.uninstallKBFS:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
