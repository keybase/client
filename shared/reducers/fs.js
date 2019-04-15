// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as ChatConstants from '../constants/chat2'
import * as Flow from '../util/flow'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

const coalesceFolderUpdate = (
  original: Types.FolderPathItem,
  updated: Types.FolderPathItem
): Types.FolderPathItem =>
  // We don't want to override a loaded folder into pending, because otherwise
  // next time user goes into that folder we'd show placeholders. We also don't
  // want to simply use the original PathItem, since it's possible some
  // metadata has updated. So use the new item, but reuse children and
  // progress.
  original.progress === 'loaded' && updated.progress === 'pending'
    ? updated.withMutations(u => u.set('children', original.children).set('progress', 'loaded'))
    : updated

const withFsErrorBar = (state: Types.State, action: FsGen.FsErrorPayload): Types.State => {
  const fsError = action.payload.error
  logger.error('error (fs)', fsError.erroredAction.type, fsError.error)
  return state.update('errors', errors => errors.set(Constants.makeUUID(), fsError))
}

const reduceFsError = (state: Types.State, action: FsGen.FsErrorPayload): Types.State => {
  const fsError = action.payload.error
  const {erroredAction} = fsError
  switch (erroredAction.type) {
    case FsGen.commitEdit:
      return withFsErrorBar(state, action).update('edits', edits =>
        edits.update(erroredAction.payload.editID, edit => edit.set('status', 'failed'))
      )
    case FsGen.upload:
      // Don't show error bar in this case, as the uploading row already shows
      // a "retry" button.
      return state.update('uploads', uploads =>
        uploads.update('errors', errors =>
          errors.set(
            Constants.getUploadedPath(erroredAction.payload.parentPath, erroredAction.payload.localPath),

            fsError
          )
        )
      )
    case FsGen.saveMedia:
    case FsGen.shareNative:
    case FsGen.download:
      const download = state.downloads.get(erroredAction.payload.key)
      if (!download || download.state.canceled) {
        // Ignore errors for canceled downloads.
        return state
      }
      return withFsErrorBar(state, action).update('downloads', downloads =>
        downloads.update(
          erroredAction.payload.key,
          download => download && download.update('state', original => original.set('error', fsError))
        )
      )
    default:
      return withFsErrorBar(state, action)
  }
}

