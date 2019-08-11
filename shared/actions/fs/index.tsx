import * as Constants from '../../constants/fs'
import * as EngineGen from '../engine-gen-gen'
import * as FsGen from '../fs-gen'
import * as ConfigGen from '../config-gen'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as Saga from '../../util/saga'
import * as Flow from '../../util/flow'
import * as Tabs from '../../constants/tabs'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import {TypedState} from '../../util/container'
import logger from '../../logger'
import platformSpecificSaga from './platform-specific'
import {getContentTypeFromURL} from '../platform-specific'
import * as RouteTreeGen from '../route-tree-gen'
import {tlfToPreferredOrder} from '../../util/kbfs'
import {makeRetriableErrorHandler, makeUnretriableErrorHandler} from './shared'
import flags from '../../util/feature-flags'
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
        localViewTlfPaths: I.List(
          ((nv && nv.localViews) || []).reduce<Array<Types.Path>>((arr, p) => {
            // @ts-ignore TODO fix p.kbfs.path is a path already
            p.PathType === RPCTypes.PathType.kbfs && arr.push(Types.stringToPath(p.kbfs.path))
            return arr
          }, [])
        ),
        resolvingConflict: !!nv && nv.resolvingConflict,
        stuckInConflict: !!nv && nv.stuckInConflict,
      })
    } else {
      const nv =
        rpcConflictState.manualresolvinglocalview && rpcConflictState.manualresolvinglocalview.normalView
      return Constants.makeConflictStateManualResolvingLocalView({
        normalViewTlfPath:
          nv && nv.PathType === RPCTypes.PathType.kbfs
            ? Types.stringToPath(
                // @ts-ignore TODO fix p.kbfs.path is a path already
                nv.kbfs.path
              )
            : Constants.defaultPath,
      })
    }
  } else {
    return Constants.tlfNormalViewWithNoConflict
  }
}

const loadFavorites = (state: TypedState, action: FsGen.FavoritesLoadPayload) =>
  state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected &&
  state.config.loggedIn &&
  RPCTypes.SimpleFSSimpleFSListFavoritesRpcPromise()
    .then(results => {
      const mutablePayload = [
        ...(results.favoriteFolders
          ? [{folders: results.favoriteFolders, isFavorite: true, isIgnored: false, isNew: false}]
          : []),
        ...(results.ignoredFolders
          ? [{folders: results.ignoredFolders, isFavorite: false, isIgnored: true, isNew: false}]
          : []),
        ...(results.newFolders
          ? [{folders: results.newFolders, isFavorite: true, isIgnored: false, isNew: true}]
          : []),
      ].reduce(
        (mutablePayload, {folders, isFavorite, isIgnored, isNew}) =>
          folders.reduce((mutablePayload, folder) => {
            const tlfType = rpcFolderTypeToTlfType(folder.folderType)
            const tlfName =
              tlfType === Types.TlfType.Private || tlfType === Types.TlfType.Public
                ? tlfToPreferredOrder(folder.name, state.config.username)
                : folder.name
            return !tlfType
              ? mutablePayload
              : {
                  ...mutablePayload,
                  [tlfType]: mutablePayload[tlfType].set(
                    tlfName,
                    Constants.makeTlf({
                      conflictState: rpcConflictStateToConflictState(folder.conflictState || null),
                      isFavorite,
                      isIgnored,
                      isNew,
                      name: tlfName,
                      resetParticipants: I.List((folder.reset_members || []).map(({username}) => username)),
                      syncConfig: getSyncConfigFromRPC(tlfName, tlfType, folder.syncConfig || null),
                      teamId: folder.team_id || '',
                      tlfMtime: folder.mtime || 0,
                    })
                  ),
                }
          }, mutablePayload),
        {
          private: I.Map().asMutable(),
          public: I.Map().asMutable(),
          team: I.Map().asMutable(),
        }
      )
      return (
        mutablePayload.private.size &&
        FsGen.createFavoritesLoaded({
          // @ts-ignore asImmutable returns a weak type
          private: mutablePayload.private.asImmutable(),
          // @ts-ignore asImmutable returns a weak type
          public: mutablePayload.public.asImmutable(),
          // @ts-ignore asImmutable returns a weak type
          team: mutablePayload.team.asImmutable(),
        })
      )
    })
    .catch(makeRetriableErrorHandler(action))

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
          ? I.List(config.paths.map(str => Types.getPathFromRelative(tlfName, tlfType, str)))
          : I.List(),
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

