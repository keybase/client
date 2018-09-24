// @flow
import * as Constants from '../../constants/fs'
import * as ConfigGen from '../config-gen'
import * as FsGen from '../fs-gen'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as Tabs from '../../constants/tabs'
import engine from '../../engine'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import logger from '../../logger'
import platformSpecificSaga from './platform-specific'
import {getContentTypeFromURL} from '../platform-specific'
import {isMobile} from '../../constants/platform'
import {type TypedState} from '../../util/container'
import {switchTo, putActionIfOnPath, navigateAppend, navigateTo} from '../route-tree'
import {makeRetriableErrorHandler, makeUnretriableErrorHandler} from './shared'

const loadFavorites = (state: TypedState, action) =>
  RPCTypes.apiserverGetWithSessionRpcPromise({
    args: [{key: 'problems', value: '1'}],
    endpoint: 'kbfs/favorite/list',
  })
    .then(results =>
      Constants.createFavoritesLoadedFromJSONResults(
        results && results.body,
        state.config.username || '',
        state.config.loggedIn
      )
    )
    .catch(makeRetriableErrorHandler(action))

const direntToMetadata = (d: RPCTypes.Dirent) => ({
  name: d.name.split('/').pop(),
  lastModifiedTimestamp: d.time,
  lastWriter: d.lastWriterUnverified,
  size: d.size,
  writable: d.writable,
})

const makeEntry = (d: RPCTypes.Dirent, children?: Set<string>) => {
  switch (d.direntType) {
    case RPCTypes.simpleFSDirentType.dir:
      return Constants.makeFolder({
        ...direntToMetadata(d),
        children: I.Set(children),
        progress: children ? 'loaded' : undefined,
      })
    case RPCTypes.simpleFSDirentType.sym:
      return Constants.makeSymlink({
        ...direntToMetadata(d),
        // TODO: plumb link target
      })
    case RPCTypes.simpleFSDirentType.file:
    case RPCTypes.simpleFSDirentType.exec:
      return Constants.makeFile(direntToMetadata(d))
    default:
      return Constants.makeUnknownPathItem(direntToMetadata(d))
  }
}

const filePreview = (state: TypedState, action) =>
  RPCTypes.SimpleFSSimpleFSStatRpcPromise({
    path: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(action.payload.path),
    },
  })
    .then(dirent =>
      FsGen.createFilePreviewLoaded({
        meta: makeEntry(dirent),
        path: action.payload.path,
      })
    )
    .catch(makeRetriableErrorHandler(action))

// See constants/types/fs.js on what this is for.
// We intentionally keep this here rather than in the redux store.
const folderListRefreshTags: Map<Types.RefreshTag, Types.Path> = new Map()
const mimeTypeRefreshTags: Map<Types.RefreshTag, Types.Path> = new Map()

