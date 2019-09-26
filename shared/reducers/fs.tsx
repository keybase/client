import logger from '../logger'
import {isEqual} from 'lodash'
import * as I from 'immutable'
import * as FsGen from '../actions/fs-gen'
import * as Constants from '../constants/fs'
import * as ChatConstants from '../constants/chat2'
import * as Types from '../constants/types/fs'
import * as Container from '../util/container'
import {produce, Draft} from 'immer'

const initialState: Types.State = {
  destinationPicker: Constants.makeDestinationPicker(),
  downloads: Constants.makeDownloads(),
  edits: I.Map(),
  errors: I.Map(),
  fileContext: I.Map(),
  folderViewFilter: '',
  kbfsDaemonStatus: Constants.makeKbfsDaemonStatus(),
  lastPublicBannerClosedTlf: '',
  overallSyncStatus: Constants.makeOverallSyncStatus(),
  pathInfos: I.Map(),
  pathItemActionMenu: Constants.makePathItemActionMenu(),
  pathItems: I.Map([[Types.stringToPath('/keybase'), Constants.makeFolder()]]),
  pathUserSettings: I.Map(),
  sendAttachmentToChat: Constants.makeSendAttachmentToChat(),
  settings: Constants.makeSettings(),
  sfmi: Constants.makeSystemFileManagerIntegration(),
  softErrors: Constants.makeSoftErrors(),
  tlfUpdates: I.List(),
  tlfs: Constants.makeTlfs({}),
  uploads: Constants.makeUploads(),
}

export const _initialStateForTest = initialState

const updatePathItem = (
  oldPathItem: Types.PathItem | null | undefined,
  newPathItemFromAction: Types.PathItem
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
    case Types.PathType.Symlink: {
      // @ts-ignore
      const oldSymlinkPathItem: Types.SymlinkPathItem = oldPathItem
      const newSymlinkPathItem: Types.SymlinkPathItem = newPathItem
      // This returns oldPathItem if oldPathItem.equals(newPathItem), which is
      // what we want here.
      return oldSymlinkPathItem.merge(newSymlinkPathItem)
    }
    case Types.PathType.File: {
      // @ts-ignore
      const oldFilePathItem: Types.FilePathItem = oldPathItem
      const newFilePathItem: Types.FilePathItem = newPathItem
      // This returns oldPathItem if oldPathItem.equals(newPathItem), which is
      // what we want here.
      return oldFilePathItem.merge(newFilePathItem)
    }
    case Types.PathType.Folder: {
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
          isEqual(newChildren, oldFolderPathItem.children) ? oldFolderPathItem.children : newChildren
        )
      )
    }
    default:
      return newPathItem
  }
}

const updateTlf = (oldTlf: Types.Tlf | undefined, newTlf: Types.Tlf): Types.Tlf =>
  oldTlf
    ? produce(oldTlf, draftTlf => {
        const {
          conflictState,
          isFavorite,
          isIgnored,
          isNew,
          name,
          resetParticipants,
          syncConfig,
          teamId,
          tlfMtime,
          // ...rest
        } = newTlf
        // TODO: check rest is empty in tsc?
        if (!isEqual(syncConfig, oldTlf.syncConfig)) {
          draftTlf.syncConfig = syncConfig
        }
        if (!isEqual(resetParticipants, oldTlf.resetParticipants)) {
          draftTlf.resetParticipants = resetParticipants
        }
        if (!isEqual(conflictState, oldTlf.conflictState)) {
          draftTlf.conflictState = conflictState
        }
        draftTlf.isFavorite = isFavorite
        draftTlf.isIgnored = isIgnored
        draftTlf.isNew = isNew
        draftTlf.name = name
        draftTlf.teamId = teamId
        draftTlf.tlfMtime = tlfMtime
      })
    : newTlf

const updateTlfList = (oldTlfList: Types.TlfList, newTlfList: Types.TlfList): Types.TlfList =>
  isEqual(oldTlfList, newTlfList)
    ? oldTlfList
    : new Map([...newTlfList].map(([name, tlf]) => [name, updateTlf(oldTlfList.get(name), tlf)]))

