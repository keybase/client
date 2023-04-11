import * as Constants from '../../constants/fs'
import * as Router2Constants from '../../constants/router2'
import * as EngineGen from '../engine-gen-gen'
import * as FsGen from '../fs-gen'
import * as ConfigGen from '../config-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'
import logger from '../../logger'
import initPlatformSpecific from './platform-specific'
import * as RouteTreeGen from '../route-tree-gen'
import * as Platform from '../../constants/platform'
import {tlfToPreferredOrder} from '../../util/kbfs'
import {errorToActionOrThrow} from './shared'
import NotifyPopup from '../../util/notify-popup'
import {RPCError} from '../../util/errors'
import KB2 from '../../util/electron'
import {requestPermissionsToWrite} from '../platform-specific'

const {darwinCopyToKBFSTempUploadFile} = KB2.functions

const clientID = Constants.makeUUID()

const rpcFolderTypeToTlfType = (rpcFolderType: RPCTypes.FolderType) => {
  switch (rpcFolderType) {
    case RPCTypes.FolderType.private:
      return Types.TlfType.Private
    case RPCTypes.FolderType.public:
      return Types.TlfType.Public
    case RPCTypes.FolderType.team:
      return Types.TlfType.Team
    default:
      return null
  }
}

const rpcConflictStateToConflictState = (
  rpcConflictState: RPCTypes.ConflictState | null
): Types.ConflictState => {
  if (rpcConflictState) {
    if (rpcConflictState.conflictStateType === RPCTypes.ConflictStateType.normalview) {
      const nv = rpcConflictState.normalview
      return Constants.makeConflictStateNormalView({
        localViewTlfPaths: (nv?.localViews || []).reduce<Array<Types.Path>>((arr, p) => {
          p.PathType === RPCTypes.PathType.kbfs && arr.push(Constants.rpcPathToPath(p.kbfs))
          return arr
        }, []),
        resolvingConflict: !!nv && nv.resolvingConflict,
        stuckInConflict: !!nv && nv.stuckInConflict,
      })
    } else {
      const nv = rpcConflictState?.manualresolvinglocalview.normalView
      return Constants.makeConflictStateManualResolvingLocalView({
        normalViewTlfPath:
          nv && nv.PathType === RPCTypes.PathType.kbfs
            ? Constants.rpcPathToPath(nv.kbfs)
            : Constants.defaultPath,
      })
    }
  } else {
    return Constants.tlfNormalViewWithNoConflict
  }
}

const loadAdditionalTlf = async (state: Container.TypedState, action: FsGen.LoadAdditionalTlfPayload) => {
  if (Types.getPathLevel(action.payload.tlfPath) !== 3) {
    logger.warn('loadAdditionalTlf called on non-TLF path')
    return
  }
  try {
    const {folder, isFavorite, isIgnored, isNew} = await RPCTypes.SimpleFSSimpleFSGetFolderRpcPromise({
      path: Constants.pathToRPCPath(action.payload.tlfPath).kbfs,
    })
    const tlfType = rpcFolderTypeToTlfType(folder.folderType)
    const tlfName =
      tlfType === Types.TlfType.Private || tlfType === Types.TlfType.Public
        ? tlfToPreferredOrder(folder.name, state.config.username)
        : folder.name
    return (
      tlfType &&
      FsGen.createLoadedAdditionalTlf({
        tlf: Constants.makeTlf({
          conflictState: rpcConflictStateToConflictState(folder.conflictState || null),
          isFavorite,
          isIgnored,
          isNew,
          name: tlfName,
          resetParticipants: (folder.reset_members || []).map(({username}) => username),
          syncConfig: getSyncConfigFromRPC(tlfName, tlfType, folder.syncConfig || null),
          teamId: folder.team_id || '',
          tlfMtime: folder.mtime || 0,
        }),
        tlfPath: action.payload.tlfPath,
      })
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (error.code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      const users = error.fields?.filter((elem: any) => elem.key === 'usernames')
      const usernames = users?.map((elem: any) => elem.value)
      // Don't leave the user on a broken FS dir screen.
      return [
        RouteTreeGen.createNavigateUp(),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {source: 'newFolder', usernames}, selected: 'contactRestricted'}],
        }),
      ]
    }
    return errorToActionOrThrow(error, action.payload.tlfPath)
  }
}

const loadFavorites = async (state: Container.TypedState) => {
  try {
    if (!state.config.loggedIn) {
      return false
    }
    const results = await RPCTypes.SimpleFSSimpleFSListFavoritesRpcPromise()
    const payload = {
      private: new Map(),
      public: new Map(),
      team: new Map(),
    }
    ;[
      ...(results.favoriteFolders
        ? [{folders: results.favoriteFolders, isFavorite: true, isIgnored: false, isNew: false}]
        : []),
      ...(results.ignoredFolders
        ? [{folders: results.ignoredFolders, isFavorite: false, isIgnored: true, isNew: false}]
        : []),
      ...(results.newFolders
        ? [{folders: results.newFolders, isFavorite: true, isIgnored: false, isNew: true}]
        : []),
    ].forEach(({folders, isFavorite, isIgnored, isNew}) =>
      folders.forEach(folder => {
        const tlfType = rpcFolderTypeToTlfType(folder.folderType)
        const tlfName =
          tlfType === Types.TlfType.Private || tlfType === Types.TlfType.Public
            ? tlfToPreferredOrder(folder.name, state.config.username)
            : folder.name
        tlfType &&
          payload[tlfType].set(
            tlfName,
            Constants.makeTlf({
              conflictState: rpcConflictStateToConflictState(folder.conflictState || null),
              isFavorite,
              isIgnored,
              isNew,
              name: tlfName,
              resetParticipants: (folder.reset_members || []).map(({username}) => username),
              syncConfig: getSyncConfigFromRPC(tlfName, tlfType, folder.syncConfig || null),
              teamId: folder.team_id || '',
              tlfMtime: folder.mtime || 0,
            })
          )
      })
    )
    return payload.private.size ? FsGen.createFavoritesLoaded(payload) : undefined
  } catch (e) {
    return errorToActionOrThrow(e)
  }
}

