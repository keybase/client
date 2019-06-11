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
import {TypedActions} from '../typed-actions-gen'
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

const loadFavorites = (state, action: FsGen.FavoritesLoadPayload) =>
  RPCTypes.SimpleFSSimpleFSListFavoritesRpcPromise().then(results => {
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
                    isFavorite,
                    isIgnored,
                    isNew,
                    name: tlfName,
                    resetParticipants: I.List((folder.reset_members || []).map(({username}) => username)),
                    syncConfig: getSyncConfigFromRPC(tlfName, tlfType, folder.syncConfig),
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
    return FsGen.createFavoritesLoaded({
      // @ts-ignore asImmutable returns a weak type
      private: mutablePayload.private.asImmutable(),
      // @ts-ignore asImmutable returns a weak type
      public: mutablePayload.public.asImmutable(),
      // @ts-ignore asImmutable returns a weak type
      team: mutablePayload.team.asImmutable(),
    })
  })

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

const loadTlfSyncConfig = (state, action: FsGen.LoadTlfSyncConfigPayload) => {
  // @ts-ignore probably a real issue
  const tlfPath = action.type === FsGen.loadPathMetadata ? action.payload.path : action.payload.tlfPath
  const parsedPath = Constants.parsePath(tlfPath)
  if (parsedPath.kind !== Types.PathKind.GroupTlf && parsedPath.kind !== Types.PathKind.TeamTlf) {
    return null
  }
  return RPCTypes.SimpleFSSimpleFSFolderSyncConfigAndStatusRpcPromise({
    path: Constants.pathToRPCPath(tlfPath),
  })
    .then(result =>
      FsGen.createTlfSyncConfigLoaded({
        syncConfig: getSyncConfigFromRPC(parsedPath.tlfName, parsedPath.tlfType, result.config),
        tlfName: parsedPath.tlfName,
        tlfType: parsedPath.tlfType,
      })
    )
    .catch(makeUnretriableErrorHandler(action, tlfPath))
}

const setTlfSyncConfig = (state, action: FsGen.SetTlfSyncConfigPayload) =>
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

const loadSettings = (state, action: FsGen.LoadSettingsPayload) =>
  RPCTypes.SimpleFSSimpleFSSettingsRpcPromise()
    .then(settings =>
      FsGen.createSettingsLoaded({
        settings: Constants.makeSettings({
          spaceAvailableNotificationThreshold: settings.spaceAvailableNotificationThreshold,
        }),
      })
    )
    .catch(() => FsGen.createSettingsLoaded({}))

const setSpaceNotificationThreshold = (state, action: FsGen.SetSpaceAvailableNotificationThresholdPayload) =>
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
        children: I.Set(children),
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

// See constants/types/fs.js on what this is for.
// We intentionally keep this here rather than in the redux store.
const folderListRefreshTags: Map<Types.RefreshTag, Types.Path> = new Map()
const pathMetadataRefreshTags: Map<Types.RefreshTag, Types.Path> = new Map()

const clearRefreshTags = () => {
  folderListRefreshTags.clear()
  pathMetadataRefreshTags.clear()
}

function* folderList(_, action: FsGen.FolderListLoadPayload | FsGen.EditSuccessPayload) {
  const {rootPath, refreshTag} =
    action.type === FsGen.editSuccess
      ? {refreshTag: undefined, rootPath: action.payload.parentPath}
      : {refreshTag: action.payload.refreshTag, rootPath: action.payload.path}
  const loadingPathID = Constants.makeUUID()

  if (refreshTag) {
    if (folderListRefreshTags.get(refreshTag) === rootPath) {
      // We are already subscribed; so don't fire RPC.
      return
    }

    folderListRefreshTags.set(refreshTag, rootPath)
  }

  try {
    yield Saga.put(FsGen.createLoadingPath({done: false, id: loadingPathID, path: rootPath}))

    const opID = Constants.makeUUID()
    const pathElems = Types.getPathElements(rootPath)
    if (pathElems.length < 3) {
      yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSListRpcPromise, {
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: !!refreshTag,
      })
    } else {
      yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise, {
        depth: 1,
        filter: RPCTypes.ListFilter.filterSystemHidden,
        opID,
        path: Constants.pathToRPCPath(rootPath),
        refreshSubscription: !!refreshTag,
      })
    }

    yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})

    const result = yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSReadListRpcPromise, {opID})
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
    const state = yield* Saga.selectState()
    const rootPathItem = state.fs.pathItems.get(rootPath, Constants.unknownPathItem)
    const rootFolder: Types.FolderPathItem = (rootPathItem.type === Types.PathType.Folder
      ? rootPathItem
      : Constants.makeFolder({name: Types.getPathName(rootPath)})
    ).withMutations(f =>
      f.set('children', I.Set(childMap.get(rootPath))).set('progress', Types.ProgressType.Loaded)
    )

    const pathItems = [
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
  } finally {
    yield Saga.put(FsGen.createLoadingPath({done: true, id: loadingPathID, path: rootPath}))
  }
}

