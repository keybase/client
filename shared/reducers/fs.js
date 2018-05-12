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
      const toMerge = action.payload.pathItems.map((item, path) => {
        if (item.type !== 'folder') return item
        const original = state.pathItems.get(path)
        if (!original || original.type !== 'folder') return item
        if (original.progress === 'loaded' && item.progress === 'pending') {
          // Don't override a loaded item into pending. This is specifically
          // for the case where user goes back out of a folder where we could
          // override the folder into an empty one. With this, next user
          // navigates into the folder they would see the old list (instead of
          // placeholder), which then gets updated when we hear back from RPC.
          return original
        }
        // Since both `folderListLoaded` and `favoritesLoaded` can change
        // `pathItems`, we need to make sure that neither one clobbers the
        // other's work.
        return item
          .set('badgeCount', original.badgeCount)
          .set('tlfMeta', original.tlfMeta)
          .set('favoriteChildren', original.favoriteChildren)
      })
      const s = state
        .mergeIn(['pathItems'], toMerge)
        .update('loadingPaths', loadingPaths => loadingPaths.delete(action.payload.path))
      return s
    }
    case FsGen.folderListLoad:
      return state.update('loadingPaths', loadingPaths => loadingPaths.add(action.payload.path))
    case FsGen.favoritesLoad:
      return state
    case FsGen.favoritesLoaded:
      const toMerge = action.payload.folders.mapEntries(([path, item]) => {
        // We ForceType because Flow keeps thinking this is a _PathItem not a FolderPathItem.
        const original: $ForceType = state.pathItems.get(path) || Constants.makeFolder({name: item.name})
        // This cannot happen, but it's needed to make Flow happy.
        if (original.type !== 'folder') return [path, original]

        return [
          path,
          // Since both `folderListLoaded` and `favoritesLoaded` can change
          // `pathItems`, we need to make sure that neither one clobbers the
          // other's work.
          original
            .set('badgeCount', item.badgeCount)
            .set('tlfMeta', item.tlfMeta)
            .set('favoriteChildren', item.favoriteChildren),
        ]
      })
      const s = state.mergeIn(['pathItems'], toMerge)
      return s
    case FsGen.sortSetting:
      const {path, sortSetting} = action.payload
      return state.setIn(['pathUserSettings', path, 'sort'], sortSetting)
    case FsGen.downloadStarted: {
      const {key, path, localPath, intent, opID} = action.payload
      const item = state.pathItems.get(path)
      return state.setIn(
        ['transfers', key],
        Constants.makeTransfer({
          meta: Constants.makeTransferMeta({
            type: 'download',
            entryType: item ? item.type : 'unknown',
            intent,
            path,
            localPath,
            opID,
          }),
          state: Constants.makeTransferState({
            completePortion: 0,
            isDone: false,
            startedAt: Date.now(),
          }),
        })
      )
    }
    case FsGen.transferProgress: {
      const {key, completePortion, endEstimate} = action.payload
      return state.updateIn(['transfers', key, 'state'], (original: Types.TransferState) =>
        original.set('completePortion', completePortion).set('endEstimate', endEstimate)
      )
    }
    case FsGen.downloadFinished: {
      const {key, error} = action.payload
      return state.updateIn(['transfers', key, 'state'], (original: Types.TransferState) =>
        original.set('isDone', true).set('error', error)
      )
    }
    case FsGen.dismissTransfer: {
      return state.removeIn(['transfers', action.payload.key])
    }
    case FsGen.fuseStatusResult:
      return state.merge({fuseStatus: action.payload.status})
    case FsGen.setFlags:
      return state.mergeIn(['flags'], action.payload)
    case FsGen.installFuse:
      return state.mergeIn(['flags'], {fuseInstalling: true, kextPermissionError: false})
    case FsGen.installFuseResult:
      // To prevent races, we overlap flags set to true. So we don't unset the
      // fuseInstalling flag here.
      return state.mergeIn(['flags'], action.payload)
    case FsGen.installKBFS:
      return state.mergeIn(['flags'], {kbfsInstalling: true})
    case FsGen.localHTTPServerInfo:
      return state.set('localHTTPServerInfo', Constants.makeLocalHTTPServer(action.payload))
    case FsGen.favoriteIgnore:
      return state.mergeIn(['pathItems', Types.pathToString(action.payload.path), 'tlfMeta'], {
        isIgnored: true,
      })
    case FsGen.favoriteIgnoreError:
      return state.mergeIn(['pathItems', Types.pathToString(action.payload.path), 'tlfMeta'], {
        isIgnored: false,
      })
    case FsGen.cancelTransfer:
    case FsGen.download:
    case FsGen.openInFileUI:
    case FsGen.fuseStatus:
    case FsGen.uninstallKBFSConfirm:
    case FsGen.uninstallKBFS:
    case FsGen.fsActivity:
    case FsGen.setupFSHandlers:
    case FsGen.openSecurityPreferences:
    case FsGen.refreshLocalHTTPServerInfo:
    case FsGen.share:
    case FsGen.save:
    case FsGen.fileActionPopup:
    case FsGen.openFinderPopup:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