const getSyncConfigFromRPC = (
  tlfName: string,
  tlfType: Types.TlfType,
  config: RPCTypes.FolderSyncConfig | null
): Types.TlfSyncConfig => {
  if (!config) {
    return Constants.tlfSyncDisabled
  }
  switch (config.mode) {
    case RPCTypes.FolderSyncMode.disabled:
      return Constants.tlfSyncDisabled
    case RPCTypes.FolderSyncMode.enabled:
      return Constants.tlfSyncEnabled
    case RPCTypes.FolderSyncMode.partial:
      return Constants.makeTlfSyncPartial({
        enabledPaths: config.paths
          ? config.paths.map(str => Types.getPathFromRelative(tlfName, tlfType, str))
          : [],
      })
    default:
      return Constants.tlfSyncDisabled
  }
}

const loadTlfSyncConfig = async (
  _: unknown,
  action: FsGen.LoadTlfSyncConfigPayload | FsGen.LoadPathMetadataPayload
) => {
  const tlfPath = action.type === FsGen.loadPathMetadata ? action.payload.path : action.payload.tlfPath
  const parsedPath = Constants.parsePath(tlfPath)
  if (parsedPath.kind !== Types.PathKind.GroupTlf && parsedPath.kind !== Types.PathKind.TeamTlf) {
    return false
  }
  try {
    const result = await RPCTypes.SimpleFSSimpleFSFolderSyncConfigAndStatusRpcPromise({
      path: Constants.pathToRPCPath(tlfPath),
    })
    return FsGen.createTlfSyncConfigLoaded({
      syncConfig: getSyncConfigFromRPC(parsedPath.tlfName, parsedPath.tlfType, result.config),
      tlfName: parsedPath.tlfName,
      tlfType: parsedPath.tlfType,
    })
  } catch (e) {
    return errorToActionOrThrow(e, tlfPath)
  }
}

const setTlfSyncConfig = async (_: unknown, action: FsGen.SetTlfSyncConfigPayload) => {
  await RPCTypes.SimpleFSSimpleFSSetFolderSyncConfigRpcPromise(
    {
      config: {
        mode: action.payload.enabled ? RPCTypes.FolderSyncMode.enabled : RPCTypes.FolderSyncMode.disabled,
      },
      path: Constants.pathToRPCPath(action.payload.tlfPath),
    },
    Constants.syncToggleWaitingKey
  )
  return FsGen.createLoadTlfSyncConfig({
    tlfPath: action.payload.tlfPath,
  })
}

const loadSettings = async () => {
  try {
    const settings = await RPCTypes.SimpleFSSimpleFSSettingsRpcPromise()
    return FsGen.createSettingsLoaded({
      settings: {
        ...Constants.emptySettings,
        loaded: true,
        sfmiBannerDismissed: settings.sfmiBannerDismissed,
        spaceAvailableNotificationThreshold: settings.spaceAvailableNotificationThreshold,
        syncOnCellular: settings.syncOnCellular,
      },
    })
  } catch {
    return FsGen.createSettingsLoaded({})
  }
}

const setSpaceNotificationThreshold = async (
  _: unknown,
  action: FsGen.SetSpaceAvailableNotificationThresholdPayload
) => {
  await RPCTypes.SimpleFSSimpleFSSetNotificationThresholdRpcPromise({
    threshold: action.payload.spaceAvailableNotificationThreshold,
  })
  return FsGen.createLoadSettings()
}

const getPrefetchStatusFromRPC = (
  prefetchStatus: RPCTypes.PrefetchStatus,
  prefetchProgress: RPCTypes.PrefetchProgress
) => {
  switch (prefetchStatus) {
    case RPCTypes.PrefetchStatus.notStarted:
      return Constants.prefetchNotStarted
    case RPCTypes.PrefetchStatus.inProgress:
      return {
        ...Constants.emptyPrefetchInProgress,
        bytesFetched: prefetchProgress.bytesFetched,
        bytesTotal: prefetchProgress.bytesTotal,
        endEstimate: prefetchProgress.endEstimate,
        startTime: prefetchProgress.start,
      }
    case RPCTypes.PrefetchStatus.complete:
      return Constants.prefetchComplete
    default:
      return Constants.prefetchNotStarted
  }
}

const direntToMetadata = (d: RPCTypes.Dirent) => ({
  lastModifiedTimestamp: d.time,
  lastWriter: d.lastWriterUnverified.username,
  name: d.name.split('/').pop(),
  prefetchStatus: getPrefetchStatusFromRPC(d.prefetchStatus, d.prefetchProgress),
  size: d.size,
  writable: d.writable,
})