export default function(state: Types.State = initialState, action: FsGen.Actions): Types.State {
  switch (action.type) {
    case FsGen.resetStore:
      return initialState
    case FsGen.pathItemLoaded:
      return state.update('pathItems', pathItems =>
        pathItems.update(action.payload.path, original =>
          original && original.type === 'folder' && action.payload.pathItem.type === 'folder'
            ? coalesceFolderUpdate(original, action.payload.pathItem)
            : action.payload.pathItem
        )
      )
    case FsGen.folderListLoaded: {
      let toRemove = new Set()
      const toMerge = action.payload.pathItems.map((item, path) => {
        const original = state.pathItems.get(path, Constants.unknownPathItem)

        if (original.type === 'file' && item.type === 'file') {
          return item.set('mimeType', original.mimeType)
        }

        if (item.type !== 'folder') return item
        if (original.type !== 'folder') return item

        // Make flow happy by referencing them with a new name that's
        // explicitly typed.
        const originalFolder: Types.FolderPathItem = original
        let newItem: Types.FolderPathItem = item

        newItem = coalesceFolderUpdate(originalFolder, newItem)

        originalFolder.children.forEach(
          name => !newItem.children.includes(name) && toRemove.add(Types.pathConcat(path, name))
        )

        return newItem
      })
      return state.set(
        'pathItems',
        state.pathItems.withMutations(pathItems => pathItems.deleteAll(toRemove).merge(toMerge))
      )
    }
    case FsGen.loadingPath:
      return state.updateIn(['loadingPaths', action.payload.path], set =>
        action.payload.done ? set && set.delete(action.payload.id) : (set || I.Set()).add(action.payload.id)
      )
    case FsGen.favoritesLoaded:
      return state.set(
        'tlfs',
        Constants.makeTlfs({
          private: action.payload.private,
          public: action.payload.public,
          team: action.payload.team,
        })
      )
    case FsGen.setFolderViewFilter:
      return state.set('folderViewFilter', action.payload.filter)
    case FsGen.tlfSyncConfigLoaded:
      return state.update('tlfs', tlfs =>
        tlfs.update(action.payload.tlfType, tlfList =>
          tlfList.update(
            action.payload.tlfName,
            tlf => tlf && tlf.set('syncConfig', action.payload.syncConfig)
          )
        )
      )
    case FsGen.tlfSyncConfigsLoaded:
      return ['private', 'public', 'team'].reduce(
        (state, tlfType) =>
          state.update('tlfs', tlfs =>
            tlfs.update(tlfType, tlfList =>
              tlfList.withMutations(tlfList =>
                (action.payload[tlfType] || I.Map()).forEach((syncConfig, tlfName) =>
                  tlfList.update(tlfName, tlf => tlf && tlf.set('syncConfig', syncConfig))
                )
              )
            )
          ),
        state
      )
    case FsGen.sortSetting:
      return state.update('pathUserSettings', pathUserSettings =>
        pathUserSettings.update(action.payload.path, setting =>
          (setting || Constants.defaultPathUserSetting).set('sort', action.payload.sortSetting)
        )
      )
    case FsGen.downloadStarted: {
      const {key, path, localPath, intent, opID} = action.payload
      const entryType = action.payload.entryType || state.pathItems.get(path, Constants.unknownPathItem).type
      return state.setIn(
        ['downloads', key],
        Constants.makeDownload({
          meta: Constants.makeDownloadMeta({
            entryType,
            intent,
            localPath,
            opID,
            path,
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
      return state.update('downloads', d =>
        d.update(key, k =>
          k.update('state', original => original && original.merge({completePortion, endEstimate}))
        )
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
    case FsGen.cancelDownload:
      return state.update('downloads', downloads =>
        downloads.update(action.payload.key, download =>
          download.update('state', state => state.set('canceled', true))
        )
      )
    case FsGen.uploadStarted:
      return state.updateIn(['uploads', 'writingToJournal'], writingToJournal =>
        writingToJournal.add(action.payload.path)
      )
    case FsGen.uploadWritingSuccess: {
      const {path} = action.payload
      return state.withMutations(s =>
        s
          .removeIn(['uploads', 'errors', path])
          .updateIn(['uploads', 'writingToJournal'], writingToJournal => writingToJournal.remove(path))
      )
    }
    case FsGen.journalUpdate: {
      const {syncingPaths, totalSyncingBytes, endEstimate} = action.payload
      return state.withMutations(s => {
        s.setIn(['uploads', 'syncingPaths'], I.Set(syncingPaths))
        s.setIn(['uploads', 'totalSyncingBytes'], totalSyncingBytes)
        if (endEstimate) {
          s.setIn(['uploads', 'endEstimate'], endEstimate)
        } else {
          s.deleteIn(['uploads', 'endEstimate'])
        }
      })
    }
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
    case FsGen.newFolderRow:
      const {parentPath} = action.payload
      const parentPathItem = state.pathItems.get(parentPath, Constants.unknownPathItem)
      if (parentPathItem.type !== 'folder') {
        console.warn(`bad parentPath: ${parentPathItem.type}`)
        return state
      }

      const existingNewFolderNames = new Set(
        state.edits
          .filter(edit => edit.parentPath === parentPath)
          .map(edit => edit.name)
          .toSet()
      )

      let newFolderName = 'New Folder'
      for (
        let i = 2;
        parentPathItem.children.has(newFolderName) || existingNewFolderNames.has(newFolderName);
        ++i
      ) {
        newFolderName = `New Folder ${i}`
      }

      return state.mergeIn(
        ['edits'],
        [
          [
            Constants.makeEditID(),
            Constants.makeNewFolder({
              hint: newFolderName,
              name: newFolderName,
              parentPath,
            }),
          ],
        ]
      )
    case FsGen.newFolderName:
      return state.update('edits', edits =>
        edits.update(action.payload.editID, edit => edit && edit.set('name', action.payload.name))
      )
    case FsGen.commitEdit:
      return state.update('edits', edits =>
        edits.update(action.payload.editID, edit => edit.set('status', 'saving'))
      )
    case FsGen.discardEdit:
      return state.update('edits', edits => edits.remove(action.payload.editID))
    case FsGen.fsError:
      return reduceFsError(state, action)
    case FsGen.userFileEditsLoaded:
      return state.set('tlfUpdates', action.payload.tlfUpdates)
    case FsGen.dismissFsError:
      return state.removeIn(['errors', action.payload.key])
    case FsGen.showMoveOrCopy:
      return state.update('destinationPicker', dp =>
        dp
          .set('source', dp.source.type === 'move-or-copy' ? dp.source : Constants.makeMoveOrCopySource())
          .set('destinationParentPath', I.List([action.payload.initialDestinationParentPath]))
      )
    case FsGen.setMoveOrCopySource:
      return state.update('destinationPicker', dp =>
        dp.set('source', Constants.makeMoveOrCopySource({path: action.payload.path}))
      )
    case FsGen.setDestinationPickerParentPath:
      return state.update('destinationPicker', dp =>
        dp.update('destinationParentPath', list => list.set(action.payload.index, action.payload.path))
      )
    case FsGen.showIncomingShare:
      return state.update('destinationPicker', dp =>
        dp
          .set(
            'source',
            dp.source.type === 'incoming-share' ? dp.source : Constants.makeIncomingShareSource()
          )
          .set('destinationParentPath', I.List([action.payload.initialDestinationParentPath]))
      )
    case FsGen.setIncomingShareLocalPath:
      return state.update('destinationPicker', dp =>
        dp.set('source', Constants.makeIncomingShareSource({localPath: action.payload.localPath}))
      )
    case FsGen.initSendAttachmentToChat:
      return state.set(
        'sendAttachmentToChat',
        Constants.makeSendAttachmentToChat({
          path: action.payload.path,
          state: 'pending-select-conversation',
        })
      )
    case FsGen.setSendAttachmentToChatConvID:
      return state.update('sendAttachmentToChat', sendAttachmentToChat =>
        sendAttachmentToChat
          .set('convID', action.payload.convID)
          .set(
            'state',
            ChatConstants.isValidConversationIDKey(action.payload.convID)
              ? 'ready-to-send'
              : 'pending-select-conversation'
          )
      )
    case FsGen.setSendAttachmentToChatFilter:
      return state.update('sendAttachmentToChat', sendAttachmentToChat =>
        sendAttachmentToChat.set('filter', action.payload.filter)
      )
    case FsGen.sentAttachmentToChat:
      return state.update('sendAttachmentToChat', sendLinkToChat => sendLinkToChat.set('state', 'sent'))
    case FsGen.initSendLinkToChat:
      return state.set(
        'sendLinkToChat',
        Constants.makeSendLinkToChat({
          path: action.payload.path,
          state: 'locating-conversation',
        })
      )
    case FsGen.setSendLinkToChatConvID:
      return state.update('sendLinkToChat', sendLinkToChat =>
        sendLinkToChat
          .set('convID', action.payload.convID)
          // Notably missing check on if convID is noConversationIDKey,
          // because it's possible we need to create such conversation. So
          // always treat this action as a transition to 'ready-to-send'.
          .set('state', 'ready-to-send')
      )
    case FsGen.setSendLinkToChatChannels:
      return state.update('sendLinkToChat', sendLinkToChat =>
        sendLinkToChat
          .set('channels', action.payload.channels)
          .set(
            'state',
            ChatConstants.isValidConversationIDKey(sendLinkToChat.convID)
              ? 'ready-to-send'
              : 'pending-select-conversation'
          )
      )
    case FsGen.triggerSendLinkToChat:
      return state.update('sendLinkToChat', sendLinkToChat => sendLinkToChat.set('state', 'sending'))
    case FsGen.sentLinkToChat:
      return state.update('sendLinkToChat', sendLinkToChat =>
        // We need to set convID here so component can navigate to the
        // conversation thread correctly.
        sendLinkToChat.set('state', 'sent').set('convID', action.payload.convID)
      )
    case FsGen.setPathItemActionMenuView:
      return state.update('pathItemActionMenu', pathItemActionMenu =>
        pathItemActionMenu.set('previousView', pathItemActionMenu.view).set('view', action.payload.view)
      )
    case FsGen.setPathItemActionMenuDownloadKey:
      return state.update('pathItemActionMenu', pathItemActionMenu =>
        pathItemActionMenu.set('downloadKey', action.payload.key)
      )
    case FsGen.waitForKbfsDaemon:
      return state.update('kbfsDaemonStatus', kbfsDaemonStatus =>
        kbfsDaemonStatus.set('rpcStatus', 'waiting')
      )
    case FsGen.kbfsDaemonRpcStatusChanged:
      return state.update('kbfsDaemonStatus', kbfsDaemonStatus =>
        kbfsDaemonStatus.set('rpcStatus', action.payload.rpcStatus)
      )
    case FsGen.kbfsDaemonOnlineStatusChanged:
      return state.update('kbfsDaemonStatus', kbfsDaemonStatus =>
        kbfsDaemonStatus.set('online', action.payload.online)
      )
    case FsGen.overallSyncStatusChanged:
      return state.set(
        'syncingFoldersProgress',
        action.payload.status.syncingBytes /
          (action.payload.status.syncingBytes + action.payload.status.syncedBytes)
      )
    case FsGen.setDriverStatus:
      return state.update('sfmi', sfmi => sfmi.set('driverStatus', action.payload.driverStatus))
    case FsGen.showSystemFileManagerIntegrationBanner:
      return state.update('sfmi', sfmi => sfmi.set('showingBanner', true))
    case FsGen.hideSystemFileManagerIntegrationBanner:
      return state.update('sfmi', sfmi => sfmi.set('showingBanner', false))
    case FsGen.driverEnable:
      return state.update('sfmi', sfmi =>
        sfmi.update('driverStatus', driverStatus =>
          driverStatus.type === 'disabled' ? driverStatus.set('isEnabling', true) : driverStatus
        )
      )
    case FsGen.driverKextPermissionError:
      return state.update('sfmi', sfmi =>
        sfmi.update('driverStatus', driverStatus =>
          driverStatus.type === 'disabled'
            ? driverStatus.set('kextPermissionError', true).set('isEnabling', false)
            : driverStatus
        )
      )
    case FsGen.driverDisable:
      return state.update('sfmi', sfmi =>
        sfmi.update('driverStatus', driverStatus =>
          driverStatus.type === 'enabled' ? driverStatus.set('isDisabling', true) : driverStatus
        )
      )

    case FsGen.folderListLoad:
    case FsGen.placeholderAction:
    case FsGen.download:
    case FsGen.favoritesLoad:
    case FsGen.uninstallKBFSConfirm:
    case FsGen.notifyTlfUpdate:
    case FsGen.openSecurityPreferences:
    case FsGen.refreshLocalHTTPServerInfo:
    case FsGen.shareNative:
    case FsGen.saveMedia:
    case FsGen.openPathInSystemFileManager:
    case FsGen.openLocalPathInSystemFileManager:
    case FsGen.editSuccess:
    case FsGen.letResetUserBackIn:
    case FsGen.openAndUpload:
    case FsGen.pickAndUpload:
    case FsGen.upload:
    case FsGen.openFilesFromWidget:
    case FsGen.userFileEditsLoad:
    case FsGen.deleteFile:
    case FsGen.move:
    case FsGen.copy:
    case FsGen.closeDestinationPicker:
    case FsGen.clearRefreshTag:
    case FsGen.loadPathMetadata:
    case FsGen.refreshDriverStatus:
    case FsGen.loadTlfSyncConfig:
    case FsGen.setTlfSyncConfig:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