function* monitorDownloadProgress(key: string, opID: RPCTypes.OpID) {
  // This loop doesn't finish on its own, but it's in a Saga.race with
  // `SimpleFSWait`, so it's "canceled" when the other finishes.
  while (true) {
    yield Saga.delay(500)
    const progress = yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSCheckRpcPromise, {opID})
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

function* download(state, action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload) {
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

  yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise, {
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

function* upload(_, action: FsGen.UploadPayload) {
  const {parentPath, localPath} = action.payload
  const opID = Constants.makeUUID()
  const path = Constants.getUploadedPath(parentPath, localPath)

  yield Saga.put(FsGen.createUploadStarted({path}))

  // TODO: confirm overwrites?
  // TODO: what about directory merges?
  yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise, {
    dest: Constants.pathToRPCPath(path),
    opID,
    src: {
      PathType: RPCTypes.PathType.local,
      local: Types.getNormalizedLocalPath(localPath),
    },
  })

  try {
    yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})
    yield Saga.put(FsGen.createUploadWritingSuccess({path}))
  } catch (error) {
    yield makeRetriableErrorHandler(action, path)(error).map(action => Saga.put(action))
  }
}

const cancelDownload = (state, action: FsGen.CancelDownloadPayload) => {
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

let polling = false
function* pollJournalFlushStatusUntilDone(_, action: EngineGen.Keybase1NotifyFSFSSyncActivityPayload) {
  if (polling) {
    return
  }
  polling = true
  try {
    while (1) {
      let {syncingPaths, totalSyncingBytes, endEstimate}: RPCTypes.FSSyncStatus = yield* Saga.callPromise(
        RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise,
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
        Saga.delay(getWaitDuration(endEstimate, 100, 4000)), // 0.1s to 4s
      ])
    }
  } finally {
    polling = false
    yield Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false}))
  }
}

const onTlfUpdate = (state, action: FsGen.NotifyTlfUpdatePayload) => {
  // Trigger folderListLoad and pathMetadata for paths that the user might be
  // looking at. Note that we don't have the actual path here, So instead just
  // always re-load them as long as the TLF path matches.
  //
  // Note that this is not merely a filtered mapping from the refresh tags.
  // Since KBFS only sends us the latest subscribed TLF, if we get a TLF other
  // than what our refreshTags suggest, the user must have been in a different
  // TLF. In this case, we remove the old tag so next time an action comes in,
  // we'll fire the RPC. This might not be necessary based on current design,
  // but just in case.
  //
  // It's important to not set the refreshTag in the actions generated here, to
  // make sure the related sagas won't skip the RPC (see `function*
  // folderList`).
  const actions = []
  folderListRefreshTags.forEach((path, refreshTag) =>
    Types.pathsAreInSameTlf(path, action.payload.tlfPath)
      ? actions.push(FsGen.createFolderListLoad({path}))
      : folderListRefreshTags.delete(refreshTag)
  )
  pathMetadataRefreshTags.forEach((path, refreshTag) =>
    Types.pathsAreInSameTlf(path, action.payload.tlfPath)
      ? actions.push(FsGen.createLoadPathMetadata({path}))
      : pathMetadataRefreshTags.delete(refreshTag)
  )
  return actions
}

// FSPathUpdate just subscribes on TLF level and sends over TLF path as of now.
const onFSPathUpdated = (_, action: EngineGen.Keybase1NotifyFSFSPathUpdatedPayload) =>
  FsGen.createNotifyTlfUpdate({tlfPath: Types.stringToPath(action.payload.params.path)})