const makeEntry = (d: RPCTypes.Dirent, children?: Set<string>): Types.PathItem => {
  switch (d.direntType) {
    case RPCTypes.DirentType.dir:
      return {
        ...Constants.emptyFolder,
        ...direntToMetadata(d),
        children: new Set(children || []),
        progress: children ? Types.ProgressType.Loaded : Types.ProgressType.Pending,
      } as Types.PathItem
    case RPCTypes.DirentType.sym:
      return {
        ...Constants.emptySymlink,
        ...direntToMetadata(d),
        // TODO: plumb link target
      } as Types.PathItem
    case RPCTypes.DirentType.file:
    case RPCTypes.DirentType.exec:
      return {
        ...Constants.emptyFile,
        ...direntToMetadata(d),
      } as Types.PathItem
  }
}

const folderList = async (
  _: Container.TypedState,
  action: FsGen.FolderListLoadPayload,
  listenerApi: Container.ListenerApi
) => {
  const rootPath = action.payload.path
  const isRecursive = action.type === FsGen.folderListLoad && action.payload.recursive
  try {
    const opID = Constants.makeUUID()
    if (isRecursive) {
      await RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise({
        depth: 1,
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: false,
      })
    } else {
      await RPCTypes.SimpleFSSimpleFSListRpcPromise({
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: false,
      })
    }

    await RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}, Constants.folderListWaitingKey)

    const result = await RPCTypes.SimpleFSSimpleFSReadListRpcPromise({opID})
    const entries = result.entries || []
    const childMap = entries.reduce((m, d) => {
      const [parent, child] = d.name.split('/')
      if (child) {
        // Only add to the children set if the parent definitely has children.
        const fullParent = Types.pathConcat(rootPath, parent)
        let children = m.get(fullParent)
        if (!children) {
          children = new Set()
          m.set(fullParent, children)
        }
        children.add(child)
      } else {
        let children = m.get(rootPath)
        if (!children) {
          children = new Set()
          m.set(rootPath, children)
        }
        children.add(d.name)
      }
      return m
    }, new Map())

    const direntToPathAndPathItem = (d: RPCTypes.Dirent) => {
      const path = Types.pathConcat(rootPath, d.name)
      const entry = makeEntry(d, childMap.get(path))
      if (entry.type === Types.PathType.Folder && isRecursive && !d.name.includes('/')) {
        // Since we are loading with a depth of 2, first level directories are
        // considered "loaded".
        return [
          path,
          {
            ...entry,
            progress: Types.ProgressType.Loaded,
          },
        ]
      }
      return [path, entry]
    }

    // Get metadata fields of the directory that we just loaded from state to
    // avoid overriding them.
    const state = listenerApi.getState()
    const rootPathItem = Constants.getPathItem(state.fs.pathItems, rootPath)
    const rootFolder: Types.FolderPathItem = {
      ...(rootPathItem.type === Types.PathType.Folder
        ? rootPathItem
        : {...Constants.emptyFolder, name: Types.getPathName(rootPath)}),
      children: new Set(childMap.get(rootPath)),
      progress: Types.ProgressType.Loaded,
    }

    // @ts-ignore TODO fix this
    const pathItems: Array<[Types.Path, Types.FolderPathItem]> = [
      ...(Types.getPathLevel(rootPath) > 2 ? [[rootPath, rootFolder]] : []),
      ...entries.map(direntToPathAndPathItem),
    ]
    listenerApi.dispatch(FsGen.createFolderListLoaded({path: rootPath, pathItems: new Map(pathItems)}))
  } catch (error) {
    const toPut = errorToActionOrThrow(error, rootPath)
    if (toPut) {
      listenerApi.dispatch(toPut)
    }
  }
}

const download = async (
  _: unknown,
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
) => {
  await requestPermissionsToWrite()
  const downloadID = await RPCTypes.SimpleFSSimpleFSStartDownloadRpcPromise({
    isRegularDownload: action.type === FsGen.download,
    path: Constants.pathToRPCPath(action.payload.path).kbfs,
  })
  return action.type === FsGen.download
    ? null
    : FsGen.createSetPathItemActionMenuDownload({
        downloadID,
        intent: Constants.getDownloadIntentFromAction(action),
      })
}

const cancelDownload = async (_: unknown, action: FsGen.CancelDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSCancelDownloadRpcPromise({downloadID: action.payload.downloadID})

const dismissDownload = async (_: unknown, action: FsGen.DismissDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSDismissDownloadRpcPromise({downloadID: action.payload.downloadID})

const upload = async (_: Container.TypedState, action: FsGen.UploadPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSStartUploadRpcPromise({
      sourceLocalPath: Types.getNormalizedLocalPath(action.payload.localPath),
      targetParentPath: Constants.pathToRPCPath(action.payload.parentPath).kbfs,
    })
    return false
  } catch (err) {
    return errorToActionOrThrow(err)
  }
}

const loadUploadStatus = async () => {
  try {
    const uploadStates = await RPCTypes.SimpleFSSimpleFSGetUploadStatusRpcPromise()
    return FsGen.createLoadedUploadStatus({uploadStates: uploadStates || []})
  } catch (err) {
    return errorToActionOrThrow(err)
  }
}

const uploadFromDragAndDrop = async (_: Container.TypedState, action: FsGen.UploadFromDragAndDropPayload) => {
  if (Platform.isDarwin && darwinCopyToKBFSTempUploadFile) {
    const dir = await RPCTypes.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
    const localPaths = await Promise.all(
      action.payload.localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath))
    )
    return localPaths.map(localPath =>
      FsGen.createUpload({
        localPath,
        parentPath: action.payload.parentPath,
      })
    )
  }
  return action.payload.localPaths.map(localPath =>
    FsGen.createUpload({
      localPath,
      parentPath: action.payload.parentPath,
    })
  )
}

