import * as Constants from '../../constants/fs'
import * as EngineGen from '../engine-gen-gen'
import * as FsGen from '../fs-gen'
import * as ConfigGen from '../config-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as Flow from '../../util/flow'
import * as Tabs from '../../constants/tabs'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import {TypedState} from '../../util/container'
import logger from '../../logger'
import platformSpecificSaga, {ensureDownloadPermissionPromise} from './platform-specific'
import * as RouteTreeGen from '../route-tree-gen'
import {tlfToPreferredOrder} from '../../util/kbfs'
import {makeRetriableErrorHandler, makeUnretriableErrorHandler} from './shared'
import {NotifyPopup} from '../../native/notifications'

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
        localViewTlfPaths: ((nv && nv.localViews) || []).reduce<Array<Types.Path>>((arr, p) => {
          // @ts-ignore TODO fix p.kbfs.path is a path already
          p.PathType === RPCTypes.PathType.kbfs && arr.push(Constants.rpcPathToPath(p.kbfs))
          return arr
        }, []),
        resolvingConflict: !!nv && nv.resolvingConflict,
        stuckInConflict: !!nv && nv.stuckInConflict,
      })
    } else {
      const nv =
        rpcConflictState.manualresolvinglocalview && rpcConflictState.manualresolvinglocalview.normalView
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

const loadAdditionalTlf = async (state: TypedState, action: FsGen.LoadAdditionalTlfPayload) => {
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
  } catch (e) {
    return makeRetriableErrorHandler(action, action.payload.tlfPath)(e)
  }
}

const loadFavorites = async (state: TypedState, action: FsGen.FavoritesLoadPayload) => {
  try {
    if (
      state.fs.kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected ||
      !state.config.loggedIn
    ) {
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
    return makeRetriableErrorHandler(action)(e)
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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(config.mode)
      return Constants.tlfSyncDisabled
  }
}

const loadTlfSyncConfig = async (
  _: TypedState,
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
    return makeUnretriableErrorHandler(action, tlfPath)(e)
  }
}

const setTlfSyncConfig = async (_: TypedState, action: FsGen.SetTlfSyncConfigPayload) => {
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
        spaceAvailableNotificationThreshold: settings.spaceAvailableNotificationThreshold,
      },
    })
  } catch (_) {
    return FsGen.createSettingsLoaded({})
  }
}

const setSpaceNotificationThreshold = async (
  _: TypedState,
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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(prefetchStatus)
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

function* folderList(_: TypedState, action: FsGen.FolderListLoadPayload) {
  const rootPath = action.payload.path
  const isRecursive = action.type === FsGen.folderListLoad && action.payload.recursive
  try {
    const opID = Constants.makeUUID()
    if (isRecursive) {
      yield RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise({
        depth: 1,
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: false,
      })
    } else {
      yield RPCTypes.SimpleFSSimpleFSListRpcPromise({
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: false,
      })
    }

    yield RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}, Constants.folderListWaitingKey)

    const result: Saga.RPCPromiseType<typeof RPCTypes.SimpleFSSimpleFSReadListRpcPromise> = yield RPCTypes.SimpleFSSimpleFSReadListRpcPromise(
      {opID}
    )
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
      if (entry.type === Types.PathType.Folder && isRecursive && d.name.indexOf('/') < 0) {
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
    const state: TypedState = yield* Saga.selectState()
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
    yield Saga.put(FsGen.createFolderListLoaded({path: rootPath, pathItems: new Map(pathItems)}))
  } catch (error) {
    yield makeRetriableErrorHandler(action, rootPath)(error).map(action => Saga.put(action))
  }
}