function* folderList(
  action: FsGen.FolderListLoadPayload | FsGen.EditSuccessPayload
): Saga.SagaGenerator<any, any> {
  try {
    const opID = Constants.makeUUID()
    const {rootPath, refreshTag} =
      action.type === FsGen.editSuccess
        ? {rootPath: action.payload.parentPath, refreshTag: undefined}
        : {rootPath: action.payload.path, refreshTag: action.payload.refreshTag}

    if (refreshTag) {
      if (folderListRefreshTags.get(refreshTag) === rootPath) {
        // We are already subscribed; so don't fire RPC.
        return
      }

      folderListRefreshTags.set(refreshTag, rootPath)
    }

    const pathElems = Types.getPathElements(rootPath)
    if (pathElems.length < 3) {
      yield Saga.call(RPCTypes.SimpleFSSimpleFSListRpcPromise, {
        opID,
        path: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(rootPath),
        },
        filter: RPCTypes.simpleFSListFilter.filterAllHidden,
        refreshSubscription: !!refreshTag,
      })
    } else {
      yield Saga.call(RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise, {
        opID,
        path: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(rootPath),
        },
        filter: RPCTypes.simpleFSListFilter.filterAllHidden,
        refreshSubscription: !!refreshTag,
        depth: 1,
      })
    }

    yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})

    const result = yield Saga.call(RPCTypes.SimpleFSSimpleFSReadListRpcPromise, {opID})
    const entries = result.entries || []
    const childMap = entries.reduce((m: Map<Types.Path, Set<string>>, d: RPCTypes.Dirent) => {
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
      if (entry.type === 'folder' && Types.getPathLevel(path) > 3 && d.name.indexOf('/') < 0) {
        // Since we are loading with a depth of 2, first level directories are
        // considered "loaded".
        return [path, entry.set('progress', 'loaded')]
      }
      return [path, entry]
    }

    // Get metadata fields of the directory that we just loaded from state to
    // avoid overriding them.
    const state = yield Saga.select()
    const {lastModifiedTimestamp, lastWriter, size, writable}: Types.FolderPathItem = state.fs.pathItems.get(
      rootPath,
      Constants.makeFolder({name: Types.getPathName(rootPath)})
    )

    const pathItems = [
      ...(Types.getPathLevel(rootPath) > 2
        ? [
            [
              rootPath,
              Constants.makeFolder({
                lastModifiedTimestamp,
                lastWriter,
                size,
                name: Types.getPathName(rootPath),
                writable,
                children: I.Set(childMap.get(rootPath)),
                progress: 'loaded',
              }),
            ],
          ]
        : []),
      ...entries.map(direntToPathAndPathItem),
    ]
    yield Saga.put(FsGen.createFolderListLoaded({pathItems: I.Map(pathItems), path: rootPath}))
    if (action.type === FsGen.editSuccess) {
      // Note that we discard the Edit metadata here rather than immediately
      // after an FsGen.editSuccess event, so that if we hear about journal
      // uploading the new folder before we hear from the folder list result,
      // fs/footer/upload-container.js can determine this is a newly created
      // folder instead of a file upload based on state.fs.edits.
      yield Saga.put(FsGen.createDiscardEdit({editID: action.payload.editID}))
    }
  } catch (error) {
    yield Saga.put(makeRetriableErrorHandler(action)(error))
  }
}

function* monitorDownloadProgress(key: string, opID: RPCTypes.OpID) {
  // This loop doesn't finish on its own, but it's in a Saga.race with
  // `SimpleFSWait`, so it's "canceled" when the other finishes.
  while (true) {
    yield Saga.delay(500)
    const progress = yield Saga.call(RPCTypes.SimpleFSSimpleFSCheckRpcPromise, {opID})
    if (progress.bytesTotal === 0) {
      continue
    }
    yield Saga.put(
      FsGen.createDownloadProgress({
        key,
        endEstimate: progress.endEstimate,
        completePortion: progress.bytesWritten / progress.bytesTotal,
      })
    )
  }
}