const dismissUpload = async (_: Container.TypedState, action: FsGen.DismissUploadPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSDismissUploadRpcPromise({uploadID: action.payload.uploadID})
  } catch {}
  return false
}

const getWaitDuration = (endEstimate: number | null, lower: number, upper: number): number => {
  if (!endEstimate) {
    return upper
  }

  const diff = endEstimate - Date.now()
  return diff < lower ? lower : diff > upper ? upper : diff
}

// TODO: move these logic into Go HOTPOT-533
let polling = false
const pollJournalFlushStatusUntilDone = async (
  _s: unknown,
  _a: unknown,
  listenerApi: Container.ListenerApi
) => {
  if (polling) {
    return
  }
  polling = true
  try {
    // eslint-disable-next-line
    while (1) {
      const {syncingPaths, totalSyncingBytes, endEstimate} =
        await RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise({
          filter: RPCTypes.ListFilter.filterSystemHidden,
        })
      listenerApi.dispatch(
        FsGen.createJournalUpdate({
          endEstimate,
          syncingPaths: (syncingPaths || []).map(Types.stringToPath),
          totalSyncingBytes,
        })
      )

      // It's possible syncingPaths has not been emptied before
      // totalSyncingBytes becomes 0. So check both.
      if (totalSyncingBytes <= 0 && !syncingPaths?.length) {
        break
      }

      listenerApi.dispatch(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: true}))
      await listenerApi.delay(getWaitDuration(endEstimate || null, 100, 4000)) // 0.1s to 4s
    }
  } finally {
    polling = false
    listenerApi.dispatch(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false}))
    listenerApi.dispatch(FsGen.createCheckKbfsDaemonRpcStatus())
  }
}

const ignoreFavorite = async (_: Container.TypedState, action: FsGen.FavoriteIgnorePayload) => {
  const folder = Constants.folderRPCFromPath(action.payload.path)
  if (!folder) {
    throw new Error('No folder specified')
  }
  try {
    await RPCTypes.favoriteFavoriteIgnoreRpcPromise({folder})
    return null
  } catch (error) {
    return [
      FsGen.createFavoriteIgnore({path: action.payload.path}),
      errorToActionOrThrow(error, action.payload.path),
    ]
  }
}

const commitEdit = async (state: Container.TypedState, action: FsGen.CommitEditPayload) => {
  const {editID} = action.payload
  const edit = state.fs.edits.get(editID)
  if (!edit) {
    return false
  }
  switch (edit.type) {
    case Types.EditType.NewFolder:
      try {
        await RPCTypes.SimpleFSSimpleFSOpenRpcPromise(
          {
            dest: Constants.pathToRPCPath(Types.pathConcat(edit.parentPath, edit.name)),
            flags: RPCTypes.OpenFlags.directory,
            opID: Constants.makeUUID(),
          },
          Constants.commitEditWaitingKey
        )
        return FsGen.createEditSuccess({editID})
      } catch (e) {
        return errorToActionOrThrow(e, edit.parentPath)
      }
    case Types.EditType.Rename:
      try {
        const opID = Constants.makeUUID()
        await RPCTypes.SimpleFSSimpleFSMoveRpcPromise({
          dest: Constants.pathToRPCPath(Types.pathConcat(edit.parentPath, edit.name)),
          opID,
          overwriteExistingFiles: false,
          src: Constants.pathToRPCPath(Types.pathConcat(edit.parentPath, edit.originalName)),
        })
        await RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}, Constants.commitEditWaitingKey)
        return FsGen.createEditSuccess({editID})
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        if (
          [RPCTypes.StatusCode.scsimplefsnameexists, RPCTypes.StatusCode.scsimplefsdirnotempty].includes(
            error.code
          )
        ) {
          return FsGen.createEditError({editID, error: error.desc || 'name exists'})
        }
        throw error
      }
  }
}

const loadPathMetadata = async (_: Container.TypedState, action: FsGen.LoadPathMetadataPayload) => {
  const {path} = action.payload
  try {
    const dirent = await RPCTypes.SimpleFSSimpleFSStatRpcPromise(
      {
        path: Constants.pathToRPCPath(path),
        refreshSubscription: false,
      },
      Constants.statWaitingKey
    )
    return FsGen.createPathItemLoaded({
      path,
      pathItem: makeEntry(dirent),
    })
  } catch (err) {
    return errorToActionOrThrow(err, path)
  }
}

const letResetUserBackIn = async (_: unknown, action: FsGen.LetResetUserBackInPayload) => {
  try {
    await RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise({
      id: action.payload.id,
      username: action.payload.username,
    })
  } catch (error) {
    return errorToActionOrThrow(error)
  }
  return
}

const updateFsBadge = (state: Container.TypedState) => {
  const counts = new Map<Tabs.Tab, number>()
  counts.set(Tabs.fsTab, Constants.computeBadgeNumberForAll(state.fs.tlfs))
  return NotificationsGen.createSetBadgeCounts({counts})
}