const withFsErrorBar = (draftState: Draft<Types.State>, action: FsGen.FsErrorPayload) => {
  const fsError = action.payload.error
  if (
    draftState.kbfsDaemonStatus.onlineStatus === Types.KbfsDaemonOnlineStatus.Offline &&
    action.payload.expectedIfOffline
  ) {
    return
  }
  logger.error('error (fs)', fsError.erroredAction.type, fsError.errorMessage)
  // @ts-ignore TS is correct here. TODO fix we're passing buffers as strings
  draftState.errors = draftState.errors.set(Constants.makeUUID(), fsError)
}

const reduceFsError = (draftState: Draft<Types.State>, action: FsGen.FsErrorPayload) => {
  const fsError = action.payload.error
  const {erroredAction} = fsError
  switch (erroredAction.type) {
    case FsGen.commitEdit:
      withFsErrorBar(draftState, action)
      draftState.edits = draftState.edits.update(erroredAction.payload.editID, edit =>
        edit.set('status', Types.EditStatusType.Failed)
      )
      return
    case FsGen.upload:
      // Don't show error bar in this case, as the uploading row already shows
      // a "retry" button.
      draftState.uploads = draftState.uploads.update('errors', errors =>
        errors.set(
          Constants.getUploadedPath(erroredAction.payload.parentPath, erroredAction.payload.localPath),

          fsError
        )
      )
      return
    case FsGen.saveMedia:
    case FsGen.shareNative:
    case FsGen.download:
    default:
      withFsErrorBar(draftState, action)
  }
}