const setTlfSyncConfig = (_: TypedState, action: FsGen.SetTlfSyncConfigPayload) =>
  RPCTypes.SimpleFSSimpleFSSetFolderSyncConfigRpcPromise(
    {
      config: {
        mode: action.payload.enabled ? RPCTypes.FolderSyncMode.enabled : RPCTypes.FolderSyncMode.disabled,
      },
      path: Constants.pathToRPCPath(action.payload.tlfPath),
    },
    Constants.syncToggleWaitingKey
  ).then(() =>
    FsGen.createLoadTlfSyncConfig({
      tlfPath: action.payload.tlfPath,
    })
  )

const loadSettings = () =>
  RPCTypes.SimpleFSSimpleFSSettingsRpcPromise()
    .then(settings =>
      FsGen.createSettingsLoaded({
        settings: Constants.makeSettings({
          spaceAvailableNotificationThreshold: settings.spaceAvailableNotificationThreshold,
        }),
      })
    )
    .catch(() => FsGen.createSettingsLoaded({}))

const setSpaceNotificationThreshold = (
  _: TypedState,
  action: FsGen.SetSpaceAvailableNotificationThresholdPayload
) =>
  RPCTypes.SimpleFSSimpleFSSetNotificationThresholdRpcPromise({
    threshold: action.payload.spaceAvailableNotificationThreshold,
  }).then(() => FsGen.createLoadSettings())

const getPrefetchStatusFromRPC = (
  prefetchStatus: RPCTypes.PrefetchStatus,
  prefetchProgress: RPCTypes.PrefetchProgress
) => {
  switch (prefetchStatus) {
    case RPCTypes.PrefetchStatus.notStarted:
      return Constants.prefetchNotStarted
    case RPCTypes.PrefetchStatus.inProgress:
      return Constants.makePrefetchInProgress({
        bytesFetched: prefetchProgress.bytesFetched,
        bytesTotal: prefetchProgress.bytesTotal,
        endEstimate: prefetchProgress.endEstimate,
        startTime: prefetchProgress.start,
      })
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

const makeEntry = (d: RPCTypes.Dirent, children?: Set<string>) => {
  switch (d.direntType) {
    case RPCTypes.DirentType.dir:
      return Constants.makeFolder({
        ...direntToMetadata(d),
        children: I.Set(children || []) || I.Set(),
        progress: children ? Types.ProgressType.Loaded : undefined,
      })
    case RPCTypes.DirentType.sym:
      return Constants.makeSymlink({
        ...direntToMetadata(d),
        // TODO: plumb link target
      })
    case RPCTypes.DirentType.file:
    case RPCTypes.DirentType.exec:
      return Constants.makeFile(direntToMetadata(d))
    default:
      return Constants.makeUnknownPathItem(direntToMetadata(d))
  }
}

function* folderList(_: TypedState, action: FsGen.FolderListLoadPayload | FsGen.EditSuccessPayload) {
  const rootPath = action.type === FsGen.editSuccess ? action.payload.parentPath : action.payload.path
  try {
    const opID = Constants.makeUUID()
    const pathElems = Types.getPathElements(rootPath)
    if (pathElems.length < 3) {
      yield RPCTypes.SimpleFSSimpleFSListRpcPromise({
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: false,
      })
    } else {
      yield RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise({
        depth: 1,
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: false,
      })
    }

    yield RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID})

    const result: Saga.RPCPromiseType<
      typeof RPCTypes.SimpleFSSimpleFSReadListRpcPromise
    > = yield RPCTypes.SimpleFSSimpleFSReadListRpcPromise({opID})
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
      if (entry.type === Types.PathType.Folder && Types.getPathLevel(path) > 3 && d.name.indexOf('/') < 0) {
        // Since we are loading with a depth of 2, first level directories are
        // considered "loaded".
        return [path, entry.set('progress', Types.ProgressType.Loaded)]
      }
      return [path, entry]
    }

    // Get metadata fields of the directory that we just loaded from state to
    // avoid overriding them.
    const state: TypedState = yield* Saga.selectState()
    const rootPathItem = state.fs.pathItems.get(rootPath, Constants.unknownPathItem)
    const rootFolder: Types.FolderPathItem = (rootPathItem.type === Types.PathType.Folder
      ? rootPathItem
      : Constants.makeFolder({name: Types.getPathName(rootPath)})
    ).withMutations(f =>
      f.set('children', I.Set(childMap.get(rootPath))).set('progress', Types.ProgressType.Loaded)
    )

    // @ts-ignore TODO fix this
    const pathItems: Array<[Types.Path, Types.FolderPathItem]> = [
      ...(Types.getPathLevel(rootPath) > 2 ? [[rootPath, rootFolder]] : []),
      ...entries.map(direntToPathAndPathItem),
    ]
    yield Saga.put(FsGen.createFolderListLoaded({path: rootPath, pathItems: I.Map(pathItems)}))
    if (action.type === FsGen.editSuccess) {
      // Note that we discard the Edit metadata here rather than immediately
      // after an FsGen.editSuccess event, so that if we hear about journal
      // uploading the new folder before we hear from the folder list result,
      // fs/footer/upload-container.js can determine this is a newly created
      // folder instead of a file upload based on state.fs.edits.
      yield Saga.put(FsGen.createDiscardEdit({editID: action.payload.editID}))
    }
  } catch (error) {
    yield makeRetriableErrorHandler(action, rootPath)(error).map(action => Saga.put(action))
  }
}