const deleteFile = async (_: unknown, action: FsGen.DeleteFilePayload) => {
  const opID = Constants.makeUUID()
  try {
    await RPCTypes.SimpleFSSimpleFSRemoveRpcPromise({
      opID,
      path: Constants.pathToRPCPath(action.payload.path),
      recursive: true,
    })
    await RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID})
  } catch (e) {
    return errorToActionOrThrow(e, action.payload.path)
  }
  return
}

const moveOrCopy = async (state: Container.TypedState, action: FsGen.MovePayload | FsGen.CopyPayload) => {
  if (state.fs.destinationPicker.source.type === Types.DestinationPickerSource.None) {
    return
  }

  const params =
    state.fs.destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy
      ? [
          {
            dest: Constants.pathToRPCPath(
              Types.pathConcat(
                action.payload.destinationParentPath,
                Types.getPathName(state.fs.destinationPicker.source.path)
              )
            ),
            opID: Constants.makeUUID(),
            overwriteExistingFiles: false,
            src: Constants.pathToRPCPath(state.fs.destinationPicker.source.path),
          },
        ]
      : state.fs.destinationPicker.source.source
          .map(item => ({originalPath: item.originalPath ?? '', scaledPath: item.scaledPath}))
          .filter(({originalPath}) => !!originalPath)
          .map(({originalPath, scaledPath}) => ({
            dest: Constants.pathToRPCPath(
              Types.pathConcat(
                action.payload.destinationParentPath,
                Types.getLocalPathName(originalPath)
                // We use the local path name here since we only care about file name.
              )
            ),
            opID: Constants.makeUUID(),
            overwriteExistingFiles: false,
            src: {
              PathType: RPCTypes.PathType.local,
              local: Types.getNormalizedLocalPath(
                // @ts-ignore
                state.config.incomingShareUseOriginal ? originalPath : scaledPath || originalPath
              ),
            } as RPCTypes.Path,
          }))

  try {
    const rpc =
      action.type === FsGen.move
        ? RPCTypes.SimpleFSSimpleFSMoveRpcPromise
        : RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise
    await Promise.all(params.map(async p => rpc(p)))
    await Promise.all(params.map(async ({opID}) => RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID})))
    return null
    // We get source/dest paths from state rather than action, so we can't
    // just retry it. If we do want retry in the future we can include those
    // paths in the action.
  } catch (e) {
    return errorToActionOrThrow(e, action.payload.destinationParentPath)
  }
}

const showMoveOrCopy = () =>
  RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})

// Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
// reducer and happens before this.
let waitForKbfsDaemonInProgress = false
const waitForKbfsDaemon = async () => {
  if (waitForKbfsDaemonInProgress) {
    return
  }
  waitForKbfsDaemonInProgress = true
  try {
    await RPCTypes.configWaitForClientRpcPromise({
      clientType: RPCTypes.ClientType.kbfs,
      timeout: 60, // 1min. This is arbitrary since we're gonna check again anyway if we're not connected.
    })
  } catch (_) {}

  waitForKbfsDaemonInProgress = false
  return FsGen.createCheckKbfsDaemonRpcStatus()
}

const checkKbfsDaemonRpcStatus = async (state: Container.TypedState) => {
  const connected = await RPCTypes.configWaitForClientRpcPromise({
    clientType: RPCTypes.ClientType.kbfs,
    timeout: 0, // Don't wait; just check if it's there.
  })
  const newStatus = connected ? Types.KbfsDaemonRpcStatus.Connected : Types.KbfsDaemonRpcStatus.Waiting
  return [
    state.fs.kbfsDaemonStatus.rpcStatus !== newStatus &&
      FsGen.createKbfsDaemonRpcStatusChanged({rpcStatus: newStatus}),
    newStatus === Types.KbfsDaemonRpcStatus.Waiting && FsGen.createWaitForKbfsDaemon(),
  ]
}

const startManualCR = async (_: unknown, action: FsGen.StartManualConflictResolutionPayload) => {
  await RPCTypes.SimpleFSSimpleFSClearConflictStateRpcPromise({
    path: Constants.pathToRPCPath(action.payload.tlfPath),
  })
  return FsGen.createFavoritesLoad()
}

const finishManualCR = async (_: unknown, action: FsGen.FinishManualConflictResolutionPayload) => {
  await RPCTypes.SimpleFSSimpleFSFinishResolvingConflictRpcPromise({
    path: Constants.pathToRPCPath(action.payload.localViewTlfPath),
  })
  return FsGen.createFavoritesLoad()
}

// At start-up we might have a race where we get connected to a kbfs daemon
// which dies soon after, and we get an EOF here. So retry for a few times
// until we get through. After each try we delay for 2s, so this should give us
// e.g. 12s when n == 6. If it still doesn't work after 12s, something's wrong
// and we deserve a black bar.
const checkIfWeReConnectedToMDServerUpToNTimes = async (n: number) => {
  try {
    const onlineStatus = await RPCTypes.SimpleFSSimpleFSGetOnlineStatusRpcPromise({clientID})
    return FsGen.createKbfsDaemonOnlineStatusChanged({onlineStatus})
  } catch (error) {
    if (n > 0) {
      logger.warn(`failed to check if we are connected to MDServer: ${error}; n=${n}`)
      await Container.timeoutPromise(2000)
      return checkIfWeReConnectedToMDServerUpToNTimes(n - 1)
    } else {
      logger.warn(`failed to check if we are connected to MDServer : ${error}; n=${n}, throwing`)
      throw error
    }
  }
}