function* download(
  action: FsGen.DownloadPayload | FsGen.ShareNativePayload | FsGen.SaveMediaPayload
): Saga.SagaGenerator<any, any> {
  const {path, key} = action.payload
  const intent = Constants.getDownloadIntentFromAction(action)
  const opID = Constants.makeUUID()

  // Figure out the local path we are downloading into.
  let localPath = ''
  switch (intent) {
    case 'none':
      // This adds " (1)" suffix to the base name, if the destination path
      // already exists.
      localPath = yield Saga.call(Constants.downloadFilePathFromPath, path)
      break
    case 'camera-roll':
    case 'share':
      // For saving to camera roll or sharing to other apps, we are
      // downloading to the app's local storage. So don't bother trying to
      // avoid overriding existing files. Just download over them.
      localPath = Constants.downloadFilePathFromPathNoSearch(path)
      break
    case 'web-view':
    case 'web-view-text':
      // TODO
      return
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(intent);
      */
      localPath = yield Saga.call(Constants.downloadFilePathFromPath, path)
      break
  }

  yield Saga.put(
    FsGen.createDownloadStarted({
      key,
      path,
      localPath,
      intent,
      opID,
      // Omit entryType to let reducer figure out.
    })
  )

  yield Saga.call(RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise, {
    opID,
    src: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(path),
    },
    dest: {
      PathType: RPCTypes.simpleFSPathType.local,
      local: localPath,
    },
  })

  try {
    yield Saga.race({
      monitor: Saga.call(monitorDownloadProgress, key, opID),
      wait: Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID}),
    })

    // No error, so the download has finished successfully. Set the
    // completePortion to 1.
    yield Saga.put(FsGen.createDownloadProgress({key, completePortion: 1}))

    const mimeType = yield Saga.call(_loadMimeType, path)
    yield Saga.put(FsGen.createDownloadSuccess({key, mimeType}))
  } catch (error) {
    yield Saga.put(makeRetriableErrorHandler(action)(error))
    if (intent !== 'none') {
      // If it's a normal download, we show a red card for the user to dismiss.
      // TODO: when we get rid of download cards on Android, check isMobile
      // here.
      yield Saga.put(FsGen.createDismissDownload({key}))
    }
  }
}

function* upload(action: FsGen.UploadPayload) {
  const {parentPath, localPath} = action.payload
  const opID = Constants.makeUUID()
  const path = Constants.getUploadedPath(parentPath, localPath)

  yield Saga.put(FsGen.createUploadStarted({path}))

  // TODO: confirm overwrites?
  // TODO: what about directory merges?
  yield Saga.call(RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise, {
    opID,
    src: {
      PathType: RPCTypes.simpleFSPathType.local,
      local: Types.getNormalizedLocalPath(localPath),
    },
    dest: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(path),
    },
  })

  try {
    yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})
    yield Saga.put(FsGen.createUploadWritingSuccess({path}))
  } catch (error) {
    yield Saga.put(makeRetriableErrorHandler(action)(error))
  }
}

function cancelDownload({payload: {key}}: FsGen.CancelDownloadPayload, state: TypedState) {
  const download = state.fs.downloads.get(key)
  if (!download) {
    console.log(`unknown download: ${key}`)
    return
  }
  const {
    meta: {opID},
  } = download
  return Saga.call(RPCTypes.SimpleFSSimpleFSCancelRpcPromise, {opID})
}

const getWaitDuration = (endEstimate: ?number, lower: number, upper: number): number => {
  if (!endEstimate) {
    return upper
  }

  const diff = endEstimate - Date.now()
  return diff < lower ? lower : diff > upper ? upper : diff
}

let polling = false
function* pollSyncStatusUntilDone(action: FsGen.NotifySyncActivityPayload): Saga.SagaGenerator<any, any> {
  if (polling) {
    return
  }
  polling = true
  try {
    while (1) {
      let {syncingPaths, totalSyncingBytes, endEstimate}: RPCTypes.FSSyncStatus = yield Saga.call(
        RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise,
        {
          filter: RPCTypes.simpleFSListFilter.filterAllHidden,
        }
      )
      yield Saga.sequentially([
        Saga.put(
          FsGen.createJournalUpdate({
            syncingPaths: (syncingPaths || []).map(Types.stringToPath),
            totalSyncingBytes,
            endEstimate,
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
        Saga.put(FsGen.createSetFlags({syncing: true})),
        Saga.delay(getWaitDuration(endEstimate, 100, 4000)), // 0.1s to 4s
      ])
    }
  } catch (error) {
    yield Saga.put(makeUnretriableErrorHandler(action)(error))
  } finally {
    polling = false
    yield Saga.sequentially([
      Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false})),
      Saga.put(FsGen.createSetFlags({syncing: false})),
    ])
  }
}