function* ignoreFavoriteSaga(_, action: FsGen.FavoriteIgnorePayload) {
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
      yield* Saga.callPromise(RPCTypes.favoriteFavoriteIgnoreRpcPromise, {
        folder,
      })
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

const refreshLocalHTTPServerInfo = (state, action: FsGen.RefreshLocalHTTPServerInfoPayload) =>
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
      const {address, token} = yield* Saga.callPromise(
        RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise
      )
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

const commitEdit = (state, action: FsGen.CommitEditPayload): Promise<Saga.MaybeAction> => {
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
      return new Promise(resolve => resolve([]))
  }
}

function* loadPathMetadata(state, action: FsGen.LoadPathMetadataPayload) {
  const {path, refreshTag} = action.payload

  if (Types.getPathLevel(path) < 3) {
    return
  }

  if (refreshTag) {
    if (pathMetadataRefreshTags.get(refreshTag) === path) {
      // We are already subscribed; so don't fire RPC.
      return
    }

    pathMetadataRefreshTags.set(refreshTag, path)
  }

  try {
    const dirent = yield RPCTypes.SimpleFSSimpleFSStatRpcPromise({
      path: Constants.pathToRPCPath(path),
      refreshSubscription: !!refreshTag,
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

const letResetUserBackIn = (_, {payload: {id, username}}) =>
  RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise({id, username}).then(() => {})

const updateFsBadge = (state, action: FsGen.FavoritesLoadedPayload) =>
  NotificationsGen.createSetBadgeCounts({
    counts: I.Map({
      [Tabs.fsTab]: Constants.computeBadgeNumberForAll(state.fs.tlfs),
    }) as I.Map<Tabs.Tab, number>,
  })

const deleteFile = (state, action: FsGen.DeleteFilePayload) => {
  const opID = Constants.makeUUID()
  return RPCTypes.SimpleFSSimpleFSRemoveRpcPromise({
    opID,
    path: Constants.pathToRPCPath(action.payload.path),
    recursive: true,
  })
    .then(() => RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}))
    .catch(makeRetriableErrorHandler(action, action.payload.path))
}

const moveOrCopy = (state, action: FsGen.MovePayload | FsGen.CopyPayload) => {
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

const showMoveOrCopy = (state, action: FsGen.ShowMoveOrCopyPayload | FsGen.ShowIncomingSharePayload) =>
  RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})

const closeDestinationPicker = (state, action: FsGen.CloseDestinationPickerPayload) => {
  const currentRoutes = I.List()
  // const currentRoutes = getPathProps(state.routeTree.routeState)
  const firstDestinationPickerIndex = currentRoutes.findIndex(({node}) => node === 'destinationPicker')
  const newRoute = currentRoutes.reduce(
    (routes, {node, props}, i) =>
      // node is never null
      i < firstDestinationPickerIndex ? [...routes, {props, selected: node || ''}] : routes,
    []
  )
  return [
    // TODO use as const
    FsGen.createClearRefreshTag({refreshTag: Types.RefreshTag.DestinationPicker}),
    RouteTreeGen.createNavigateTo({path: newRoute}),
  ]
}

const initSendLinkToChat = (state, action: FsGen.InitSendLinkToChatPayload) => {
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

const triggerSendLinkToChat = (state, action: FsGen.TriggerSendLinkToChatPayload) => {
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
    ).then(result => FsGen.createSentLinkToChat({convID: conversationIDKey}))
  )
}

const clearRefreshTag = (state, action: FsGen.ClearRefreshTagPayload) => {
  folderListRefreshTags.delete(action.payload.refreshTag)
  pathMetadataRefreshTags.delete(action.payload.refreshTag)
}