// We don't trigger the reachability check at init. Reachability checks cause
// any pending "reconnect" fire right away, and overrides any random back-off
// timer we have at process restart (which is there to avoid surging server
// load around app releases). So only do that when OS network status changes
// after we're up.
const checkKbfsServerReachabilityIfNeeded = async (
  _: unknown,
  action: ConfigGen.OsNetworkStatusChangedPayload
) => {
  if (!action.payload.isInit) {
    try {
      await RPCTypes.SimpleFSSimpleFSCheckReachabilityRpcPromise()
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      logger.warn(`failed to check KBFS reachability: ${error.message}`)
    }
  }
  return null
}

const onNotifyFSOverallSyncSyncStatusChanged = (
  state: Container.TypedState,
  action: EngineGen.Keybase1NotifyFSFSOverallSyncStatusChangedPayload
) => {
  const diskSpaceStatus = action.payload.params.status.outOfSyncSpace
    ? Types.DiskSpaceStatus.Error
    : action.payload.params.status.localDiskBytesAvailable <
      state.fs.settings.spaceAvailableNotificationThreshold
    ? Types.DiskSpaceStatus.Warning
    : Types.DiskSpaceStatus.Ok
  // We need to type this separately since otherwise we can't concat to it.
  const actions: Array<
    | NotificationsGen.BadgeAppPayload
    | FsGen.OverallSyncStatusChangedPayload
    | FsGen.ShowHideDiskSpaceBannerPayload
  > = [
    FsGen.createOverallSyncStatusChanged({
      diskSpaceStatus,
      progress: action.payload.params.status.prefetchProgress,
    }),
  ]
  // Only notify about the disk space status if it has changed.
  if (diskSpaceStatus !== state.fs.overallSyncStatus.diskSpaceStatus) {
    switch (diskSpaceStatus) {
      case Types.DiskSpaceStatus.Error:
        NotifyPopup('Sync Error', {
          body: 'You are out of disk space. Some folders could not be synced.',
          sound: true,
        })
        return actions.concat([
          NotificationsGen.createBadgeApp({
            key: 'outOfSpace',
            on: action.payload.params.status.outOfSyncSpace,
          }),
        ])
      case Types.DiskSpaceStatus.Warning:
        {
          const threshold = Constants.humanizeBytes(state.fs.settings.spaceAvailableNotificationThreshold, 0)
          NotifyPopup('Disk Space Low', {
            body: `You have less than ${threshold} of storage space left.`,
          })
          // Only show the banner if the previous state was OK and the new state
          // is warning. Otherwise we rely on the previous state of the banner.
          if (state.fs.overallSyncStatus.diskSpaceStatus === Types.DiskSpaceStatus.Ok) {
            return actions.concat([FsGen.createShowHideDiskSpaceBanner({show: true})])
          }
        }
        break
      case Types.DiskSpaceStatus.Ok:
        break
      default:
    }
  }
  return actions
}

const setTlfsAsUnloadedWhenKbfsDaemonDisconnects = (state: Container.TypedState) =>
  state.fs.kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected &&
  FsGen.createSetTlfsAsUnloaded()

const setDebugLevel = async (_: unknown, action: FsGen.SetDebugLevelPayload) =>
  RPCTypes.SimpleFSSimpleFSSetDebugLevelRpcPromise({level: action.payload.level})

const subscriptionDeduplicateIntervalSecond = 1

const subscribePath = async (_: unknown, action: FsGen.SubscribePathPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSSubscribePathRpcPromise({
      clientID,
      deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      kbfsPath: Types.pathToString(action.payload.path),
      subscriptionID: action.payload.subscriptionID,
      topic: action.payload.topic,
    })
    return null
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (error.code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      // We'll handle this error in loadAdditionalTLF instead.
      return
    }
    return errorToActionOrThrow(error, action.payload.path)
  }
}

const subscribeNonPath = async (_: unknown, action: FsGen.SubscribeNonPathPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
      clientID,
      deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      subscriptionID: action.payload.subscriptionID,
      topic: action.payload.topic,
    })
    return null
  } catch (err) {
    return errorToActionOrThrow(err)
  }
}

const unsubscribe = async (_: unknown, action: FsGen.UnsubscribePayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSUnsubscribeRpcPromise({
      clientID,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      subscriptionID: action.payload.subscriptionID,
    })
  } catch (_) {}
}

const onPathChange = (_: unknown, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPathPayload) => {
  const {clientID: clientIDFromNotification, path, topics} = action.payload.params
  if (clientIDFromNotification !== clientID) {
    return null
  }
  /* eslint-disable-next-line */ // not smart enought to know all cases covered
  return topics?.map(topic => {
    switch (topic) {
      case RPCTypes.PathSubscriptionTopic.children:
        return FsGen.createFolderListLoad({path: Types.stringToPath(path), recursive: false})
      case RPCTypes.PathSubscriptionTopic.stat:
        return FsGen.createLoadPathMetadata({path: Types.stringToPath(path)})
    }
  })
}