const download = async (
  _: TypedState,
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
) => {
  await ensureDownloadPermissionPromise()
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

const cancelDownload = (_: TypedState, action: FsGen.CancelDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSCancelDownloadRpcPromise({downloadID: action.payload.downloadID})

const dismissDownload = (_: TypedState, action: FsGen.DismissDownloadPayload) =>
  RPCTypes.SimpleFSSimpleFSDismissDownloadRpcPromise({downloadID: action.payload.downloadID})

function* upload(_: TypedState, action: FsGen.UploadPayload) {
  const {parentPath, localPath} = action.payload
  const opID = Constants.makeUUID()
  const path = Constants.getUploadedPath(parentPath, localPath)

  yield Saga.put(FsGen.createUploadStarted({path}))

  // TODO: confirm overwrites?
  // TODO: what about directory merges?
  yield RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise({
    dest: Constants.pathToRPCPath(path),
    opID,
    src: {PathType: RPCTypes.PathType.local, local: Types.getNormalizedLocalPath(localPath)},
  })

  try {
    yield RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID})
    yield Saga.put(FsGen.createUploadWritingSuccess({path}))
  } catch (error) {
    yield makeRetriableErrorHandler(action, path)(error).map(action => Saga.put(action))
  }
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
function* pollJournalFlushStatusUntilDone() {
  if (polling) {
    return
  }
  polling = true
  try {
    while (1) {
      let {
        syncingPaths,
        totalSyncingBytes,
        endEstimate,
      }: Saga.RPCPromiseType<typeof RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise> = yield RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise(
        {
          filter: RPCTypes.ListFilter.filterSystemHidden,
        }
      )
      yield Saga.sequentially([
        Saga.put(
          FsGen.createJournalUpdate({
            endEstimate,
            syncingPaths: (syncingPaths || []).map(Types.stringToPath),
            totalSyncingBytes,
          })
        ),
      ])

      // It's possible syncingPaths has not been emptied before
      // totalSyncingBytes becomes 0. So check both.
      if (totalSyncingBytes <= 0 && !(syncingPaths && syncingPaths.length)) {
        break
      }

      yield Saga.sequentially([
        Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: true})),
        Saga.delay(getWaitDuration(endEstimate || null, 100, 4000)), // 0.1s to 4s
      ])
    }
  } finally {
    // eslint is confused i think
    // eslint-disable-next-line require-atomic-updates
    polling = false
    yield Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false}))
  }
}

function* ignoreFavoriteSaga(_: TypedState, action: FsGen.FavoriteIgnorePayload) {
  const folder = Constants.folderRPCFromPath(action.payload.path)
  if (!folder) {
    // TODO: make the ignore button have a pending state and get rid of this?
    yield Saga.put(
      FsGen.createFavoriteIgnoreError({
        error: Constants.makeError({
          error: 'No folder specified',
          erroredAction: action,
        }),
        path: action.payload.path,
      })
    )
  } else {
    try {
      yield RPCTypes.favoriteFavoriteIgnoreRpcPromise({folder})
    } catch (error) {
      yield makeRetriableErrorHandler(action, action.payload.path)(error).map(action => Saga.put(action))
    }
  }
}

const commitEdit = async (state: TypedState, action: FsGen.CommitEditPayload) => {
  const {editID} = action.payload
  const edit = state.fs.edits.get(editID)
  if (!edit) {
    return false
  }
  const {parentPath, name, type} = edit as Types.Edit
  switch (type) {
    case Types.EditType.NewFolder:
      try {
        await RPCTypes.SimpleFSSimpleFSOpenRpcPromise({
          dest: Constants.pathToRPCPath(Types.pathConcat(parentPath, name)),
          flags: RPCTypes.OpenFlags.directory,
          opID: Constants.makeUUID(),
        })
        return FsGen.createEditSuccess({editID, parentPath})
      } catch (e) {
        return makeRetriableErrorHandler(action, parentPath)(e)
      }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(type)
      return false
  }
}

function* loadPathMetadata(_: TypedState, action: FsGen.LoadPathMetadataPayload) {
  const {path} = action.payload

  try {
    const dirent = yield RPCTypes.SimpleFSSimpleFSStatRpcPromise(
      {
        path: Constants.pathToRPCPath(path),
        refreshSubscription: false,
      },
      Constants.statWaitingKey
    )
    yield Saga.put(
      FsGen.createPathItemLoaded({
        path,
        pathItem: makeEntry(dirent),
      })
    )
  } catch (err) {
    yield makeRetriableErrorHandler(action, path)(err).map(action => Saga.put(action))
  }
}