// Can't rely on kbfsDaemonStatus.rpcStatus === 'waiting' as that's set by
// reducer and happens before this.
let waitForKbfsDaemonOnFly = false
const waitForKbfsDaemon = (state, action: ConfigGen.InstallerRanPayload | FsGen.WaitForKbfsDaemonPayload) => {
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

const startManualCR = (state, action) =>
  RPCTypes.SimpleFSSimpleFSClearConflictStateRpcPromise({
    path: Constants.pathToRPCPath(action.payload.tlfPath),
  }).then(() =>
    FsGen.createTlfCrStatusChanged({
      status: Types.ConflictState.InManualResolution,
      tlfPath: action.payload.tlfPath,
    })
  ) // TODO: deal with errors

const updateKbfsDaemonOnlineStatus = (
  state,
  action: FsGen.KbfsDaemonRpcStatusChangedPayload | ConfigGen.OsNetworkStatusChangedPayload
) =>
  state.fs.kbfsDaemonStatus.rpcStatus === Types.KbfsDaemonRpcStatus.Connected && state.config.osNetworkOnline
    ? RPCTypes.SimpleFSSimpleFSAreWeConnectedToMDServerRpcPromise().then(connectedToMDServer =>
        FsGen.createKbfsDaemonOnlineStatusChanged({online: connectedToMDServer})
      )
    : Promise.resolve(FsGen.createKbfsDaemonOnlineStatusChanged({online: false}))

// We don't trigger the reachability check at init. Reachability checks cause
// any pending "reconnect" fire right away, and overrides any random back-off
// timer we have at process restart (which is there to avoid surging server
// load around app releases). So only do that when OS network status changes
// after we're up.
const checkKbfsServerReachabilityIfNeeded = (state, action: ConfigGen.OsNetworkStatusChangedPayload) =>
  !action.payload.isInit && RPCTypes.SimpleFSSimpleFSCheckReachabilityRpcPromise()

const onFSOnlineStatusChanged = (state, action: EngineGen.Keybase1NotifyFSFSOnlineStatusChangedPayload) =>
  FsGen.createKbfsDaemonOnlineStatusChanged({online: action.payload.params.online})

const onFSOverallSyncSyncStatusChanged = (
  state,
  action: EngineGen.Keybase1NotifyFSFSOverallSyncStatusChangedPayload
) =>
  FsGen.createOverallSyncStatusChanged({
    outOfSpace: action.payload.params.status.outOfSyncSpace,
    progress: Constants.makeSyncingFoldersProgress(action.payload.params.status.prefetchProgress),
  })

const notifyDiskSpaceStatus = (diskSpaceStatus: Types.DiskSpaceStatus) => {
  switch (diskSpaceStatus) {
    case Types.DiskSpaceStatus.Error:
      NotifyPopup('Sync Error', {
        body: 'You are out of disk space. Some folders could not be synced.',
        sound: true,
      })
      break
    case Types.DiskSpaceStatus.Warning:
      NotifyPopup('Disk Space Low', {body: 'You have less than 1 GB of storage space left.'})
      break
    case Types.DiskSpaceStatus.Ok:
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(diskSpaceStatus)
  }
}

let prevOutOfSpace = false
const updateMenubarIconOnStuckSync = (state, action) => {
  const outOfSpace = action.payload.params.status.outOfSyncSpace
  if (outOfSpace !== prevOutOfSpace) {
    prevOutOfSpace = outOfSpace
    // TODO once go side sends info: low on space warning
    notifyDiskSpaceStatus(outOfSpace ? Types.DiskSpaceStatus.Error : Types.DiskSpaceStatus.Ok)
    return NotificationsGen.createBadgeApp({key: 'outOfSpace', on: outOfSpace})
  }
}

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<FsGen.RefreshLocalHTTPServerInfoPayload>(
    FsGen.refreshLocalHTTPServerInfo,
    refreshLocalHTTPServerInfo
  )
  yield* Saga.chainAction<FsGen.CancelDownloadPayload>(FsGen.cancelDownload, cancelDownload)
  yield* Saga.chainGenerator<FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload>(
    [FsGen.download, FsGen.shareNative, FsGen.saveMedia],
    download
  )
  yield* Saga.chainGenerator<FsGen.UploadPayload>(FsGen.upload, upload)
  yield* Saga.chainGenerator<FsGen.FolderListLoadPayload | FsGen.EditSuccessPayload>(
    [FsGen.folderListLoad, FsGen.editSuccess],
    folderList
  )
  yield* Saga.chainAction<FsGen.FavoritesLoadPayload>(FsGen.favoritesLoad, loadFavorites)
  yield* Saga.chainGenerator<FsGen.FavoriteIgnorePayload>(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield* Saga.chainAction<FsGen.FavoritesLoadedPayload>(FsGen.favoritesLoaded, updateFsBadge)
  yield* Saga.chainAction<FsGen.LetResetUserBackInPayload>(FsGen.letResetUserBackIn, letResetUserBackIn)
  yield* Saga.chainAction<FsGen.CommitEditPayload>(FsGen.commitEdit, commitEdit)
  yield* Saga.chainAction<FsGen.NotifyTlfUpdatePayload>(FsGen.notifyTlfUpdate, onTlfUpdate)
  yield* Saga.chainAction<FsGen.DeleteFilePayload>(FsGen.deleteFile, deleteFile)
  yield* Saga.chainGenerator<FsGen.LoadPathMetadataPayload>(FsGen.loadPathMetadata, loadPathMetadata)
  yield* Saga.chainAction<EngineGen.Keybase1NotifyFSFSPathUpdatedPayload>(
    EngineGen.keybase1NotifyFSFSPathUpdated,
    onFSPathUpdated
  )
  yield* Saga.chainGenerator<EngineGen.Keybase1NotifyFSFSSyncActivityPayload>(
    EngineGen.keybase1NotifyFSFSSyncActivity,
    pollJournalFlushStatusUntilDone
  )
  yield* Saga.chainAction<FsGen.MovePayload | FsGen.CopyPayload>([FsGen.move, FsGen.copy], moveOrCopy)
  yield* Saga.chainAction<FsGen.ShowMoveOrCopyPayload | FsGen.ShowIncomingSharePayload>(
    [FsGen.showMoveOrCopy, FsGen.showIncomingShare],
    showMoveOrCopy
  )
  yield* Saga.chainAction<FsGen.CloseDestinationPickerPayload>(
    FsGen.closeDestinationPicker,
    closeDestinationPicker
  )
  yield* Saga.chainAction<FsGen.InitSendLinkToChatPayload>(FsGen.initSendLinkToChat, initSendLinkToChat)
  yield* Saga.chainAction<FsGen.TriggerSendLinkToChatPayload>(
    FsGen.triggerSendLinkToChat,
    triggerSendLinkToChat
  )
  yield* Saga.chainAction<FsGen.ClearRefreshTagPayload>(FsGen.clearRefreshTag, clearRefreshTag)
  yield* Saga.chainAction<FsGen.KbfsDaemonRpcStatusChangedPayload>(
    FsGen.kbfsDaemonRpcStatusChanged,
    clearRefreshTags
  )
  yield* Saga.chainAction<ConfigGen.InstallerRanPayload | FsGen.WaitForKbfsDaemonPayload>(
    [ConfigGen.installerRan, FsGen.waitForKbfsDaemon],
    waitForKbfsDaemon
  )
  if (flags.kbfsOfflineMode) {
    yield* Saga.chainAction<FsGen.SetTlfSyncConfigPayload>(FsGen.setTlfSyncConfig, setTlfSyncConfig)
    yield* Saga.chainAction<FsGen.LoadTlfSyncConfigPayload>(
      [FsGen.loadTlfSyncConfig, FsGen.loadPathMetadata],
      loadTlfSyncConfig
    )
    yield* Saga.chainAction<
      FsGen.KbfsDaemonRpcStatusChangedPayload | ConfigGen.OsNetworkStatusChangedPayload
    >([FsGen.kbfsDaemonRpcStatusChanged, ConfigGen.osNetworkStatusChanged], updateKbfsDaemonOnlineStatus)
    yield* Saga.chainAction<ConfigGen.OsNetworkStatusChangedPayload>(
      ConfigGen.osNetworkStatusChanged,
      checkKbfsServerReachabilityIfNeeded
    )
    yield* Saga.chainAction<EngineGen.Keybase1NotifyFSFSOnlineStatusChangedPayload>(
      EngineGen.keybase1NotifyFSFSOnlineStatusChanged,
      onFSOnlineStatusChanged
    )
    yield* Saga.chainAction<EngineGen.Keybase1NotifyFSFSOverallSyncStatusChangedPayload>(
      EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged,
      onFSOverallSyncSyncStatusChanged
    )
    yield* Saga.chainAction<EngineGen.Keybase1NotifyFSFSOverallSyncStatusChangedPayload>(
      EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged,
      updateMenubarIconOnStuckSync
    )
    yield* Saga.chainAction<FsGen.LoadSettingsPayload>(FsGen.loadSettings, loadSettings)
    yield* Saga.chainAction<FsGen.SetSpaceAvailableNotificationThresholdPayload>(
      FsGen.setSpaceAvailableNotificationThreshold,
      setSpaceNotificationThreshold
    )
  }
  if (flags.conflictResolution) {
    yield* Saga.chainAction<FsGen.StartManualConflictResolutionPayload>(
      FsGen.startManualConflictResolution,
      startManualCR
    )
  }

  yield Saga.spawn(platformSpecificSaga)
}

export default fsSaga
