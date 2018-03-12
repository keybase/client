// @flow
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: FsGen.Actions) {
  switch (action.type) {
    case FsGen.resetStore:
      return initialState
    case FsGen.folderListLoaded: {
      const toMerge = action.payload.pathItems.filter((item, path) => {
        if (item.type !== 'folder') {
          return true
        }
        const original = state.pathItems.get(path)
        if (original && original.progress === 'loaded' && item.progress === 'pending') {
          // Don't override a loaded item into pending. This is specifically
          // for the case where user goes back out of a folder where we could
          // override the folder into an empty one. With this, next user
          // navigates into the folder they would see the old list (instead of
          // placeholder), which then gets updated when we hear back from RPC.
          return false
        }
        return true
      })
      return state
        .mergeIn(['pathItems'], toMerge)
        .update('loadingPaths', loadingPaths => loadingPaths.delete(action.payload.path))
    }
    case FsGen.folderListLoad:
      return state.update('loadingPaths', loadingPaths => loadingPaths.add(action.payload.path))
    case FsGen.sortSetting:
      return state.setIn(['pathUserSettings', action.payload.path, 'sort'], action.payload.sortSetting)
    case FsGen.downloadStarted: {
      const {key, path, localPath} = action.payload
      const item = state.pathItems.get(path)
      return state.setIn(
        ['transfers', key],
        Constants.makeTransferState({
          type: 'download',
          entryType: item ? item.type : 'unknown',
          path,
          localPath,
          completePortion: 0,
          isDone: false,
          startedAt: Date.now(),
        })
      )
    }
    case FsGen.fileTransferProgress: {
      const {key, completePortion} = action.payload
      return state.updateIn(['transfers', key], (original: Types.TransferState) =>
        original.set('completePortion', completePortion)
      )
    }
    case FsGen.downloadFinished: {
      const {key, error} = action.payload
      return state.updateIn(['transfers', key], (original: Types.TransferState) =>
        original.set('isDone', true).set('error', error)
      )
    }
    case FsGen.dismissTransfer: {
      return state.removeIn(['transfers', action.payload.key])
    }
    case FsGen.download:
    case FsGen.openInFileUI:
      return state
    case FsGen.fuseStatus:
      return state
    case FsGen.fuseStatusResult:
      return {
        ...state,
        fuseStatus: action.payload.status,
      }
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