const onNonPathChange = (_: unknown, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPayload) => {
  const {clientID: clientIDFromNotification, topic} = action.payload.params
  if (clientIDFromNotification !== clientID) {
    return null
  }
  switch (topic) {
    case RPCTypes.SubscriptionTopic.favorites:
      return FsGen.createFavoritesLoad()
    case RPCTypes.SubscriptionTopic.journalStatus:
      return FsGen.createPollJournalStatus()
    case RPCTypes.SubscriptionTopic.onlineStatus:
      return checkIfWeReConnectedToMDServerUpToNTimes(1)
    case RPCTypes.SubscriptionTopic.downloadStatus:
      return FsGen.createLoadDownloadStatus()
    case RPCTypes.SubscriptionTopic.uploadStatus:
      return FsGen.createLoadUploadStatus()
    case RPCTypes.SubscriptionTopic.filesTabBadge:
      return FsGen.createLoadFilesTabBadge()
    case RPCTypes.SubscriptionTopic.settings:
      return FsGen.createLoadSettings()
    case RPCTypes.SubscriptionTopic.overallSyncStatus:
      return undefined
  }
}

const getOnlineStatus = () => checkIfWeReConnectedToMDServerUpToNTimes(2)

const loadPathInfo = async (_: unknown, action: FsGen.LoadPathInfoPayload) => {
  const pathInfo = await RPCTypes.kbfsMountGetKBFSPathInfoRpcPromise({
    standardPath: Types.pathToString(action.payload.path),
  })
  return FsGen.createLoadedPathInfo({
    path: action.payload.path,
    pathInfo: {
      deeplinkPath: pathInfo.deeplinkPath,
      platformAfterMountPath: pathInfo.platformAfterMountPath,
    },
  })
}

const loadDownloadInfo = async (_: Container.TypedState, action: FsGen.LoadDownloadInfoPayload) => {
  try {
    const res = await RPCTypes.SimpleFSSimpleFSGetDownloadInfoRpcPromise({
      downloadID: action.payload.downloadID,
    })

    return FsGen.createLoadedDownloadInfo({
      downloadID: action.payload.downloadID,
      info: {
        filename: res.filename,
        isRegularDownload: res.isRegularDownload,
        path: Types.stringToPath('/keybase' + res.path.path),
        startTime: res.startTime,
      },
    })
  } catch (error) {
    return errorToActionOrThrow(error)
  }
}

const loadDownloadStatus = async () => {
  try {
    const res = await RPCTypes.SimpleFSSimpleFSGetDownloadStatusRpcPromise()
    return FsGen.createLoadedDownloadStatus({
      regularDownloads: res.regularDownloadIDs || [],
      state: new Map(
        (res.states || []).map(s => [
          s.downloadID,
          {
            canceled: s.canceled,
            done: s.done,
            endEstimate: s.endEstimate,
            error: s.error,
            localPath: s.localPath,
            progress: s.progress,
          },
        ])
      ),
    })
  } catch (error) {
    return errorToActionOrThrow(error)
  }
}

const loadFileContext = async (_: unknown, action: FsGen.LoadFileContextPayload) => {
  try {
    const res = await RPCTypes.SimpleFSSimpleFSGetGUIFileContextRpcPromise({
      path: Constants.pathToRPCPath(action.payload.path).kbfs,
    })
    return FsGen.createLoadedFileContext({
      fileContext: {
        contentType: res.contentType,
        url: res.url,
        viewType: res.viewType,
      },
      path: action.payload.path,
    })
  } catch (err) {
    return errorToActionOrThrow(err)
  }
}

const loadFilesTabBadge = async () => {
  try {
    const badge = await RPCTypes.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
    return FsGen.createLoadedFilesTabBadge({badge})
  } catch {
    // retry once HOTPOT-1226
    try {
      const badge = await RPCTypes.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
      return FsGen.createLoadedFilesTabBadge({badge})
    } catch {}
  }
  return false
}

const userIn = async () => RPCTypes.SimpleFSSimpleFSUserInRpcPromise({clientID}).catch(() => {})
const userOut = async () => RPCTypes.SimpleFSSimpleFSUserOutRpcPromise({clientID}).catch(() => {})

let fsBadgeSubscriptionID: string = ''

const subscribeAndLoadFsBadge = (state: Container.TypedState) => {
  const oldFsBadgeSubscriptionID = fsBadgeSubscriptionID
  fsBadgeSubscriptionID = Constants.makeUUID()
  return (
    state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldFsBadgeSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldFsBadgeSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: fsBadgeSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.filesTabBadge,
      }),
      FsGen.createLoadFilesTabBadge(),
    ]
  )
}

let uploadStatusSubscriptionID: string = ''
const subscribeAndLoadUploadStatus = (state: Container.TypedState) => {
  const oldUploadStatusSubscriptionID = uploadStatusSubscriptionID
  uploadStatusSubscriptionID = Constants.makeUUID()
  return (
    state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldUploadStatusSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldUploadStatusSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: uploadStatusSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.uploadStatus,
      }),
      FsGen.createLoadUploadStatus(),
    ]
  )
}

let journalStatusSubscriptionID: string = ''
const subscribeAndLoadJournalStatus = (state: Container.TypedState) => {
  const oldJournalStatusSubscriptionID = journalStatusSubscriptionID
  journalStatusSubscriptionID = Constants.makeUUID()
  return (
    state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldJournalStatusSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldJournalStatusSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: journalStatusSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.journalStatus,
      }),
      FsGen.createPollJournalStatus(),
    ]
  )
}

let settingsSubscriptionID: string = ''
const subscribeAndLoadSettings = (state: Container.TypedState) => {
  const oldSettingsSubscriptionID = settingsSubscriptionID
  settingsSubscriptionID = Constants.makeUUID()
  return (
    state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && [
      ...(oldSettingsSubscriptionID
        ? [FsGen.createUnsubscribe({subscriptionID: oldSettingsSubscriptionID})]
        : []),
      FsGen.createSubscribeNonPath({
        subscriptionID: settingsSubscriptionID,
        topic: RPCTypes.SubscriptionTopic.settings,
      }),
      FsGen.createLoadSettings(),
    ]
  )
}

