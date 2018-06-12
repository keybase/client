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
      let toRemove = []
      const toMerge = action.payload.pathItems.map((item, path) => {
        const original = state.pathItems.get(path)

        if (original && original.type === 'file' && item.type === 'file') {
          return Constants.shouldUseOldMimeType(original, item)
            ? item.set('mimeType', original.mimeType)
            : item
        }

        if (item.type !== 'folder') return item
        if (!original || original.type !== 'folder') return item

        // Make flow happy by referencing them with a new name that's
        // explicitly typed.
        const originalFolder: Types.FolderPathItem = original
        let newItem: Types.FolderPathItem = item

        if (originalFolder.progress === 'loaded' && newItem.progress === 'pending') {
          // We don't want to override a loaded folder into pending, because
          // otherwise next time user goes into that folder we'd show
          // placeholders. We also don't want to simply use the original
          // PathItem, since it's possible some metadata has updated. So use
          // the new item, but reuse children, progress, and tlfMeta fields.
          if (originalFolder.type === 'folder' && newItem.type === 'folder') {
            // make flow happy
            newItem = newItem.set('children', originalFolder.children).set('progress', 'loaded')
          }
        }

        toRemove = toRemove.concat(
          originalFolder.children
            .filter(child => !newItem.children.includes(child))
            .toArray()
            .map(name => Types.pathConcat(path, name))
        )

        // Since `folderListLoaded`, `favoritesLoaded`, and `loadResetsResult`
        // can change `pathItems`, we need to make sure that neither one
        // clobbers the others' work.
        return newItem
          .set('badgeCount', originalFolder.badgeCount)
          .set('tlfMeta', originalFolder.tlfMeta)
          .set('favoriteChildren', originalFolder.favoriteChildren)
      })
      toRemove.length && console.log({msg: 'Removing entries in state.fs.pathItems', toRemove: toRemove})
      return state
        .set('pathItems', state.pathItems.filter((item, path) => !toRemove.includes(path)))
        .mergeIn(['pathItems'], toMerge)
        .update('loadingPaths', loadingPaths => loadingPaths.delete(action.payload.path))
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
      return state.mergeIn(['pathItems'], toMerge)
    case FsGen.sortSetting:
      const {path, sortSetting} = action.payload
      return state.setIn(['pathUserSettings', path, 'sort'], sortSetting)
    case FsGen.transferStarted: {
      const {type, key, path, localPath, intent, opID} = action.payload
      const entryType =
        action.payload.entryType ||
        (() => {
          const item = state.pathItems.get(path)
          return item ? item.type : 'unknown'
        })()
      return state.setIn(
        ['transfers', key],
        Constants.makeTransfer({
          meta: Constants.makeTransferMeta({
            type,
            entryType,
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
    case FsGen.transferFinished: {
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
    case FsGen.newFolderRow:
      const {parentPath} = action.payload
      const parentPathItem = state.pathItems.get(parentPath, Constants.makeUnknownPathItem())
      if (parentPathItem.type !== 'folder') {
        console.warn(`bad parentPath: ${parentPathItem.type}`)
        return state
      }
      let newFolderName = 'New Folder'
      for (let i = 2; parentPathItem.children.has(newFolderName); ++i) {
        newFolderName = `New Folder ${i}`
      }

      return state.mergeIn(
        ['edits'],
        [
          [
            Constants.makeEditID(),
            Constants.makeNewFolder({
              name: newFolderName,
              hint: newFolderName,
              parentPath,
            }),
          ],
        ]
      )
    case FsGen.newFolderName:
      return state.updateIn(
        // $FlowFixMe
        ['edits', action.payload.editID],
        editItem => editItem && editItem.set('name', action.payload.name)
      )
    case FsGen.editSuccess:
    case FsGen.discardEdit:
      // $FlowFixMe
      return state.removeIn(['edits', action.payload.editID])
    case FsGen.editFailed:
      // $FlowFixMe
      return state.setIn(['edits', action.payload.editID, 'status'], 'failed')
    case FsGen.filePreviewLoad:
    case FsGen.cancelTransfer:
    case FsGen.download:
    case FsGen.openInFileUI:
    case FsGen.fuseStatus:
    case FsGen.uninstallKBFSConfirm:
    case FsGen.fsActivity:
    case FsGen.setupFSHandlers:
    case FsGen.openSecurityPreferences:
    case FsGen.refreshLocalHTTPServerInfo:
    case FsGen.shareNative:
    case FsGen.saveMedia:
    case FsGen.fileActionPopup:
    case FsGen.openFinderPopup:
    case FsGen.mimeTypeLoad:
    case FsGen.openPathItem:
    case FsGen.commitEdit:
    case FsGen.letResetUserBackIn:
    case FsGen.pickAndUpload:
    case FsGen.upload:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
