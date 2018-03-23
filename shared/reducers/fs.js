// @flow
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: FsGen.Actions) {
  switch (action.type) {
    case FsGen.resetStore:
      return initialState
    case FsGen.filePreviewLoad:
      return state
    case FsGen.filePreviewLoaded:
      return state.update('pathItems', metas => metas.set(action.payload.path, action.payload.meta))
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
      const {key, path, localPath, intent} = action.payload
      const item = state.pathItems.get(path)
      return state.setIn(
        ['transfers', key],
        Constants.makeTransferState({
          type: 'download',
          entryType: item ? item.type : 'unknown',
          intent,
          path,
          localPath,
          completePortion: 0,
          isDone: false,
          startedAt: Date.now(),
        })
      )
    }
    case FsGen.fileTransferProgress: {
      const {key, completePortion, endEstimate} = action.payload
      return state.updateIn(['transfers', key], (original: Types.TransferState) =>
        original.set('completePortion', completePortion).set('endEstimate', endEstimate)
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
    case FsGen.fuseStatusResult:
      return state.merge({fuseStatus: action.payload.status})
    case FsGen.setFlags:
      return state.merge(action.payload)
    case FsGen.installFuse:
      return state.merge({fuseInstalling: true, kextPermissionError: false})
    case FsGen.installFuseResult:
      // To prevent races, we overlap flags set to true. So we don't unset the
      // fuseInstalling flag here.
      return state.merge(action.payload)
    case FsGen.installKBFS:
      return state.merge({kbfsInstalling: true})
    case FsGen.download:
    case FsGen.openInFileUI:
    case FsGen.fuseStatus:
    case FsGen.uninstallKBFSConfirm:
    case FsGen.uninstallKBFS:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