const onTlfUpdate = (state: TypedState, action: FsGen.NotifyTlfUpdatePayload) => {
  // Trigger folderListLoad and mimeTypeLoad for paths that the user might be
  // looking at. Note that we don't have the actual path here, So instead just
  // always re-load them as long as the TLF path matches.
  //
  // Note that this is not merely a filtered mapping from the refresh tags. If
  // the user is in a different TLF, we remove the old tag so next time an
  // action comes in, we'll fire the RPC. This might not be necessary based on
  // current design, but just in case.
  //
  // It's important to not set the refreshTag in new actions, to make sure the
  // related sagas won't skip the RPC.
  const actions = []
  folderListRefreshTags.forEach(
    (path, refreshTag) =>
      Types.pathIsInTlfPath(path, action.payload.tlfPath)
        ? actions.push(Saga.put(FsGen.createFolderListLoad({path})))
        : folderListRefreshTags.delete(refreshTag)
  )
  mimeTypeRefreshTags.forEach(
    (path, refreshTag) =>
      Types.pathIsInTlfPath(path, action.payload.tlfPath)
        ? actions.push(Saga.put(FsGen.createMimeTypeLoad({path})))
        : folderListRefreshTags.delete(refreshTag)
  )
  return Saga.all(actions)
}

const setupEngineListeners = () => {
  engine().setIncomingCallMap({
    'keybase.1.NotifyFS.FSSyncActivity': () => Saga.put(FsGen.createNotifySyncActivity()),
    'keybase.1.NotifyFS.FSPathUpdated': ({path}) =>
      // FSPathUpdate just subscribes on TLF level and sends over TLF path as of
      // now.
      Saga.put(FsGen.createNotifyTlfUpdate({tlfPath: Types.stringToPath(path)})),
  })
}

function* ignoreFavoriteSaga(action: FsGen.FavoriteIgnorePayload): Saga.SagaGenerator<any, any> {
  const folder = Constants.folderRPCFromPath(action.payload.path)
  if (!folder) {
    // TODO: make the ignore button have a pending state and get rid of this?
    yield Saga.put(
      FsGen.createFavoriteIgnoreError({
        path: action.payload.path,
        error: Constants.makeError({
          error: 'No folder specified',
          erroredAction: action,
        }),
      })
    )
  } else {
    try {
      yield Saga.call(RPCTypes.favoriteFavoriteIgnoreRpcPromise, {
        folder,
      })
    } catch (error) {
      yield Saga.put(makeRetriableErrorHandler(action)(error))
    }
  }
}

// Following RFC https://tools.ietf.org/html/rfc7231#section-3.1.1.1 Examples:
//   text/html;charset=utf-8
//   text/html;charset=UTF-8
//   Text/HTML;Charset="utf-8"
//   text/html; charset="utf-8"
// The last part is optional, so if `;` is missing, it'd be just the mimetype.
const extractMimeTypeFromContentType = (contentType: string): string => {
  const ind = contentType.indexOf(';')
  return (ind > -1 ? contentType.slice(0, ind) : contentType).toLowerCase()
}

