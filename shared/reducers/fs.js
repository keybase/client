// @flow
import logger from '../logger'
import * as I from 'immutable'
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
        if (!original || original.type !== 'file' || meta.type !== 'file') {
          return meta
        }

        return Constants.shouldUseOldMimeType(original, meta) ? meta.set('mimeType', original.mimeType) : meta
      })
    case FsGen.folderListLoaded: {
      let toRemove = new Set()
      const toMerge = action.payload.pathItems.map((item, path) => {
        const original = state.pathItems.get(path, Constants.unknownPathItem)

        if (original.type === 'file' && item.type === 'file') {
          return Constants.shouldUseOldMimeType(original, item)
            ? item.set('mimeType', original.mimeType)
            : item
        }

        if (item.type !== 'folder') return item
        if (original.type !== 'folder') return item

        // Make flow happy by referencing them with a new name that's
        // explicitly typed.
        const originalFolder: Types.FolderPathItem = original
        let newItem: Types.FolderPathItem = item

        if (originalFolder.progress === 'loaded' && item.progress === 'pending') {
          // We don't want to override a loaded folder into pending, because
          // otherwise next time user goes into that folder we'd show
          // placeholders. We also don't want to simply use the original
          // PathItem, since it's possible some metadata has updated. So use
          // the new item, but reuse children and progress.
          if (originalFolder.type === 'folder' && item.type === 'folder') {
            // make flow happy
            newItem = item.set('children', originalFolder.children).set('progress', 'loaded')
          }
        }

        originalFolder.children.forEach(
          name => !newItem.children.includes(name) && toRemove.add(Types.pathConcat(path, name))
        )

        return newItem
      })
      return state
        .set(
          'pathItems',
          state.pathItems.withMutations(pathItems => pathItems.deleteAll(toRemove).merge(toMerge))
        )
        .update('loadingPaths', loadingPaths => loadingPaths.delete(action.payload.path))
    }
    case FsGen.folderListLoad:
      return state.update('loadingPaths', loadingPaths => loadingPaths.add(action.payload.path))
    case FsGen.favoritesLoaded:
      return state.set(
        'tlfs',
        Constants.makeTlfs({
          private: action.payload.private,
          public: action.payload.public,
          team: action.payload.team,
        })
      )
    case FsGen.sortSetting:
      const {path, sortSetting} = action.payload
      return state.setIn(['pathUserSettings', path, 'sort'], sortSetting)
    case FsGen.downloadStarted: {
      const {key, path, localPath, intent, opID} = action.payload
      const entryType = action.payload.entryType || state.pathItems.get(path, Constants.unknownPathItem).type
      return state.setIn(
        ['downloads', key],
        Constants.makeDownload({
          meta: Constants.makeDownloadMeta({
            entryType,
            intent,
            path,
            localPath,
            opID,
          }),
          state: Constants.makeDownloadState({
            completePortion: 0,
            isDone: false,
            startedAt: Date.now(),
          }),
        })
      )
    }
    case FsGen.downloadProgress: {
      const {key, completePortion, endEstimate} = action.payload
      return state.updateIn(
        ['downloads', key, 'state'],
        original =>
          original && original.set('completePortion', completePortion).set('endEstimate', endEstimate)
      )
    }
    case FsGen.downloadSuccess: {
      return state.updateIn(
        ['downloads', action.payload.key, 'state'],
        original => original && original.set('isDone', true)
      )
    }
    case FsGen.dismissDownload: {
      return state.removeIn(['downloads', action.payload.key])
    }
    case FsGen.uploadStarted:
      return state.updateIn(['uploads', 'writingToJournal'], writingToJournal =>
        writingToJournal.add(action.payload.path)
      )
    case FsGen.uploadWritingSuccess: {
      const {path} = action.payload
      return state
        .removeIn(['uploads', 'errors', path])
        .updateIn(['uploads', 'writingToJournal'], writingToJournal => writingToJournal.remove(path))
    }
    case FsGen.journalUpdate: {
      const {syncingPaths, totalSyncingBytes, endEstimate} = action.payload
      return state
        .setIn(['uploads', 'syncingPaths'], I.Set(syncingPaths))
        .setIn(['uploads', 'totalSyncingBytes'], totalSyncingBytes)
        .setIn(['uploads', 'endEstimate'], endEstimate || undefined)
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
    case FsGen.favoriteIgnore: // fallthrough
    case FsGen.favoriteIgnoreError:
      const elems = Types.getPathElements(action.payload.path)
      const visibility = Types.getVisibilityFromElems(elems)
      if (!visibility) {
        return state
      }
      return state.mergeIn(['tlfs', visibility, elems[2]], {
        isIgnored: action.type === FsGen.favoriteIgnore,
      })
    case FsGen.mimeTypeLoaded:
      return state.updateIn(
        ['pathItems', action.payload.path],
        pathItem =>
          pathItem && pathItem.type === 'file' ? pathItem.set('mimeType', action.payload.mimeType) : pathItem
      )
    case FsGen.newFolderRow:
      const {parentPath} = action.payload
      const parentPathItem = state.pathItems.get(parentPath, Constants.unknownPathItem)
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
      // $FlowFixMe
      return state.updateIn(
        ['edits', action.payload.editID],
        editItem => editItem && editItem.set('name', action.payload.name)
      )
    case FsGen.editSuccess:
    case FsGen.discardEdit:
      // $FlowFixMe
      return state.removeIn(['edits', action.payload.editID])
    case FsGen.fsError:
      const {erroredAction, error} = action.payload.error
      logger.error('error (fs)', erroredAction.type, error)
      const nextState: Types.State = state.setIn(['errors', Constants.makeUUID()], action.payload.error)

      switch (erroredAction.type) {
        case FsGen.commitEdit:
          // $FlowFixMe
          return nextState.setIn(['edits', erroredAction.payload.editID, 'status'], 'failed')
        case FsGen.upload:
          // $FlowFixMe
          return nextState.setIn(
            [
              'uploads',
              'errors',
              Constants.getUploadedPath(erroredAction.payload.parentPath, erroredAction.payload.localPath),
            ],
            error
          )
        case FsGen.download:
          if (erroredAction.payload.intent !== 'none') {
            return nextState
          }
          // $FlowFixMe
          return nextState.updateIn(
            ['downloads', erroredAction.payload.key, 'state'],
            original => original && original.set('isDone', true).set('error', error)
          )
        default:
          return nextState
      }
    case FsGen.userFileEditsLoaded:
      return state.set('tlfUpdates', Constants.userTlfHistoryRPCToState(action.payload.writerEdits))
    case FsGen.dismissFsError:
      return state.removeIn(['errors', action.payload.key])
    case FsGen.placeholderAction:
    case FsGen.filePreviewLoad:
    case FsGen.cancelDownload:
    case FsGen.download:
    case FsGen.favoritesLoad:
    case FsGen.openInFileUI:
    case FsGen.fuseStatus:
    case FsGen.uninstallKBFSConfirm:
    case FsGen.notifySyncActivity:
    case FsGen.notifyTlfUpdate:
    case FsGen.openSecurityPreferences:
    case FsGen.refreshLocalHTTPServerInfo:
    case FsGen.shareNative:
    case FsGen.saveMedia:
    case FsGen.mimeTypeLoad:
    case FsGen.openPathItem:
    case FsGen.commitEdit:
    case FsGen.letResetUserBackIn:
    case FsGen.openAndUpload:
    case FsGen.pickAndUpload:
    case FsGen.upload:
    case FsGen.openFilesFromWidget:
    case FsGen.userFileEditsLoad:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