function* monitorDownloadProgress(key: string, opID: RPCTypes.OpID) {
  // This loop doesn't finish on its own, but it's in a Saga.race with
  // `SimpleFSWait`, so it's "canceled" when the other finishes.
  while (true) {
    yield Saga.delay(500)
    const progress: Saga.RPCPromiseType<
      typeof RPCTypes.SimpleFSSimpleFSCheckRpcPromise
    > = yield RPCTypes.SimpleFSSimpleFSCheckRpcPromise({opID})
    if (progress.bytesTotal === 0) {
      continue
    }
    yield Saga.put(
      FsGen.createDownloadProgress({
        completePortion: progress.bytesWritten / progress.bytesTotal,
        endEstimate: progress.endEstimate,
        key,
      })
    )
  }
}

function* download(
  _: TypedState,
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
) {
  const {path, key} = action.payload
  const intent = Constants.getDownloadIntentFromAction(action)
  const opID = Constants.makeUUID()

  // Figure out the local path we are downloading into.
  let localPath = ''
  switch (intent) {
    case Types.DownloadIntent.None:
      // This adds " (1)" suffix to the base name, if the destination path
      // already exists.
      localPath = yield* Saga.callPromise(Constants.downloadFilePathFromPath, path)
      break
    case Types.DownloadIntent.CameraRoll:
    case Types.DownloadIntent.Share:
      // For saving to camera roll or sharing to other apps, we are
      // downloading to the app's local storage. So don't bother trying to
      // avoid overriding existing files. Just download over them.
      localPath = Constants.downloadFilePathFromPathNoSearch(path)
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(intent)
      localPath = yield* Saga.callPromise(Constants.downloadFilePathFromPath, path)
      break
  }

  yield Saga.put(
    FsGen.createDownloadStarted({
      intent,
      key,
      localPath,
      opID,
      path,
      // Omit entryType to let reducer figure out.
    })
  )

  yield RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise({
    dest: {
      PathType: RPCTypes.PathType.local,
      local: localPath,
    },
    opID,
    src: Constants.pathToRPCPath(path),
  })

  try {
    yield Saga.race({
      monitor: Saga.callUntyped(monitorDownloadProgress, key, opID),
      wait: Saga.callUntyped(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID}),
    })

    // No error, so the download has finished successfully. Set the
    // completePortion to 1.
    yield Saga.put(FsGen.createDownloadProgress({completePortion: 1, key}))

    const mimeType = yield* _loadMimeType(path)
    yield Saga.put(
      FsGen.createDownloadSuccess({
        intent,
        key,
        mimeType: (mimeType && mimeType.mimeType) || '',
      })
    )
  } catch (error) {
    // This needs to be before the dismiss below, so that if it's a legit
    // error we'd show the red bar.
    yield makeRetriableErrorHandler(action, path)(error).map(action => Saga.put(action))
  } finally {
    if (intent !== Types.DownloadIntent.None) {
      // If it's a normal download, we show a red card for the user to dismiss.
      // TODO: when we get rid of download cards on Android, check isMobile
      // here.
      yield Saga.put(FsGen.createDismissDownload({key}))
    }
  }
}

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