const letResetUserBackIn = async (_: TypedState, {payload: {id, username}}) => {
  await RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise({id, username})
}

const updateFsBadge = (state: TypedState) => {
  const counts = new Map<Tabs.Tab, number>()
  counts.set(Tabs.fsTab, Constants.computeBadgeNumberForAll(state.fs.tlfs))
  return NotificationsGen.createSetBadgeCounts({counts})
}

const deleteFile = async (_: TypedState, action: FsGen.DeleteFilePayload) => {
  const opID = Constants.makeUUID()
  try {
    await RPCTypes.SimpleFSSimpleFSRemoveRpcPromise({
      opID,
      path: Constants.pathToRPCPath(action.payload.path),
      recursive: true,
    })
    return RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID})
  } catch (e) {
    return makeRetriableErrorHandler(action, action.payload.path)(e)
  }
}

const moveOrCopy = async (state: TypedState, action: FsGen.MovePayload | FsGen.CopyPayload) => {
  if (state.fs.destinationPicker.source.type === Types.DestinationPickerSource.None) {
    return
  }
  const params = {
    dest: Constants.pathToRPCPath(
      Types.pathConcat(
        action.payload.destinationParentPath,
        state.fs.destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy
          ? Types.getPathName(state.fs.destinationPicker.source.path)
          : Types.getLocalPathName(state.fs.destinationPicker.source.localPath)
        // We use the local path name here since we only care about file name.
      )
    ),
    opID: Constants.makeUUID() as string,
    src:
      state.fs.destinationPicker.source.type === Types.DestinationPickerSource.MoveOrCopy
        ? Constants.pathToRPCPath(state.fs.destinationPicker.source.path)
        : ({
            PathType: RPCTypes.PathType.local,
            local: Types.localPathToString(state.fs.destinationPicker.source.localPath),
          } as RPCTypes.Path),
  }

  try {
    if (action.type === FsGen.move) {
      await RPCTypes.SimpleFSSimpleFSMoveRpcPromise(params)
    } else {
      await RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise(params)
    }
    return RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID: params.opID})
    // We get source/dest paths from state rather than action, so we can't
    // just retry it. If we do want retry in the future we can include those
    // paths in the action.
  } catch (e) {
    return makeUnretriableErrorHandler(action, action.payload.destinationParentPath)(e)
  }
}

const showMoveOrCopy = () =>
  RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})

// Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
// reducer and happens before this.
let waitForKbfsDaemonOnFly = false
const waitForKbfsDaemon = async () => {
  if (waitForKbfsDaemonOnFly) {
    return
  }
  waitForKbfsDaemonOnFly = true
  try {
    const connected = await RPCTypes.configWaitForClientRpcPromise({
      clientType: RPCTypes.ClientType.kbfs,
      timeout: 20, // 20sec
    })
    // eslint-disable-next-line
    waitForKbfsDaemonOnFly = false
    return FsGen.createKbfsDaemonRpcStatusChanged({
      rpcStatus: connected ? Types.KbfsDaemonRpcStatus.Connected : Types.KbfsDaemonRpcStatus.WaitTimeout,
    })
  } catch (_) {
    waitForKbfsDaemonOnFly = false
    return FsGen.createKbfsDaemonRpcStatusChanged({
      rpcStatus: Types.KbfsDaemonRpcStatus.WaitTimeout,
    })
  }
}

const startManualCR = async (_: TypedState, action) => {
  await RPCTypes.SimpleFSSimpleFSClearConflictStateRpcPromise({
    path: Constants.pathToRPCPath(action.payload.tlfPath),
  })
  return FsGen.createFavoritesLoad()
}

const finishManualCR = async (_: TypedState, action) => {
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
    const onlineStatus = await RPCTypes.SimpleFSSimpleFSGetOnlineStatusRpcPromise()
    return FsGen.createKbfsDaemonOnlineStatusChanged({onlineStatus})
  } catch (error) {
    if (n > 0) {
      logger.warn(`failed to check if we are connected to MDServer: ${error}; n=${n}`)
      await Saga.delay(2000)
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
  _: TypedState,
  action: ConfigGen.OsNetworkStatusChangedPayload
) => {
  if (!action.payload.isInit) {
    try {
      await RPCTypes.SimpleFSSimpleFSCheckReachabilityRpcPromise()
    } catch (err) {
      logger.warn(`failed to check KBFS reachability: ${err.message}`)
    }
  }
  return null
}

const onNotifyFSOverallSyncSyncStatusChanged = (
  state,
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
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(diskSpaceStatus)
    }
  }
  return actions
}