export default Container.makeReducer<FsGen.Actions, Types.State>(initialState, {
  [FsGen.resetStore]: () => {
    return initialState
  },
  [FsGen.pathItemLoaded]: (draftState, action) => {
    draftState.pathItems = draftState.pathItems.update(action.payload.path, original =>
      updatePathItem(original, action.payload.pathItem)
    )
    draftState.softErrors = draftState.softErrors
      .removeIn(['pathErrors', action.payload.path])
      .removeIn(['tlfErrors', Constants.getTlfPath(action.payload.path)])
  },
  [FsGen.folderListLoaded]: (draftState, action) => {
    const toRemove: Array<Types.Path> = []
    const toMerge = action.payload.pathItems.map((newPathItem, path) => {
      const oldPathItem = draftState.pathItems.get(path, Constants.unknownPathItem)
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
    draftState.pathItems = draftState.pathItems.withMutations(pathItems =>
      pathItems.deleteAll(toRemove).merge(toMerge)
    )
  },
  [FsGen.favoritesLoaded]: (draftState, action) => {
    draftState.tlfs.private = updateTlfList(draftState.tlfs.private, action.payload.private)
    draftState.tlfs.public = updateTlfList(draftState.tlfs.public, action.payload.public)
    draftState.tlfs.team = updateTlfList(draftState.tlfs.team, action.payload.team)
    draftState.tlfs.loaded = true
  },
  [FsGen.setTlfsAsUnloaded]: draftState => {
    draftState.tlfs.loaded = false
  },
  [FsGen.setFolderViewFilter]: (draftState, action) => {
    draftState.folderViewFilter = action.payload.filter
  },
  [FsGen.tlfSyncConfigLoaded]: (draftState, action) => {
    const oldTlfList = draftState.tlfs[action.payload.tlfType]
    draftState.tlfs[action.payload.tlfType] = new Map([
      ...oldTlfList,
      [
        action.payload.tlfName,
        {
          ...(oldTlfList.get(action.payload.tlfName) || Constants.unknownTlf),
          syncConfig: action.payload.syncConfig,
        },
      ],
    ])
  },
  [FsGen.sortSetting]: (draftState, action) => {
    draftState.pathUserSettings = draftState.pathUserSettings.update(action.payload.path, setting =>
      (setting || Constants.defaultPathUserSetting).set('sort', action.payload.sortSetting)
    )
  },
  [FsGen.uploadStarted]: (draftState, action) => {
    draftState.uploads = draftState.uploads.update('writingToJournal', writingToJournal =>
      writingToJournal.add(action.payload.path)
    )
  },
  [FsGen.uploadWritingSuccess]: (draftState, action) => {
    const {path} = action.payload
    draftState.uploads = draftState.uploads
      .removeIn(['errors', path])
      .update('writingToJournal', writingToJournal => writingToJournal.remove(path))
  },
  [FsGen.journalUpdate]: (draftState, action) => {
    const {syncingPaths, totalSyncingBytes, endEstimate} = action.payload
    draftState.uploads = draftState.uploads
      .set('syncingPaths', I.Set(syncingPaths))
      .set('totalSyncingBytes', totalSyncingBytes)
    if (endEstimate) {
      draftState.uploads = draftState.uploads.set('endEstimate', endEstimate)
    } else {
      draftState.uploads = draftState.uploads.remove('endEstimate')
    }
  },
  [FsGen.favoriteIgnore]: (draftState, action) => {
    const elems = Types.getPathElements(action.payload.path)
    const visibility = Types.getVisibilityFromElems(elems)
    if (!visibility) {
      return
    }
    draftState.tlfs[visibility] = new Map([
      ...draftState.tlfs[visibility],
      [
        elems[2],
        {
          ...(draftState.tlfs[visibility].get(elems[2]) || Constants.unknownTlf),
          isIgnored: true,
        },
      ],
    ])
  },
  [FsGen.favoriteIgnoreError]: (draftState, action) => {
    const elems = Types.getPathElements(action.payload.path)
    const visibility = Types.getVisibilityFromElems(elems)
    if (!visibility) {
      return
    }
    draftState.tlfs[visibility] = new Map([
      ...draftState.tlfs[visibility],
      [
        elems[2],
        {
          ...(draftState.tlfs[visibility].get(elems[2]) || Constants.unknownTlf),
          isIgnored: false,
        },
      ],
    ])
  },
  [FsGen.newFolderRow]: (draftState, action) => {
    const {parentPath} = action.payload
    const parentPathItem = draftState.pathItems.get(parentPath, Constants.unknownPathItem)
    if (parentPathItem.type !== Types.PathType.Folder) {
      console.warn(`bad parentPath: ${parentPathItem.type}`)
      return
    }

    const existingNewFolderNames = new Set(
      draftState.edits
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

    draftState.edits = draftState.edits.set(
      Constants.makeEditID(),
      Constants.makeNewFolder({
        hint: newFolderName,
        name: newFolderName,
        parentPath,
      })
    )
  },
  [FsGen.newFolderName]: (draftState, action) => {
    draftState.edits = draftState.edits.update(
      action.payload.editID,
      edit => edit && edit.set('name', action.payload.name)
    )
  },
  [FsGen.commitEdit]: (draftState, action) => {
    draftState.edits = draftState.edits.update(action.payload.editID, edit =>
      edit.set('status', Types.EditStatusType.Saving)
    )
  },
  [FsGen.discardEdit]: (draftState, action) => {
    draftState.edits = draftState.edits.remove(action.payload.editID)
  },
  [FsGen.fsError]: (draftState, action) => {
    reduceFsError(draftState, action)
  },
  [FsGen.userFileEditsLoaded]: (draftState, action) => {
    draftState.tlfUpdates = action.payload.tlfUpdates
  },
  [FsGen.dismissFsError]: (draftState, action) => {
    draftState.errors = draftState.errors.remove(action.payload.key)
  },
  [FsGen.showMoveOrCopy]: (draftState, action) => {
    draftState.destinationPicker = draftState.destinationPicker
      .update('source', source =>
        source.type === Types.DestinationPickerSource.MoveOrCopy ? source : Constants.makeMoveOrCopySource()
      )
      .set('destinationParentPath', I.List([action.payload.initialDestinationParentPath]))
  },
  [FsGen.setMoveOrCopySource]: (draftState, action) => {
    draftState.destinationPicker = draftState.destinationPicker.set(
      'source',
      Constants.makeMoveOrCopySource({path: action.payload.path})
    )
  },
  [FsGen.setDestinationPickerParentPath]: (draftState, action) => {
    draftState.destinationPicker = draftState.destinationPicker.update('destinationParentPath', list =>
      list.set(action.payload.index, action.payload.path)
    )
  },
  [FsGen.showIncomingShare]: (draftState, action) => {
    draftState.destinationPicker = (draftState.destinationPicker.source.type ===
    Types.DestinationPickerSource.IncomingShare
      ? draftState.destinationPicker
      : draftState.destinationPicker.set('source', Constants.makeIncomingShareSource())
    ).set('destinationParentPath', I.List([action.payload.initialDestinationParentPath]))
  },
  [FsGen.setIncomingShareLocalPath]: (draftState, action) => {
    draftState.destinationPicker = draftState.destinationPicker.set(
      'source',
      Constants.makeIncomingShareSource({localPath: action.payload.localPath})
    )
  },
  [FsGen.initSendAttachmentToChat]: (draftState, action) => {
    draftState.sendAttachmentToChat = Constants.makeSendAttachmentToChat({
      path: action.payload.path,
      state: Types.SendAttachmentToChatState.PendingSelectConversation,
      title: Types.getPathName(action.payload.path),
    })
  },
  [FsGen.setSendAttachmentToChatConvID]: (draftState, action) => {
    draftState.sendAttachmentToChat = draftState.sendAttachmentToChat
      .set('convID', action.payload.convID)
      .set(
        'state',
        ChatConstants.isValidConversationIDKey(action.payload.convID)
          ? Types.SendAttachmentToChatState.ReadyToSend
          : Types.SendAttachmentToChatState.PendingSelectConversation
      )
  },
  [FsGen.setSendAttachmentToChatFilter]: (draftState, action) => {
    draftState.sendAttachmentToChat = draftState.sendAttachmentToChat.set('filter', action.payload.filter)
  },
  [FsGen.setSendAttachmentToChatTitle]: (draftState, action) => {
    draftState.sendAttachmentToChat = draftState.sendAttachmentToChat.set('title', action.payload.title)
  },
  [FsGen.sentAttachmentToChat]: draftState => {
    draftState.sendAttachmentToChat = draftState.sendAttachmentToChat.set(
      'state',
      Types.SendAttachmentToChatState.Sent
    )
  },
  [FsGen.setPathItemActionMenuView]: (draftState, action) => {
    draftState.pathItemActionMenu = draftState.pathItemActionMenu
      .set('previousView', draftState.pathItemActionMenu.view)
      .set('view', action.payload.view)
  },
  [FsGen.setPathItemActionMenuDownload]: (draftState, action) => {
    draftState.pathItemActionMenu = draftState.pathItemActionMenu
      .set('downloadID', action.payload.downloadID)
      .set('downloadIntent', action.payload.intent)
  },
  [FsGen.waitForKbfsDaemon]: draftState => {
    draftState.kbfsDaemonStatus = draftState.kbfsDaemonStatus.set(
      'rpcStatus',
      Types.KbfsDaemonRpcStatus.Waiting
    )
  },
  [FsGen.kbfsDaemonRpcStatusChanged]: (draftState, action) => {
    draftState.kbfsDaemonStatus = (action.payload.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected
      ? draftState.kbfsDaemonStatus.set('onlineStatus', Types.KbfsDaemonOnlineStatus.Offline)
      : draftState.kbfsDaemonStatus
    ).set('rpcStatus', action.payload.rpcStatus)
  },
  [FsGen.kbfsDaemonOnlineStatusChanged]: (draftState, action) => {
    draftState.kbfsDaemonStatus = draftState.kbfsDaemonStatus.set(
      'onlineStatus',
      action.payload.online ? Types.KbfsDaemonOnlineStatus.Online : Types.KbfsDaemonOnlineStatus.Offline
    )
  },
  [FsGen.overallSyncStatusChanged]: (draftState, action) => {
    draftState.overallSyncStatus = draftState.overallSyncStatus
      .set('syncingFoldersProgress', action.payload.progress)
      .set('diskSpaceStatus', action.payload.diskSpaceStatus)
  },
  [FsGen.showHideDiskSpaceBanner]: (draftState, action) => {
    draftState.overallSyncStatus = draftState.overallSyncStatus.set('showingBanner', action.payload.show)
  },
  [FsGen.setDriverStatus]: (draftState, action) => {
    draftState.sfmi = draftState.sfmi.set('driverStatus', action.payload.driverStatus)
  },
  [FsGen.showSystemFileManagerIntegrationBanner]: draftState => {
    draftState.sfmi = draftState.sfmi.set('showingBanner', true)
  },
  [FsGen.hideSystemFileManagerIntegrationBanner]: draftState => {
    draftState.sfmi = draftState.sfmi.set('showingBanner', false)
  },
  [FsGen.driverEnable]: draftState => {
    draftState.sfmi = draftState.sfmi.update('driverStatus', driverStatus =>
      driverStatus.type === Types.DriverStatusType.Disabled
        ? driverStatus.set('isEnabling', true)
        : driverStatus
    )
  },
  [FsGen.driverKextPermissionError]: draftState => {
    draftState.sfmi = draftState.sfmi.update('driverStatus', driverStatus =>
      driverStatus.type === Types.DriverStatusType.Disabled
        ? driverStatus.set('kextPermissionError', true).set('isEnabling', false)
        : driverStatus
    )
  },
  [FsGen.driverDisabling]: draftState => {
    draftState.sfmi = draftState.sfmi.update('driverStatus', driverStatus =>
      driverStatus.type === Types.DriverStatusType.Enabled
        ? driverStatus.set('isDisabling', true)
        : driverStatus
    )
  },
  [FsGen.setDirectMountDir]: (draftState, action) => {
    draftState.sfmi = draftState.sfmi.set('directMountDir', action.payload.directMountDir)
  },
  [FsGen.setPreferredMountDirs]: (draftState, action) => {
    draftState.sfmi = draftState.sfmi.set('preferredMountDirs', action.payload.preferredMountDirs)
  },
  [FsGen.setPathSoftError]: (draftState, action) => {
    draftState.softErrors = draftState.softErrors.update('pathErrors', pathErrors =>
      action.payload.softError
        ? pathErrors.set(action.payload.path, action.payload.softError)
        : pathErrors.remove(action.payload.path)
    )
  },
  [FsGen.setTlfSoftError]: (draftState, action) => {
    draftState.softErrors = draftState.softErrors.update('tlfErrors', tlfErrors =>
      action.payload.softError
        ? tlfErrors.set(action.payload.path, action.payload.softError)
        : tlfErrors.remove(action.payload.path)
    )
  },
  [FsGen.setLastPublicBannerClosedTlf]: (draftState, action) => {
    draftState.lastPublicBannerClosedTlf = action.payload.tlf
  },
  [FsGen.settingsLoaded]: (draftState, action) => {
    draftState.settings = action.payload.settings || draftState.settings.set('isLoading', false)
  },
  [FsGen.loadSettings]: draftState => {
    draftState.settings = draftState.settings.set('isLoading', true)
  },
  [FsGen.loadedPathInfo]: (draftState, action) => {
    draftState.pathInfos = draftState.pathInfos.set(action.payload.path, action.payload.pathInfo)
  },
  [FsGen.loadedDownloadStatus]: (draftState, action) => {
    draftState.downloads = draftState.downloads
      .update('regularDownloads', regularDownloads =>
        regularDownloads.equals(action.payload.regularDownloads)
          ? regularDownloads
          : action.payload.regularDownloads
      )
      .update('state', s => (s.equals(action.payload.state) ? s : action.payload.state))
      .update('info', info => info.filter((_, downloadID) => action.payload.state.has(downloadID)))
  },
  [FsGen.loadedDownloadInfo]: (draftState, action) => {
    draftState.downloads = draftState.downloads.update('info', info =>
      info.set(action.payload.downloadID, action.payload.info)
    )
  },
  [FsGen.loadedFileContext]: (draftState, action) => {
    draftState.fileContext = draftState.fileContext.update(action.payload.path, oldFileContext =>
      action.payload.fileContext.equals(oldFileContext) ? oldFileContext : action.payload.fileContext
    )
  },
})
