import logger from '../logger'
import * as I from 'immutable'
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as ChatConstants from '../constants/chat2'
import * as Types from '../constants/types/fs'

const initialState = Constants.makeState()

const updatePathItem = (
  oldPathItem?: Types.PathItem | null,
  newPathItemFromAction?: Types.PathItem
): Types.PathItem => {
  if (!oldPathItem || oldPathItem.type !== newPathItemFromAction.type) {
    return newPathItemFromAction
  }
  // Reuse prefetchStatus if they equal in value. Note that `update` and
  // `merge` don't actually make a new record unless we do give it a new value.
  // So re-using the old prefetchStatus reference here makes it possible to
  // reuse the oldPathItem as long as other fields are identical. For
  // prefetchComplete and prefetchNotStarted this may not matter, since we are
  // using the same references anyway. But for PrefetchInProgress it's a
  // different record everytime, and this becomes useful.
  // @ts-ignore
  const newPathItem = newPathItemFromAction.update('prefetchStatus', newPrefetchStatus =>
    newPrefetchStatus.equals(oldPathItem.prefetchStatus) ? oldPathItem.prefetchStatus : newPrefetchStatus
  )
  switch (newPathItem.type) {
    case Types.PathType.Unknown:
      return newPathItem
    case Types.PathType.Symlink:
      // @ts-ignore
      const oldSymlinkPathItem: Types.SymlinkPathItem = oldPathItem
      const newSymlinkPathItem: Types.SymlinkPathItem = newPathItem
      // This returns oldPathItem if oldPathItem.equals(newPathItem), which is
      // what we want here.
      return oldSymlinkPathItem.merge(newSymlinkPathItem)
    case Types.PathType.File:
      // @ts-ignore
      const oldFilePathItem: Types.FilePathItem = oldPathItem
      const newFilePathItem: Types.FilePathItem = newPathItem
      // There are two complications in this case:
      // 1) Most of the fields in FilePathItem are primitive types, and would
      //    work with merge fine. The only exception is `mimeType: ?Mime` which
      //    is a record, so we need to compare it separately.
      // 2) Additionally, we don't always get a oldFilePathItem with the
      //    mimeType set. The most performant way is to never over a known
      //    mimeType into null, but if the file content changes, mimeType can
      //    change too. So instead we compare other fields as well in this
      //    case.
      if (oldFilePathItem.mimeType && !newFilePathItem.mimeType) {
        // The new one doesn't have mimeType but the old one has it. So compare
        // other fields, and return the old one if they all match, or new one
        // (i.e. unset known mimeType) if anything has changed.
        return oldFilePathItem.set('mimeType', newFilePathItem.mimeType).equals(newFilePathItem)
          ? oldFilePathItem
          : newFilePathItem
      }
      if (oldFilePathItem.mimeType && newFilePathItem.mimeType) {
        // The new one comes with mimeType, and we already know one. So compare
        // the mimeType from both first. If they are equal in value, make sure
        // they have the same reference before calling merge, so we can reuse
        // the old oldFilePathItem when possible.
        return oldFilePathItem.mimeType.equals(newFilePathItem.mimeType)
          ? oldFilePathItem.merge(newFilePathItem.set('mimeType', oldFilePathItem.mimeType))
          : newFilePathItem
      }
      // Now there are two possibilities:
      // 1) We have mimeType in the new one but not the old one. In this case
      //    we simply want to take it from the new one.
      // 2) We don't have it in either of them. In this case we'll want to get
      //    other fields from the new one if they change.
      // Either way, this can be done with a simple merge.
      return oldFilePathItem.merge(newFilePathItem)
    case Types.PathType.Folder:
      // @ts-ignore
      const oldFolderPathItem: Types.FolderPathItem = oldPathItem
      const newFolderPathItem: Types.FolderPathItem = newPathItem
      if (
        oldFolderPathItem.progress === Types.ProgressType.Pending &&
        newFolderPathItem.progress === Types.ProgressType.Loaded
      ) {
        // The new one has children loaded and the old one doesn't. There's no
        // way to reuse the old one so just return newFolderPathItem.
        return newFolderPathItem
      }
      if (
        oldFolderPathItem.progress === Types.ProgressType.Loaded &&
        newFolderPathItem.progress === Types.ProgressType.Pending
      ) {
        // The new one doesn't have children, but the old one has. We don't
        // want to override a loaded folder into pending, because otherwise
        // next time user goes into that folder we'd show placeholders.  So
        // first set the children in new one using what we already have, then
        // merge it into the old one. We'll end up reusing the
        // oldFolderPathItem if nothing (not considering children of course)
        // has changed.
        return oldFolderPathItem.merge(
          newFolderPathItem.withMutations(p =>
            p.set('children', oldFolderPathItem.children).set('progress', Types.ProgressType.Loaded)
          )
        )
      }
      if (
        oldFolderPathItem.progress === Types.ProgressType.Pending &&
        newFolderPathItem.progress === Types.ProgressType.Pending
      ) {
        // Neither one has children, so just do a simple merge like simple
        // cases above for symlink/unknown types.
        return oldFolderPathItem.merge(newFolderPathItem)
      }
      // Both of them have children loaded. So merge the children field
      // separately before merging the whole thing. This reuses
      // oldFolderPathItem when possible as well.
      return oldFolderPathItem.merge(
        newFolderPathItem.update('children', newChildren =>
          newChildren.equals(oldFolderPathItem.children) ? oldFolderPathItem.children : newChildren
        )
      )
    default:
      return newPathItem
  }
}

