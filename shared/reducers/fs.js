// @flow
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: FsGen.Actions) {
  switch (action.type) {
    case FsGen.resetStore:
      return initialState
    case FsGen.filePreviewLoaded:
      return state.updateIn(['pathItems', action.payload.path], (original: Types.PathItem) => {
        const {meta} = action.payload
        if (original.type !== 'file' || meta.type !== 'file') {
          return meta
        }

        return Constants.shouldUseOldMimeType(original, meta) ? meta.set('mimeType', original.mimeType) : meta
      })
    case FsGen.folderListLoaded: {
      const toMerge = action.payload.pathItems.map((item, path) => {
        const original = state.pathItems.get(path)

        if (original && original.type === 'file' && item.type === 'file') {
          return Constants.shouldUseOldMimeType(original, item)
            ? item.set('mimeType', original.mimeType)
            : item
        }

        if (item.type !== 'folder') return item
        if (!original || original.type !== 'folder') return item
        if (original.progress === 'loaded' && item.progress === 'pending') {
          // Don't override a loaded item into pending. This is specifically
          // for the case where user goes back out of a folder where we could
          // override the folder into an empty one. With this, next user
          // navigates into the folder they would see the old list (instead of
          // placeholder), which then gets updated when we hear back from RPC.
          return original
        }
        // Since `folderListLoaded`, `favoritesLoaded`, and `loadResetsResult`
        // can change `pathItems`, we need to make sure that neither one
        // clobbers the others' work.
        return item
          .set('badgeCount', original.badgeCount)
          .set('tlfMeta', original.tlfMeta)
          .set('favoriteChildren', original.favoriteChildren)
          .set('resetParticipants', original.resetParticipants)
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
          // Since `folderListLoaded`, `favoritesLoaded`, and `loadResetsResult`
          // can change `pathItems`, we need to make sure that neither one
          // clobbers the others' work.
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
    case FsGen.mimeTypeLoaded:
      return state.updateIn(
        ['pathItems', action.payload.path],
        pathItem => (pathItem.type === 'file' ? pathItem.set('mimeType', action.payload.mimeType) : pathItem)
      )
    case FsGen.loadResetsResult:
      const resetsToMerge = action.payload.tlfs.mapEntries(([path, item]) => {
        const original = state.pathItems.get(path) || Constants.makeFolder({name: item.name})
        // This cannot happen, but it's needed to make Flow happy.
        if (original.type !== 'folder') return [path, original]

        return [
          path,
          // Since `folderListLoaded`, `favoritesLoaded`, and `loadResetsResult`
          // can change `pathItems`, we need to make sure that neither one
          // clobbers the others' work.
          original.set('resetParticipants', item.resetParticipants),
        ]
      }, [])
      const n = state.mergeIn(['pathItems'], resetsToMerge)
      return n
    case FsGen.filePreviewLoad:
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
    case FsGen.mimeTypeLoad:
    case FsGen.loadResets:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