const cancelDownload = (state: TypedState, action: FsGen.CancelDownloadPayload) => {
  const download = state.fs.downloads.get(action.payload.key)
  if (!download) {
    return
  }
  const {
    meta: {opID},
  } = download
  return RPCTypes.SimpleFSSimpleFSCancelRpcPromise({opID}).then(() => {})
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
      }: Saga.RPCPromiseType<
        typeof RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise
      > = yield RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise({
        filter: RPCTypes.ListFilter.filterSystemHidden,
      })
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

// Return a header till first semicolon in lower case.
const headerTillSemiLower = (header: string): string => {
  const idx = header.indexOf(';')
  return (idx > -1 ? header.slice(0, idx) : header).toLowerCase()
}

// Following RFC https://tools.ietf.org/html/rfc7231#section-3.1.1.1 Examples:
//   text/html;charset=utf-8
//   text/html;charset=UTF-8
//   Text/HTML;Charset="utf-8"
//   text/html; charset="utf-8"
// The last part is optional, so if `;` is missing, it'd be just the mimetype.
const extractMimeFromContentType = (contentType, disposition: string): Types.Mime => {
  const mimeType = headerTillSemiLower(contentType)
  const displayPreview = headerTillSemiLower(disposition) !== 'attachment'
  return Constants.makeMime({displayPreview, mimeType})
}

const getMimeTypePromise = (localHTTPServerInfo: Types.LocalHTTPServer, path: Types.Path) =>
  new Promise((resolve, reject) =>
    getContentTypeFromURL(
      Constants.generateFileURL(path, localHTTPServerInfo),
      ({error, statusCode, contentType, disposition}) => {
        if (error) {
          reject(error)
          return
        }
        switch (statusCode) {
          case 200:
            resolve(extractMimeFromContentType(contentType || '', disposition || ''))
            return
          case 403:
            reject(Constants.invalidTokenError)
            return
          case 404:
            reject(Constants.notFoundError)
            return
          default:
            reject(new Error(`unexpected HTTP status code: ${statusCode || ''}`))
        }
      }
    )
  )

const refreshLocalHTTPServerInfo = (_: TypedState, action: FsGen.RefreshLocalHTTPServerInfoPayload) =>
  RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise()
    .then(({address, token}) => FsGen.createLocalHTTPServerInfo({address, token}))
    .catch(makeUnretriableErrorHandler(action, null))

// loadMimeType uses HEAD request to load mime type from the KBFS HTTP server.
// If the server address/token are not populated yet, or if the token turns out
// to be invalid, it automatically uses
// SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise to refresh that. The
// generator function returns the loaded mime type for the given path.
function* _loadMimeType(path: Types.Path) {
  const state = yield* Saga.selectState()
  let localHTTPServerInfo = state.fs.localHTTPServerInfo
  // This should finish within 2 iterations at most. But just in case we bound
  // it at 3.
  for (let i = 0; i < 3; ++i) {
    if (!localHTTPServerInfo.address || !localHTTPServerInfo.token) {
      const r: Saga.RPCPromiseType<
        typeof RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise
      > = yield RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise()
      const {address, token} = r
      yield Saga.put(
        FsGen.createLocalHTTPServerInfo({
          address,
          token,
        })
      )
      localHTTPServerInfo = Constants.makeLocalHTTPServer({address, token})
    }
    try {
      const mimeType: Types.Mime = yield Saga.callUntyped(getMimeTypePromise, localHTTPServerInfo, path)
      return mimeType
    } catch (err) {
      if (err === Constants.notFoundError) {
        // This file or its parent folder has been removed. So just stop here.
        // This could happen when there are KBFS updates if user has previously
        // inspected mime type, and we tracked the path through a refresh tag,
        // but the path has been removed since then.
        return
      }
      err !== Constants.invalidTokenError && logger.info(`_loadMimeType i=${i} error:`, err)
      localHTTPServerInfo = Constants.makeLocalHTTPServer()
    }
  }
  throw new Error('exceeded max retries')
}