const haveSamePartialSyncConfig = (tlf1: Types.Tlf, tlf2: Types.Tlf) =>
  tlf2.syncConfig &&
  tlf1.syncConfig &&
  tlf2.syncConfig.mode === Types.TlfSyncMode.Partial &&
  tlf1.syncConfig.mode === Types.TlfSyncMode.Partial &&
  tlf2.syncConfig.enabledPaths.equals(tlf1.syncConfig.enabledPaths)

const updateTlf = (oldTlf?: Types.Tlf | null, newTlf?: Types.Tlf): Types.Tlf => {
  if (!oldTlf) {
    return newTlf
  }
  if (!I.is(newTlf.syncConfig, oldTlf.syncConfig) && !haveSamePartialSyncConfig(oldTlf, newTlf)) {
    return newTlf
  }
  if (!newTlf.resetParticipants.equals(oldTlf.resetParticipants)) {
    return newTlf
  }
  if (!newTlf.conflict.equals(oldTlf.conflict)) {
    return newTlf
  }
  // syncConfig, resetParticipants, and conflict all stayed thte same in value,
  // so just reuse old reference.
  return oldTlf.merge(
    newTlf.withMutations(n =>
      n
        .set('syncConfig', oldTlf.syncConfig)
        .set('resetParticipants', oldTlf.resetParticipants)
        .set('conflict', oldTlf.conflict)
    )
  )
}

const updateTlfList = (oldTlfList: Types.TlfList, newTlfList: Types.TlfList): Types.TlfList =>
  newTlfList.map((tlf, name) => updateTlf(oldTlfList.get(name), tlf))

const withFsErrorBar = (state: Types.State, action: FsGen.FsErrorPayload): Types.State => {
  const fsError = action.payload.error
  if (!state.kbfsDaemonStatus.online && action.payload.expectedIfOffline) {
    return state
  }
  logger.error('error (fs)', fsError.erroredAction.type, fsError.errorMessage)
  // @ts-ignore TS is correct here. TODO fix we're passing buffers as strings
  return state.update('errors', errors => errors.set(Constants.makeUUID(), fsError))
}