const getMimeTypePromise = (localHTTPServerInfo: Types._LocalHTTPServer, path: Types.Path) =>
  new Promise((resolve, reject) =>
    getContentTypeFromURL(
      Constants.generateFileURL(path, localHTTPServerInfo),
      ({error, statusCode, contentType}) => {
        if (error) {
          reject(error)
          return
        }
        switch (statusCode) {
          case 200:
            resolve(extractMimeTypeFromContentType(contentType || ''))
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

const refreshLocalHTTPServerInfo = (state: TypedState, action: FsGen.RefreshLocalHTTPServerInfoPayload) =>
  RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise()
    .then(({address, token}) => FsGen.createLocalHTTPServerInfo({address, token}))
    .catch(makeUnretriableErrorHandler(action))

// loadMimeType uses HEAD request to load mime type from the KBFS HTTP server.
// If the server address/token are not populated yet, or if the token turns out
// to be invalid, it automatically uses
// SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise to refresh that. The
// generator function returns the loaded mime type for the given path, and in
// addition triggers a mimeTypeLoaded so the loaded mime type for given path is
// populated in the store.
function* _loadMimeType(path: Types.Path, refreshTag?: Types.RefreshTag) {
  if (refreshTag) {
    if (mimeTypeRefreshTags.get(refreshTag) === path) {
      // We are already subscribed; so don't fire RPC.
      return
    }

    mimeTypeRefreshTags.set(refreshTag, path)
  }

  const state = yield Saga.select()
  let localHTTPServerInfo: Types._LocalHTTPServer =
    state.fs.localHTTPServerInfo || Constants.makeLocalHTTPServer()
  // This should finish within 2 iterations at most. But just in case we bound
  // it at 3.
  for (let i = 0; i < 3; ++i) {
    if (localHTTPServerInfo.address === '' || localHTTPServerInfo.token === '') {
      localHTTPServerInfo = yield Saga.call(RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise)
      yield Saga.put(FsGen.createLocalHTTPServerInfo(localHTTPServerInfo))
    }
    try {
      const mimeType = yield Saga.call(getMimeTypePromise, localHTTPServerInfo, path)
      yield Saga.put(FsGen.createMimeTypeLoaded({path, mimeType}))
      return mimeType
    } catch (err) {
      if (err === Constants.invalidTokenError) {
        localHTTPServerInfo.token = '' // Set token to '' to trigger the refresh in next iteration.
        continue
      }
      if (err === Constants.notFoundError) {
        // This file or its parent folder has been removed. So just stop here.
        // This could happen when there are KBFS updates if user has previously
        // inspected mime type, and we tracked the path through a refresh tag,
        // but the path has been removed since then.
        return
      }
      // It's still possible we have a critical error, but if it's just the
      // server port number that's changed, it's hard to detect. So just treat
      // all other errors as this case. If this is actually a critical error,
      // we end up doing this 3 times for nothing, which isn't the end of the
      // world.
      logger.info(`_loadMimeType i=${i} error:`, err)
      localHTTPServerInfo.address = ''
    }
  }
  throw new Error('exceeded max retries')
}

function* loadMimeType(action: FsGen.MimeTypeLoadPayload) {
  try {
    yield Saga.call(_loadMimeType, action.payload.path, action.payload.refreshTag)
  } catch (error) {
    yield Saga.put(makeUnretriableErrorHandler(action)(error))
  }
}

const commitEdit = (state: TypedState, action: FsGen.CommitEditPayload) => {
  const {editID} = action.payload
  const edit = state.fs.edits.get(editID)
  if (!edit) {
    return null
  }
  const {parentPath, name, type} = edit
  switch (type) {
    case 'new-folder':
      return RPCTypes.SimpleFSSimpleFSOpenRpcPromise({
        opID: Constants.makeUUID(),
        dest: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(Types.pathConcat(parentPath, name)),
        },
        flags: RPCTypes.simpleFSOpenFlags.directory,
      })
        .then(() => FsGen.createEditSuccess({editID, parentPath}))
        .catch(makeRetriableErrorHandler(action))
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(type);
      */
      return new Promise(resolve => resolve())
  }
}

const _getRouteChangeActionForOpen = (
  action: FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload,
  route: any
) => {
  const routeChange =
    action.type === FsGen.openPathItem ? navigateAppend([route]) : navigateTo([Tabs.fsTab, route])
  return action.payload.routePath ? putActionIfOnPath(action.payload.routePath, routeChange) : routeChange
}

const openPathItem = (
  state: TypedState,
  action: FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload
) =>
  Saga.call(function*() {
    const {path} = action.payload

    if (Types.getPathLevel(path) < 3) {
      // We are in either /keybase or a TLF list. So treat it as a folder.
      yield Saga.put(_getRouteChangeActionForOpen(action, {props: {path}, selected: 'folder'}))
      return
    }

    let pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
    // If we are handling a FsGen.openPathInFilesTab, always refresh metadata
    // (PathItem), as the type of the entry could have changed before last time
    // we heard about it from SimpleFS. Technically this is possible for
    // FsGen.openPathItem too, but generally it's shortly after user has
    // interacted with its parent folder, where we'd have just refreshed the
    // PathItem for the entry.
    if (action.type === FsGen.openPathInFilesTab || pathItem.type === 'unknown') {
      const dirent = yield RPCTypes.SimpleFSSimpleFSStatRpcPromise({
        path: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(path),
        },
      })
      pathItem = makeEntry(dirent)
      yield Saga.put(
        FsGen.createFilePreviewLoaded({
          meta: pathItem,
          path,
        })
      )
    }

    if (pathItem.type === 'unknown' || pathItem.type === 'folder') {
      yield Saga.put(_getRouteChangeActionForOpen(action, {props: {path}, selected: 'folder'}))
      return
    }

    let selected = 'preview'
    if (pathItem.type === 'file') {
      let mimeType = pathItem.mimeType
      if (mimeType === '') {
        mimeType = yield Saga.call(_loadMimeType, path)
      }
      if (isMobile && Constants.viewTypeFromMimeType(mimeType) === 'image') {
        selected = 'barePreview'
      }
    }

    // This covers both 'file' and 'symlink'
    yield Saga.put(_getRouteChangeActionForOpen(action, {props: {path}, selected}))
  })

const openFilesFromWidget = (state: TypedState, {payload: {path}}: FsGen.OpenFilesFromWidgetPayload) => {
  const pathItem = path ? state.fs.pathItems.get(path) : undefined
  const selected = pathItem && pathItem.type !== 'folder' ? 'preview' : 'folder'
  return Saga.sequentially([
    Saga.put(ConfigGen.createShowMain()),
    Saga.put(switchTo([Tabs.fsTab])),
    ...(path
      ? [
          Saga.put(
            navigateAppend([
              {
                props: {path},
                selected,
              },
            ])
          ),
        ]
      : []),
  ])
}

const letResetUserBackIn = ({payload: {id, username}}: FsGen.LetResetUserBackInPayload) =>
  Saga.call(RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise, {id, username})

const letResetUserBackInResult = () => undefined // Saga.put(FsGen.createLoadResets())

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(FsGen.refreshLocalHTTPServerInfo, refreshLocalHTTPServerInfo)
  yield Saga.safeTakeEveryPure(FsGen.cancelDownload, cancelDownload)
  yield Saga.safeTakeEvery([FsGen.download, FsGen.shareNative, FsGen.saveMedia], download)
  yield Saga.safeTakeEvery(FsGen.upload, upload)
  yield Saga.safeTakeEvery([FsGen.folderListLoad, FsGen.editSuccess], folderList)
  yield Saga.actionToPromise(FsGen.filePreviewLoad, filePreview)
  yield Saga.actionToPromise(FsGen.favoritesLoad, loadFavorites)
  yield Saga.safeTakeEvery(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield Saga.safeTakeEvery(FsGen.mimeTypeLoad, loadMimeType)
  yield Saga.safeTakeEveryPure(FsGen.letResetUserBackIn, letResetUserBackIn, letResetUserBackInResult)
  yield Saga.actionToPromise(FsGen.commitEdit, commitEdit)
  yield Saga.safeTakeEvery(FsGen.notifySyncActivity, pollSyncStatusUntilDone)
  yield Saga.actionToAction(FsGen.notifyTlfUpdate, onTlfUpdate)
  yield Saga.actionToAction([FsGen.openPathItem, FsGen.openPathInFilesTab], openPathItem)
  yield Saga.actionToAction(FsGen.openFilesFromWidget, openFilesFromWidget)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  yield Saga.fork(platformSpecificSaga)
}

export default fsSaga