const maybeClearCriticalUpdate = (state: Container.TypedState, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  // Clear critical update when we nav away from tab
  if (
    state.fs.criticalUpdate &&
    prev &&
    Router2Constants.getTab(prev) === Tabs.fsTab &&
    next &&
    Router2Constants.getTab(next) !== Tabs.fsTab
  ) {
    return FsGen.createSetCriticalUpdate({val: false})
  }
  return false
}

const fsRrouteNames = ['fsRoot', 'barePreview']
const maybeOnFSTab = (_: unknown, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  const wasScreen = fsRrouteNames.includes(Router2Constants.getVisibleScreen(prev)?.name ?? '')
  const isScreen = fsRrouteNames.includes(Router2Constants.getVisibleScreen(next)?.name ?? '')

  if (wasScreen === isScreen) {
    return false
  }
  return wasScreen ? FsGen.createUserOut() : FsGen.createUserIn()
}

const initFS = () => {
  Container.listenAction(FsGen.upload, upload)
  Container.listenAction(FsGen.uploadFromDragAndDrop, uploadFromDragAndDrop)
  Container.listenAction(FsGen.loadUploadStatus, loadUploadStatus)
  Container.listenAction(FsGen.dismissUpload, dismissUpload)
  Container.listenAction(FsGen.folderListLoad, folderList)
  Container.listenAction(FsGen.favoritesLoad, loadFavorites)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, setTlfsAsUnloadedWhenKbfsDaemonDisconnects)
  Container.listenAction(FsGen.favoriteIgnore, ignoreFavorite)
  Container.listenAction(FsGen.favoritesLoaded, updateFsBadge)
  Container.listenAction(FsGen.loadAdditionalTlf, loadAdditionalTlf)
  Container.listenAction(FsGen.letResetUserBackIn, letResetUserBackIn)
  Container.listenAction(FsGen.commitEdit, commitEdit)
  Container.listenAction(FsGen.deleteFile, deleteFile)
  Container.listenAction(FsGen.loadPathMetadata, loadPathMetadata)
  Container.listenAction(FsGen.pollJournalStatus, pollJournalFlushStatusUntilDone)
  Container.listenAction([FsGen.move, FsGen.copy], moveOrCopy)
  Container.listenAction([FsGen.showMoveOrCopy, FsGen.showIncomingShare], showMoveOrCopy)
  Container.listenAction(
    [ConfigGen.installerRan, ConfigGen.loggedIn, FsGen.userIn, FsGen.checkKbfsDaemonRpcStatus],
    checkKbfsDaemonRpcStatus
  )
  Container.listenAction(FsGen.waitForKbfsDaemon, waitForKbfsDaemon)
  Container.listenAction(FsGen.setTlfSyncConfig, setTlfSyncConfig)
  Container.listenAction(FsGen.loadTlfSyncConfig, loadTlfSyncConfig)
  Container.listenAction([FsGen.getOnlineStatus], getOnlineStatus)
  Container.listenAction(ConfigGen.osNetworkStatusChanged, checkKbfsServerReachabilityIfNeeded)
  Container.listenAction(
    EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged,
    onNotifyFSOverallSyncSyncStatusChanged
  )
  Container.listenAction(FsGen.userIn, userIn)
  Container.listenAction(FsGen.userOut, userOut)
  Container.listenAction(FsGen.loadSettings, loadSettings)
  Container.listenAction(FsGen.setSpaceAvailableNotificationThreshold, setSpaceNotificationThreshold)
  Container.listenAction(FsGen.startManualConflictResolution, startManualCR)
  Container.listenAction(FsGen.finishManualConflictResolution, finishManualCR)
  Container.listenAction(FsGen.loadPathInfo, loadPathInfo)
  Container.listenAction(FsGen.loadFileContext, loadFileContext)
  Container.listenAction(FsGen.loadFilesTabBadge, loadFilesTabBadge)

  Container.listenAction([FsGen.download, FsGen.shareNative, FsGen.saveMedia], download)
  Container.listenAction(FsGen.cancelDownload, cancelDownload)
  Container.listenAction(FsGen.dismissDownload, dismissDownload)
  Container.listenAction(FsGen.loadDownloadStatus, loadDownloadStatus)
  Container.listenAction(FsGen.loadDownloadInfo, loadDownloadInfo)

  Container.listenAction(FsGen.subscribePath, subscribePath)
  Container.listenAction(FsGen.subscribeNonPath, subscribeNonPath)
  Container.listenAction(FsGen.unsubscribe, unsubscribe)
  Container.listenAction(EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath, onPathChange)
  Container.listenAction(EngineGen.keybase1NotifyFSFSSubscriptionNotify, onNonPathChange)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadFsBadge)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadSettings)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadUploadStatus)
  Container.listenAction(FsGen.kbfsDaemonRpcStatusChanged, subscribeAndLoadJournalStatus)

  Container.listenAction(FsGen.setDebugLevel, setDebugLevel)

  Container.listenAction(RouteTreeGen.onNavChanged, maybeClearCriticalUpdate)
  Container.listenAction(RouteTreeGen.onNavChanged, maybeOnFSTab)

  initPlatformSpecific()
}

export default initFS