const setTlfsAsUnloadedWhenKbfsDaemonDisconnects = (state: TypedState) =>
  state.fs.kbfsDaemonStatus.rpcStatus !== Types.KbfsDaemonRpcStatus.Connected &&
  FsGen.createSetTlfsAsUnloaded()

const setDebugLevel = (_: TypedState, action: FsGen.SetDebugLevelPayload) =>
  RPCTypes.SimpleFSSimpleFSSetDebugLevelRpcPromise({level: action.payload.level})

const subscriptionDeduplicateIntervalSecond = 1

const subscribePath = async (_: TypedState, action: FsGen.SubscribePathPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSSubscribePathRpcPromise({
      deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      kbfsPath: Types.pathToString(action.payload.path),
      subscriptionID: action.payload.subscriptionID,
      topic: action.payload.topic,
    })
    return null
  } catch (err) {
    return makeUnretriableErrorHandler(action, action.payload.path)(err)
  }
}

const subscribeNonPath = async (_: TypedState, action: FsGen.SubscribeNonPathPayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
      deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      subscriptionID: action.payload.subscriptionID,
      topic: action.payload.topic,
    })
    return null
  } catch (err) {
    return makeUnretriableErrorHandler(action)(err)
  }
}

const unsubscribe = async (_: TypedState, action: FsGen.UnsubscribePayload) => {
  try {
    await RPCTypes.SimpleFSSimpleFSUnsubscribeRpcPromise({
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
      subscriptionID: action.payload.subscriptionID,
    })
  } catch (_) {}
}

const onPathChange = (_: TypedState, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPathPayload) => {
  const {path, topic} = action.payload.params
  switch (topic) {
    case RPCTypes.PathSubscriptionTopic.children:
      return FsGen.createFolderListLoad({path: Types.stringToPath(path), recursive: false})
    case RPCTypes.PathSubscriptionTopic.stat:
      return FsGen.createLoadPathMetadata({path: Types.stringToPath(path)})
  }
}

const onNonPathChange = (_: TypedState, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPayload) => {
  const {topic} = action.payload.params
  switch (topic) {
    case RPCTypes.SubscriptionTopic.favorites:
      return FsGen.createFavoritesLoad()
    case RPCTypes.SubscriptionTopic.journalStatus:
      return FsGen.createPollJournalStatus()
    case RPCTypes.SubscriptionTopic.onlineStatus:
      return checkIfWeReConnectedToMDServerUpToNTimes(1)
    case RPCTypes.SubscriptionTopic.downloadStatus:
      return FsGen.createLoadDownloadStatus()
    case RPCTypes.SubscriptionTopic.filesTabBadge:
      return FsGen.createLoadFilesTabBadge()
    case RPCTypes.SubscriptionTopic.overallSyncStatus:
      return undefined
  }
}

const getOnlineStatus = () => checkIfWeReConnectedToMDServerUpToNTimes(2)

const loadPathInfo = async (_: TypedState, action: FsGen.LoadPathInfoPayload) => {
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

const loadDownloadInfo = async (_: TypedState, action: FsGen.LoadDownloadInfoPayload) => {
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
  } catch {
    return undefined
  }
}

const loadDownloadStatus = async () => {
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
}

const loadFileContext = async (_: TypedState, action: FsGen.LoadFileContextPayload) => {
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
}

const loadFilesTabBadge = async () => {
  try {
    const badge = await RPCTypes.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
    return FsGen.createLoadedFilesTabBadge({badge})
  } catch {
    // retry once HOTPOT-1226
    const badge = await RPCTypes.SimpleFSSimpleFSGetFilesTabBadgeRpcPromise()
    return FsGen.createLoadedFilesTabBadge({badge})
  }
}