const commitEdit = (state: TypedState, action: FsGen.CommitEditPayload) => {
  const {editID} = action.payload
  const edit = state.fs.edits.get(editID)
  if (!edit) {
    return null
  }
  const {parentPath, name, type} = edit as Types.Edit
  switch (type) {
    case Types.EditType.NewFolder:
      return RPCTypes.SimpleFSSimpleFSOpenRpcPromise({
        dest: Constants.pathToRPCPath(Types.pathConcat(parentPath, name)),
        flags: RPCTypes.OpenFlags.directory,
        opID: Constants.makeUUID(),
      })
        .then(() => FsGen.createEditSuccess({editID, parentPath}))
        .catch(makeRetriableErrorHandler(action, parentPath))
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(type)
      return undefined
  }
}

function* loadPathMetadata(_: TypedState, action: FsGen.LoadPathMetadataPayload) {
  const {path} = action.payload

  try {
    const dirent = yield RPCTypes.SimpleFSSimpleFSStatRpcPromise({
      path: Constants.pathToRPCPath(path),
      refreshSubscription: false,
    })
    let pathItem = makeEntry(dirent)
    if (pathItem.type === Types.PathType.File) {
      const mimeType = yield* _loadMimeType(path)
      pathItem = pathItem.set('mimeType', mimeType)
    }
    yield Saga.put(
      FsGen.createPathItemLoaded({
        path,
        pathItem,
      })
    )
  } catch (err) {
    yield makeRetriableErrorHandler(action, path)(err).map(action => Saga.put(action))
  }
}

const letResetUserBackIn = (_: TypedState, {payload: {id, username}}) =>
  RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise({id, username}).then(() => {})

const updateFsBadge = (state: TypedState) =>
  NotificationsGen.createSetBadgeCounts({
    counts: I.Map({
      [Tabs.fsTab]: Constants.computeBadgeNumberForAll(state.fs.tlfs),
    }) as I.Map<Tabs.Tab, number>,
  })

const deleteFile = (_: TypedState, action: FsGen.DeleteFilePayload) => {
  const opID = Constants.makeUUID()
  return RPCTypes.SimpleFSSimpleFSRemoveRpcPromise({
    opID,
    path: Constants.pathToRPCPath(action.payload.path),
    recursive: true,
  })
    .then(() => RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}))
    .catch(makeRetriableErrorHandler(action, action.payload.path))
}

const moveOrCopy = (state: TypedState, action: FsGen.MovePayload | FsGen.CopyPayload) => {
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
  return (
    (action.type === FsGen.move
      ? RPCTypes.SimpleFSSimpleFSMoveRpcPromise(params)
      : RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise(params)
    )
      .then(() => RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID: params.opID}))
      // We get source/dest paths from state rather than action, so we can't
      // just retry it. If we do want retry in the future we can include those
      // paths in the action.
      .catch(makeUnretriableErrorHandler(action, action.payload.destinationParentPath))
  )
}

const showMoveOrCopy = () =>
  RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})

const closeDestinationPicker = () => {
  const currentRoutes = I.List()
  // const currentRoutes = getPathProps(state.routeTree.routeState)
  const firstDestinationPickerIndex = currentRoutes.findIndex(({node}) => node === 'destinationPicker')
  const newRoute = currentRoutes.reduce<Array<any>>(
    (routes, {node, props}, i) =>
      // node is never null
      i < firstDestinationPickerIndex ? [...routes, {props, selected: node || ''}] : routes,
    []
  )
  return [RouteTreeGen.createNavigateAppend({path: newRoute})]
}