const reduceFsError = (state: Types.State, action: FsGen.FsErrorPayload): Types.State => {
  const fsError = action.payload.error
  const {erroredAction} = fsError
  switch (erroredAction.type) {
    case FsGen.commitEdit:
      return withFsErrorBar(state, action).update('edits', edits =>
        edits.update(erroredAction.payload.editID, edit => edit.set('status', Types.EditStatusType.Failed))
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
        pathItems.update(action.payload.path, original => updatePathItem(original, action.payload.pathItem))
      )
    case FsGen.folderListLoaded: {
      const toRemove = []
      const toMerge = action.payload.pathItems.map((newPathItem, path) => {
        const oldPathItem = state.pathItems.get(path, Constants.unknownPathItem)
        const toSet =
          oldPathItem === Constants.unknownPathItem ? newPathItem : updatePathItem(oldPathItem, newPathItem)

        oldPathItem.type === Types.PathType.Folder &&
          oldPathItem.children.forEach(
            name =>
              (toSet.type !== Types.PathType.Folder || !toSet.children.includes(name)) &&
              toRemove.push(Types.pathConcat(path, name))
          )

        return toSet
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
      return state.update('tlfs', tlfs =>
        tlfs.withMutations(tlfsMutable =>
          tlfsMutable
            .update('private', privateTlfs => updateTlfList(privateTlfs, action.payload.private))
            .update('public', publicTlfs => updateTlfList(publicTlfs, action.payload.public))
            .update('team', team => updateTlfList(team, action.payload.team))
        )
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
      if (parentPathItem.type !== Types.PathType.Folder) {
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
        edits.update(action.payload.editID, edit => edit.set('status', Types.EditStatusType.Saving))
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
          .set(
            'source',
            dp.source.type === Types.DestinationPickerSource.MoveOrCopy
              ? dp.source
              : Constants.makeMoveOrCopySource()
          )
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
            dp.source.type === Types.DestinationPickerSource.IncomingShare
              ? dp.source
              : Constants.makeIncomingShareSource()
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
          state: Types.SendAttachmentToChatState.PendingSelectConversation,
        })
      )
    case FsGen.setSendAttachmentToChatConvID:
      return state.update('sendAttachmentToChat', sendAttachmentToChat =>
        sendAttachmentToChat
          .set('convID', action.payload.convID)
          .set(
            'state',
            ChatConstants.isValidConversationIDKey(action.payload.convID)
              ? Types.SendAttachmentToChatState.ReadyToSend
              : Types.SendAttachmentToChatState.PendingSelectConversation
          )
      )
    case FsGen.setSendAttachmentToChatFilter:
      return state.update('sendAttachmentToChat', sendAttachmentToChat =>
        sendAttachmentToChat.set('filter', action.payload.filter)
      )
    case FsGen.sentAttachmentToChat:
      return state.setIn(['sendAttachmentToChat', 'state'], Types.SendLinkToChatState.Sent)
    case FsGen.initSendLinkToChat:
      return state.set(
        'sendLinkToChat',
        Constants.makeSendLinkToChat({
          path: action.payload.path,
          state: Types.SendLinkToChatState.LocatingConversation,
        })
      )
    case FsGen.setSendLinkToChatConvID:
      return state.update('sendLinkToChat', sendLinkToChat =>
        sendLinkToChat
          .set('convID', action.payload.convID)
          // Notably missing check on if convID is noConversationIDKey,
          // because it's possible we need to create such conversation. So
          // always treat this action as a transition to 'ready-to-send'.
          .set('state', Types.SendLinkToChatState.ReadyToSend)
      )
    case FsGen.setSendLinkToChatChannels:
      return state.update('sendLinkToChat', sendLinkToChat =>
        sendLinkToChat
          .set('channels', action.payload.channels)
          .set(
            'state',
            ChatConstants.isValidConversationIDKey(sendLinkToChat.convID)
              ? Types.SendLinkToChatState.ReadyToSend
              : Types.SendLinkToChatState.PendingSelectConversation
          )
      )
    case FsGen.triggerSendLinkToChat:
      return state.update('sendLinkToChat', sendLinkToChat =>
        sendLinkToChat.set('state', Types.SendLinkToChatState.Sending)
      )
    case FsGen.sentLinkToChat:
      return state.update('sendLinkToChat', sendLinkToChat =>
        // We need to set convID here so component can navigate to the
        // conversation thread correctly.
        sendLinkToChat.set('state', Types.SendLinkToChatState.Sent).set('convID', action.payload.convID)
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
        kbfsDaemonStatus.set('rpcStatus', Types.KbfsDaemonRpcStatus.Waiting)
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
      return state.update('overallSyncStatus', overallSyncStatus =>
        overallSyncStatus
          .update('syncingFoldersProgress', syncingFoldersProgress =>
            action.payload.progress.equals(syncingFoldersProgress)
              ? syncingFoldersProgress
              : action.payload.progress
          )
          .set(
            'diskSpaceStatus',
            action.payload.outOfSpace ? Types.DiskSpaceStatus.Error : Types.DiskSpaceStatus.Ok
          )
          // Unhide the banner if the state we're coming from isn't WARNING.
          .set(
            'diskSpaceBannerHidden',
            overallSyncStatus.diskSpaceBannerHidden &&
              overallSyncStatus.diskSpaceStatus === Types.DiskSpaceStatus.Warning
          )
      )
    case FsGen.setDriverStatus:
      return state.update('sfmi', sfmi => sfmi.set('driverStatus', action.payload.driverStatus))
    case FsGen.showSystemFileManagerIntegrationBanner:
      return state.update('sfmi', sfmi => sfmi.set('showingBanner', true))
    case FsGen.hideSystemFileManagerIntegrationBanner:
      return state.update('sfmi', sfmi => sfmi.set('showingBanner', false))
    case FsGen.hideDiskSpaceBanner:
      return state.update('overallSyncStatus', status => status.set('diskSpaceBannerHidden', true))
    case FsGen.driverEnable:
      return state.update('sfmi', sfmi =>
        sfmi.update('driverStatus', driverStatus =>
          driverStatus.type === Types.DriverStatusType.Disabled
            ? driverStatus.set('isEnabling', true)
            : driverStatus
        )
      )
    case FsGen.driverKextPermissionError:
      return state.update('sfmi', sfmi =>
        sfmi.update('driverStatus', driverStatus =>
          driverStatus.type === Types.DriverStatusType.Disabled
            ? driverStatus.set('kextPermissionError', true).set('isEnabling', false)
            : driverStatus
        )
      )
    case FsGen.driverDisabling:
      return state.update('sfmi', sfmi =>
        sfmi.update('driverStatus', driverStatus =>
          driverStatus.type === Types.DriverStatusType.Enabled
            ? driverStatus.set('isDisabling', true)
            : driverStatus
        )
      )
    case FsGen.tlfCrStatusChanged:
      const parsedPath = Constants.parsePath(action.payload.tlfPath)
      const newState = action.payload.status
      if (parsedPath.kind === Types.PathKind.Root || parsedPath.kind === Types.PathKind.TlfList) {
        // This should not happen.
        return state
      }
      return state.update('tlfs', tlfs =>
        tlfs.update(parsedPath.tlfType, tlfList =>
          tlfList.update(parsedPath.tlfName, tlf =>
            tlf.update('conflict', tlfConflict => {
              if (
                tlfConflict.state === 'in-manual-resolution' &&
                (newState === 'in-conflict-stuck' || newState === 'in-conflict-not-stuck')
              ) {
                // If the conflict is being manually resolved, ignore new
                // conflicts that come in.
                return tlfConflict
              } else {
                return tlfConflict.set('state', newState)
              }
            })
          )
        )
      )
    case FsGen.setPathSoftError:
      return state.update('softErrors', softErrors =>
        softErrors.update('pathErrors', pathErrors =>
          action.payload.softError
            ? pathErrors.set(action.payload.path, action.payload.softError)
            : pathErrors.remove(action.payload.path)
        )
      )
    case FsGen.setTlfSoftError:
      return state.update('softErrors', softErrors =>
        softErrors.update('tlfErrors', tlfErrors =>
          action.payload.softError
            ? tlfErrors.set(action.payload.path, action.payload.softError)
            : tlfErrors.remove(action.payload.path)
        )
      )
    case FsGen.setLastPublicBannerClosedTlf:
      return state.set('lastPublicBannerClosedTlf', action.payload.tlf)
    case FsGen.settingsLoaded:
      return action.payload.settings
        ? state.set('settings', action.payload.settings)
        : state.update('settings', s => s.set('isLoading', false))
    case FsGen.loadSettings:
      return state.update('settings', s => s.set('isLoading', true))

    case FsGen.startManualConflictResolution:
    case FsGen.driverDisable:
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
    case FsGen.setSpaceAvailableNotificationThreshold:
      return state
    default:
      return state
  }
}