function* fsSaga() {
  yield* Saga.chainGenerator<FsGen.UploadPayload>(FsGen.upload, upload)
  yield* Saga.chainGenerator<FsGen.FolderListLoadPayload>(FsGen.folderListLoad, folderList)
  yield* Saga.chainAction2(FsGen.favoritesLoad, loadFavorites)
  yield* Saga.chainAction2(FsGen.kbfsDaemonRpcStatusChanged, setTlfsAsUnloadedWhenKbfsDaemonDisconnects)
  yield* Saga.chainGenerator<FsGen.FavoriteIgnorePayload>(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield* Saga.chainAction2(FsGen.favoritesLoaded, updateFsBadge)
  yield* Saga.chainAction2(FsGen.loadAdditionalTlf, loadAdditionalTlf)
  yield* Saga.chainAction2(FsGen.letResetUserBackIn, letResetUserBackIn)
  yield* Saga.chainAction2(FsGen.commitEdit, commitEdit)
  yield* Saga.chainAction2(FsGen.deleteFile, deleteFile)
  yield* Saga.chainGenerator<FsGen.LoadPathMetadataPayload>(FsGen.loadPathMetadata, loadPathMetadata)
  yield* Saga.chainGenerator<FsGen.PollJournalStatusPayload>(
    FsGen.pollJournalStatus,
    pollJournalFlushStatusUntilDone
  )
  yield* Saga.chainAction2([FsGen.move, FsGen.copy], moveOrCopy)
  yield* Saga.chainAction2([FsGen.showMoveOrCopy, FsGen.showIncomingShare], showMoveOrCopy)
  yield* Saga.chainAction2(
    [ConfigGen.installerRan, ConfigGen.loggedIn, FsGen.waitForKbfsDaemon],
    waitForKbfsDaemon
  )
  yield* Saga.chainAction2(FsGen.setTlfSyncConfig, setTlfSyncConfig)
  yield* Saga.chainAction2(FsGen.loadTlfSyncConfig, loadTlfSyncConfig)
  yield* Saga.chainAction2([FsGen.getOnlineStatus], getOnlineStatus)
  yield* Saga.chainAction2(ConfigGen.osNetworkStatusChanged, checkKbfsServerReachabilityIfNeeded)
  yield* Saga.chainAction2(
    EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged,
    onNotifyFSOverallSyncSyncStatusChanged
  )
  yield* Saga.chainAction2(FsGen.loadSettings, loadSettings)
  yield* Saga.chainAction2(FsGen.setSpaceAvailableNotificationThreshold, setSpaceNotificationThreshold)
  yield* Saga.chainAction2(FsGen.startManualConflictResolution, startManualCR)
  yield* Saga.chainAction2(FsGen.finishManualConflictResolution, finishManualCR)
  yield* Saga.chainAction2(FsGen.loadPathInfo, loadPathInfo)
  yield* Saga.chainAction2(FsGen.loadFileContext, loadFileContext)
  yield* Saga.chainAction2(FsGen.loadFilesTabBadge, loadFilesTabBadge)

  yield* Saga.chainAction2([FsGen.download, FsGen.shareNative, FsGen.saveMedia], download)
  yield* Saga.chainAction2(FsGen.cancelDownload, cancelDownload)
  yield* Saga.chainAction2(FsGen.dismissDownload, dismissDownload)
  yield* Saga.chainAction2(FsGen.loadDownloadStatus, loadDownloadStatus)
  yield* Saga.chainAction2(FsGen.loadDownloadInfo, loadDownloadInfo)

  yield* Saga.chainAction2(FsGen.subscribePath, subscribePath)
  yield* Saga.chainAction2(FsGen.subscribeNonPath, subscribeNonPath)
  yield* Saga.chainAction2(FsGen.unsubscribe, unsubscribe)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath, onPathChange)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyFSFSSubscriptionNotify, onNonPathChange)

  yield* Saga.chainAction2(FsGen.setDebugLevel, setDebugLevel)

  yield Saga.spawn(platformSpecificSaga)
}

export default fsSaga