const initSendLinkToChat = (state: TypedState) => {
  const elems = Types.getPathElements(state.fs.sendLinkToChat.path)
  if (elems.length < 3 || elems[1] === 'public') {
    // Not a TLF, or a public TLF; just let user copy the path.
    return
  }

  if (elems[1] !== 'team') {
    // It's an impl team conversation. So resolve to a convID directly.
    return RPCChatTypes.localFindConversationsLocalRpcPromise({
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.ConversationMembersType.impteamnative,
      oneChatPerTLF: false,
      tlfName: elems[2].replace('#', ','),
      topicName: '',
      topicType: RPCChatTypes.TopicType.chat,
      visibility: RPCTypes.TLFVisibility.private,
    }).then(result =>
      // This action, no matter setting a real idKey or
      // noConversationIDKey, causes a transition into 'read-to-send'
      // state, which is what we want here. If we don't have a
      // conversation we should create it when user tries to send.
      FsGen.createSetSendLinkToChatConvID({
        convID:
          result.conversations && result.conversations.length
            ? ChatTypes.conversationIDToKey(result.conversations[0].info.id)
            : ChatConstants.noConversationIDKey,
      })
    )
  }

  // It's a real team, but we don't know if it's a small team or big team. So
  // call RPCChatTypes.localGetTLFConversationsLocalRpcPromise to get all
  // channels. We could have used the Teams store, but then we are doing
  // cross-store stuff and are depending on the Teams store. If this turns
  // out to feel slow, we can probably cahce the results.

  return RPCChatTypes.localGetTLFConversationsLocalRpcPromise({
    membersType: RPCChatTypes.ConversationMembersType.team,
    tlfName: elems[2],
    topicType: RPCChatTypes.TopicType.chat,
  }).then(result =>
    !result.convs || !result.convs.length
      ? null // TODO: is this possible for teams at all?
      : [
          FsGen.createSetSendLinkToChatChannels({
            channels: I.Map(
              result.convs
                .filter(conv => conv.memberStatus === RPCChatTypes.ConversationMemberStatus.active)
                .map(conv => [ChatTypes.stringToConversationIDKey(conv.convID), conv.channel])
            ),
          }),

          ...(result.convs && result.convs.length === 1
            ? [
                // Auto-select channel if it's the only one.
                FsGen.createSetSendLinkToChatConvID({
                  convID: ChatTypes.stringToConversationIDKey(result.convs[0].convID),
                }),
              ]
            : []),
        ]
  )
}

const triggerSendLinkToChat = (state: TypedState) => {
  const elems = Types.getPathElements(state.fs.sendLinkToChat.path)
  if (elems.length < 3 || elems[1] === 'public') {
    // Not a TLF, or a public TLF; no-op
    return
  }

  return (elems[1] === 'team'
    ? Promise.resolve({
        conversationIDKey: state.fs.sendLinkToChat.convID,
        tlfName: elems[2],
      })
    : RPCChatTypes.localNewConversationLocalRpcPromise({
        // It's an impl team conversation. So first make sure it exists.
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.impteamnative,
        tlfName: elems[2].replace('#', ','),
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicType: RPCChatTypes.TopicType.chat,
      }).then(result => ({
        conversationIDKey: ChatTypes.conversationIDToKey(result.conv.info.id),
        tlfName: result.conv.info.tlfName,
      }))
  ).then(({conversationIDKey, tlfName}) =>
    RPCChatTypes.localPostTextNonblockRpcPromise(
      {
        // intentional space in the end
        body: `${Constants.escapePath(state.fs.sendLinkToChat.path)} `,
        clientPrev: ChatConstants.getClientPrev(state, conversationIDKey),
        conversationID: ChatTypes.keyToConversationID(conversationIDKey),
        ephemeralLifetime: ChatConstants.getConversationExplodingMode(state, conversationIDKey) || undefined,
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        outboxID: null,
        replyTo: null,
        tlfName,
        tlfPublic: false,
      },
      ChatConstants.waitingKeyPost
    ).then(() => FsGen.createSentLinkToChat({convID: conversationIDKey}))
  )
}

// Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
// reducer and happens before this.
let waitForKbfsDaemonOnFly = false
const waitForKbfsDaemon = () => {
  if (waitForKbfsDaemonOnFly) {
    return
  }
  waitForKbfsDaemonOnFly = true
  return RPCTypes.configWaitForClientRpcPromise({
    clientType: RPCTypes.ClientType.kbfs,
    timeout: 20, // 20sec
  })
    .then(connected => {
      waitForKbfsDaemonOnFly = false
      return FsGen.createKbfsDaemonRpcStatusChanged({
        rpcStatus: connected ? Types.KbfsDaemonRpcStatus.Connected : Types.KbfsDaemonRpcStatus.WaitTimeout,
      })
    })
    .catch(() => {
      waitForKbfsDaemonOnFly = false
      return FsGen.createKbfsDaemonRpcStatusChanged({
        rpcStatus: Types.KbfsDaemonRpcStatus.WaitTimeout,
      })
    })
}

const startManualCR = (_: TypedState, action) =>
  RPCTypes.SimpleFSSimpleFSClearConflictStateRpcPromise({
    path: Constants.pathToRPCPath(action.payload.tlfPath),
  }).then(() => FsGen.createFavoritesLoad())

const finishManualCR = (_: TypedState, action) =>
  RPCTypes.SimpleFSSimpleFSFinishResolvingConflictRpcPromise({
    path: Constants.pathToRPCPath(action.payload.localViewTlfPath),
  }).then(() => FsGen.createFavoritesLoad())

// At start-up we might have a race where we get connected to a kbfs daemon
// which dies soon after, and we get an EOF here. So retry for a few times
// until we get through. After each try we delay for 2s, so this should give us
// e.g. 12s when n == 6. If it still doesn't work after 12s, something's wrong
// and we deserve a black bar.
const checkIfWeReConnectedToMDServerUpToNTimes = (n: number) =>
  RPCTypes.SimpleFSSimpleFSAreWeConnectedToMDServerRpcPromise()
    .then(connectedToMDServer => FsGen.createKbfsDaemonOnlineStatusChanged({online: connectedToMDServer}))
    .catch(
      n > 0
        ? error => {
            logger.warn(`failed to check if we are connected to MDServer: ${error}; n=${n}`)
            return Saga.delay(2000).then(() => checkIfWeReConnectedToMDServerUpToNTimes(n - 1))
          }
        : error => {
            logger.warn(`failed to check if we are connected to MDServer : ${error}; n=${n}, throwing`)
            throw error
          }
    )

// We don't trigger the reachability check at init. Reachability checks cause
// any pending "reconnect" fire right away, and overrides any random back-off
// timer we have at process restart (which is there to avoid surging server
// load around app releases). So only do that when OS network status changes
// after we're up.
const checkKbfsServerReachabilityIfNeeded = (
  _: TypedState,
  action: ConfigGen.OsNetworkStatusChangedPayload
) => {
  if (!action.payload.isInit) {
    return RPCTypes.SimpleFSSimpleFSCheckReachabilityRpcPromise().catch(err =>
      logger.warn(`failed to check KBFS reachability: ${err.message}`)
    )
  }
  return undefined
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
  let actions: Array<
    | NotificationsGen.BadgeAppPayload
    | FsGen.OverallSyncStatusChangedPayload
    | FsGen.ShowHideDiskSpaceBannerPayload
  > = [
    FsGen.createOverallSyncStatusChanged({
      diskSpaceStatus,
      progress: Constants.makeSyncingFoldersProgress(action.payload.params.status.prefetchProgress),
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

const subscribePath = (_: TypedState, action: FsGen.SubscribePathPayload) =>
  RPCTypes.SimpleFSSimpleFSSubscribePathRpcPromise({
    deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
    kbfsPath: Types.pathToString(action.payload.path),
    subscriptionID: action.payload.subscriptionID,
    topic: action.payload.topic,
  }).catch(makeUnretriableErrorHandler(action))

const subscribeNonPath = (_: TypedState, action: FsGen.SubscribeNonPathPayload) =>
  RPCTypes.SimpleFSSimpleFSSubscribeNonPathRpcPromise({
    deduplicateIntervalSecond: subscriptionDeduplicateIntervalSecond,
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
    subscriptionID: action.payload.subscriptionID,
    topic: action.payload.topic,
  }).catch(makeUnretriableErrorHandler(action))

const unsubscribe = (_: TypedState, action: FsGen.UnsubscribePayload) =>
  RPCTypes.SimpleFSSimpleFSUnsubscribeRpcPromise({
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.fsGui,
    subscriptionID: action.payload.subscriptionID,
  }).catch(() => {})

const onPathChange = (_: TypedState, action: EngineGen.Keybase1NotifyFSFSSubscriptionNotifyPathPayload) => {
  const {path, topic} = action.payload.params
  switch (topic) {
    case RPCTypes.PathSubscriptionTopic.children:
      return FsGen.createFolderListLoad({path: Types.stringToPath(path)})
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
  }
}

const getOnlineStatus = () => checkIfWeReConnectedToMDServerUpToNTimes(2)

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(FsGen.refreshLocalHTTPServerInfo, refreshLocalHTTPServerInfo)
  yield* Saga.chainAction2(FsGen.cancelDownload, cancelDownload)
  yield* Saga.chainGenerator<FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload>(
    [FsGen.download, FsGen.shareNative, FsGen.saveMedia],
    download
  )
  yield* Saga.chainGenerator<FsGen.UploadPayload>(FsGen.upload, upload)
  yield* Saga.chainGenerator<FsGen.FolderListLoadPayload | FsGen.EditSuccessPayload>(
    [FsGen.folderListLoad, FsGen.editSuccess],
    folderList
  )
  yield* Saga.chainAction2(FsGen.favoritesLoad, loadFavorites)
  yield* Saga.chainAction2(FsGen.kbfsDaemonRpcStatusChanged, setTlfsAsUnloadedWhenKbfsDaemonDisconnects)
  yield* Saga.chainGenerator<FsGen.FavoriteIgnorePayload>(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield* Saga.chainAction2(FsGen.favoritesLoaded, updateFsBadge)
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
  yield* Saga.chainAction2(FsGen.closeDestinationPicker, closeDestinationPicker)
  yield* Saga.chainAction2(FsGen.initSendLinkToChat, initSendLinkToChat)
  yield* Saga.chainAction2(FsGen.triggerSendLinkToChat, triggerSendLinkToChat)
  yield* Saga.chainAction2(
    [ConfigGen.installerRan, ConfigGen.loggedIn, FsGen.waitForKbfsDaemon],
    waitForKbfsDaemon
  )
  if (flags.kbfsOfflineMode) {
    yield* Saga.chainAction2(FsGen.setTlfSyncConfig, setTlfSyncConfig)
    yield* Saga.chainAction2([FsGen.loadTlfSyncConfig, FsGen.loadPathMetadata], loadTlfSyncConfig)
    yield* Saga.chainAction2([FsGen.getOnlineStatus], getOnlineStatus)
    yield* Saga.chainAction2(ConfigGen.osNetworkStatusChanged, checkKbfsServerReachabilityIfNeeded)
    yield* Saga.chainAction2(
      EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged,
      onNotifyFSOverallSyncSyncStatusChanged
    )
    yield* Saga.chainAction2(FsGen.loadSettings, loadSettings)
    yield* Saga.chainAction2(FsGen.setSpaceAvailableNotificationThreshold, setSpaceNotificationThreshold)
  }
  if (flags.conflictResolution) {
    yield* Saga.chainAction2(FsGen.startManualConflictResolution, startManualCR)
    yield* Saga.chainAction2(FsGen.finishManualConflictResolution, finishManualCR)
  }

  yield* Saga.chainAction2(FsGen.subscribePath, subscribePath)
  yield* Saga.chainAction2(FsGen.subscribeNonPath, subscribeNonPath)
  yield* Saga.chainAction2(FsGen.unsubscribe, unsubscribe)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath, onPathChange)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyFSFSSubscriptionNotify, onNonPathChange)

  yield* Saga.chainAction2(FsGen.setDebugLevel, setDebugLevel)

  yield Saga.spawn(platformSpecificSaga)
}

export default fsSaga
