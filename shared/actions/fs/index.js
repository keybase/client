// @flow
import * as Constants from '../../constants/fs'
import * as ConfigGen from '../config-gen'
import * as FsGen from '../fs-gen'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as ChatTypes from '../../constants/types/chat2'
import * as Saga from '../../util/saga'
import * as Flow from '../../util/flow'
import * as SettingsConstants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import engine from '../../engine'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import logger from '../../logger'
import platformSpecificSaga from './platform-specific'
import {getContentTypeFromURL} from '../platform-specific'
import {isMobile} from '../../constants/platform'
import {type TypedState} from '../../util/container'
import {putActionIfOnPath, navigateAppend, navigateTo, switchTo, navigateUp} from '../route-tree'
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
  lastModifiedTimestamp: d.time,
  lastWriter: d.lastWriterUnverified,
  name: d.name.split('/').pop(),
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
    ...(action.payload.identifyBehavior ? {identifyBehavior: action.payload.identifyBehavior} : {}),
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
        filter: RPCTypes.simpleFSListFilter.filterSystemHidden,
        opID,
        path: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(rootPath),
        },
        refreshSubscription: !!refreshTag,
      })
    } else {
      yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise, {
        depth: 1,
        filter: RPCTypes.simpleFSListFilter.filterSystemHidden,
        opID,
        path: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(rootPath),
        },
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
      if (entry.type === 'folder' && Types.getPathLevel(path) > 3 && d.name.indexOf('/') < 0) {
        // Since we are loading with a depth of 2, first level directories are
        // considered "loaded".
        return [path, entry.set('progress', 'loaded')]
      }
      return [path, entry]
    }

    // Get metadata fields of the directory that we just loaded from state to
    // avoid overriding them.
    const state = yield* Saga.selectState()
    const {lastModifiedTimestamp, lastWriter, size, writable} = state.fs.pathItems.get(
      rootPath,
      Constants.makeFolder({name: Types.getPathName(rootPath)})
    )

    const pathItems = [
      ...(Types.getPathLevel(rootPath) > 2
        ? [
            [
              rootPath,
              Constants.makeFolder({
                children: I.Set(childMap.get(rootPath)),
                lastModifiedTimestamp,
                lastWriter,
                name: Types.getPathName(rootPath),
                progress: 'loaded',
                size,
                writable,
              }),
            ],
          ]
        : []),
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
    yield Saga.put(makeRetriableErrorHandler(action)(error))
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
      localPath = yield* Saga.callPromise(Constants.downloadFilePathFromPath, path)
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
      PathType: RPCTypes.simpleFSPathType.local,
      local: localPath,
    },
    opID,
    src: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(path),
    },
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
    yield Saga.put(FsGen.createDownloadSuccess({key, mimeType: mimeType?.mimeType || ''}))
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
  yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise, {
    dest: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(path),
    },
    opID,
    src: {
      PathType: RPCTypes.simpleFSPathType.local,
      local: Types.getNormalizedLocalPath(localPath),
    },
  })

  try {
    yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})
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
  return Saga.callUntyped(RPCTypes.SimpleFSSimpleFSCancelRpcPromise, {opID})
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
      let {syncingPaths, totalSyncingBytes, endEstimate}: RPCTypes.FSSyncStatus = yield* Saga.callPromise(
        RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise,
        {
          filter: RPCTypes.simpleFSListFilter.filterSystemHidden,
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
  } catch (error) {
    yield Saga.put(makeUnretriableErrorHandler(action)(error))
  } finally {
    polling = false
    yield Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false}))
  }
}

const onTlfUpdate = (state: TypedState, action: FsGen.NotifyTlfUpdatePayload) => {
  // Trigger folderListLoad and mimeTypeLoad for paths that the user might be
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
    Types.pathIsInTlfPath(path, action.payload.tlfPath)
      ? actions.push(Saga.put(FsGen.createFolderListLoad({path})))
      : folderListRefreshTags.delete(refreshTag)
  )
  mimeTypeRefreshTags.forEach((path, refreshTag) =>
    Types.pathIsInTlfPath(path, action.payload.tlfPath)
      ? actions.push(Saga.put(FsGen.createMimeTypeLoad({path})))
      : mimeTypeRefreshTags.delete(refreshTag)
  )
  return Saga.all(actions)
}

const setupEngineListeners = () => {
  engine().setIncomingCallMap({
    'keybase.1.NotifyFS.FSPathUpdated': ({path}) =>
      // FSPathUpdate just subscribes on TLF level and sends over TLF path as of
      // now.
      Saga.put(FsGen.createNotifyTlfUpdate({tlfPath: Types.stringToPath(path)})),
    'keybase.1.NotifyFS.FSSyncActivity': () => Saga.put(FsGen.createNotifySyncActivity()),
  })
}

function* ignoreFavoriteSaga(action: FsGen.FavoriteIgnorePayload): Saga.SagaGenerator<any, any> {
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
      yield Saga.put(makeRetriableErrorHandler(action)(error))
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

  const state = yield* Saga.selectState()
  let localHTTPServerInfo = state.fs.localHTTPServerInfo || Constants.makeLocalHTTPServer()
  // This should finish within 2 iterations at most. But just in case we bound
  // it at 3.
  for (let i = 0; i < 3; ++i) {
    if (localHTTPServerInfo.address === '' || localHTTPServerInfo.token === '') {
      const temp = yield* Saga.callPromise(RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise)
      localHTTPServerInfo = Constants.makeLocalHTTPServer(temp)
      yield Saga.put(
        FsGen.createLocalHTTPServerInfo({
          address: localHTTPServerInfo.address,
          token: localHTTPServerInfo.token,
        })
      )
    }
    try {
      const mimeType: Types.Mime = yield Saga.callUntyped(getMimeTypePromise, localHTTPServerInfo, path)
      yield Saga.put(FsGen.createMimeTypeLoaded({mimeType, path}))
      return mimeType
    } catch (err) {
      if (err === Constants.invalidTokenError) {
        localHTTPServerInfo = localHTTPServerInfo.set('token', '') // Set token to '' to trigger the refresh in next iteration.
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
      localHTTPServerInfo = localHTTPServerInfo.set('address', '')
    }
  }
  throw new Error('exceeded max retries')
}

function* loadMimeType(action: FsGen.MimeTypeLoadPayload) {
  try {
    yield* _loadMimeType(action.payload.path, action.payload.refreshTag)
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
        dest: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(Types.pathConcat(parentPath, name)),
        },
        flags: RPCTypes.simpleFSOpenFlags.directory,
        opID: Constants.makeUUID(),
      })
        .then(() => FsGen.createEditSuccess({editID, parentPath}))
        .catch(makeRetriableErrorHandler(action))
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(type)
      return new Promise(resolve => resolve())
  }
}

const _getRouteChangeForOpenMobile = (
  action: FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload,
  route: any
) =>
  action.type === FsGen.openPathItem
    ? navigateAppend([route])
    : navigateTo([Tabs.settingsTab, SettingsConstants.fsTab, 'folder', route])

const _getRouteChangeForOpenDesktop = (
  action: FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload,
  route: any
) =>
  action.type === FsGen.openPathItem ? navigateAppend([route]) : navigateTo([Tabs.fsTab, 'folder', route])

const _getRouteChangeActionForOpen = (
  action: FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload,
  route: any
) => {
  const routeChange = isMobile
    ? _getRouteChangeForOpenMobile(action, route)
    : _getRouteChangeForOpenDesktop(action, route)
  return action.payload.routePath ? putActionIfOnPath(action.payload.routePath, routeChange) : routeChange
}

const openPathItem = (
  state: TypedState,
  action: FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload
) =>
  Saga.callUntyped(function*() {
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
      if (mimeType === null) {
        mimeType = yield* _loadMimeType(path)
      }
      if (isMobile && Constants.viewTypeFromMimeType(mimeType) === 'image') {
        selected = 'barePreview'
      }
    }

    // This covers both 'file' and 'symlink'
    yield Saga.put(_getRouteChangeActionForOpen(action, {props: {path}, selected}))
  })

const letResetUserBackIn = ({payload: {id, username}}: FsGen.LetResetUserBackInPayload) =>
  Saga.callUntyped(RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise, {id, username})

const letResetUserBackInResult = () => undefined // Saga.put(FsGen.createLoadResets())

const updateFsBadge = (state, action: FsGen.FavoritesLoadedPayload) =>
  Saga.put(
    NotificationsGen.createSetBadgeCounts({
      counts: I.Map({
        [Tabs.fsTab]: Constants.computeBadgeNumberForAll(state.fs.tlfs),
      }),
    })
  )

const deleteFile = (state, action: FsGen.DeleteFilePayload) => {
  const opID = Constants.makeUUID()
  return RPCTypes.SimpleFSSimpleFSRemoveRpcPromise({
    opID,
    path: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(action.payload.path),
    },
  })
    .then(() => RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}))
    .catch(makeRetriableErrorHandler(action))
}

const moveOrCopy = (state, action: FsGen.MovePayload | FsGen.CopyPayload) => {
  const params = {
    dest: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(
        Types.pathConcat(
          action.payload.destinationParentPath,
          Types.getPathName(state.fs.moveOrCopy.sourceItemPath)
        )
      ),
    },
    opID: Constants.makeUUID(),
    src: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(state.fs.moveOrCopy.sourceItemPath),
    },
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
      .catch(makeUnretriableErrorHandler(action))
  )
}

const moveOrCopyOpenMobile = (state, action) =>
  Saga.all([
    Saga.put(
      FsGen.createSetMoveOrCopyDestinationParentPath({
        index: action.payload.currentIndex + 1,
        path: action.payload.path,
      })
    ),
    Saga.put(
      putActionIfOnPath(
        action.payload.routePath,
        navigateAppend([{props: {index: action.payload.currentIndex + 1}, selected: 'destinationPicker'}])
      )
    ),
  ])

const moveOrCopyOpenDesktop = (state, action) =>
  Saga.put(
    FsGen.createSetMoveOrCopyDestinationParentPath({
      index: action.payload.currentIndex,
      path: action.payload.path,
    })
  )

const showMoveOrCopy = isMobile
  ? (state, action) =>
      Saga.put(
        navigateTo([
          Tabs.settingsTab,
          SettingsConstants.fsTab,
          ...state.fs.moveOrCopy.destinationParentPath.map((p, index) => ({
            props: {index},
            selected: 'destinationPicker',
          })),
        ])
      )
  : (state, action) => Saga.put(navigateAppend([{props: {index: 0}, selected: 'destinationPicker'}]))

const cancelMoveOrCopy = isMobile
  ? (state, action) => Saga.put(switchTo([Tabs.settingsTab, SettingsConstants.fsTab, 'folder']))
  : (state, action) => Saga.put(navigateUp())

const showSendLinkToChat = (state, action) => {
  const elems = Types.getPathElements(state.fs.sendLinkToChat.path)
  const routeChange = Saga.put(
    action.payload.routePath
      ? putActionIfOnPath(action.payload.routePath, navigateAppend(['sendLinkToChat']))
      : navigateAppend(['sendLinkToChat'])
  )
  if (elems.length < 3) {
    // Not a TLF; so just show the modal and let user copy the path.
    return routeChange
  }

  const actions = [routeChange]

  if (elems[1] !== 'team') {
    // It's an impl team conversation. So resolve to a convID directly.
    actions.push(
      Saga.callUntyped(function*() {
        const result = yield Saga.callPromise(RPCChatTypes.localFindConversationsLocalRpcPromise, {
          identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
          membersType: RPCChatTypes.commonConversationMembersType.impteamnative,
          oneChatPerTLF: false,
          tlfName: elems[2],
          topicName: '',
          topicType: RPCChatTypes.commonTopicType.chat,
          visibility: RPCTypes.commonTLFVisibility.private,
        })

        if (!result.conversations || !result.conversations.length) {
          // TODO: error?
          return
        }

        yield Saga.put(
          FsGen.createSetSendLinkToChatConvID({
            convID: ChatTypes.conversationIDToKey(result.conversations[0].info.id),
          })
        )
      })
    )
  } else {
    // It's a real team, but we don't know if it's a small team or big team. So
    // call RPCChatTypes.localGetTLFConversationsLocalRpcPromise to get all
    // channels. We could have used the Teams store, but then we are doing
    // cross-store stuff and are depending on the Teams store. If this turns
    // out to feel slow, we can probably cahce the results.
    actions.push(
      Saga.callUntyped(function*() {
        const result = yield Saga.callPromise(RPCChatTypes.localGetTLFConversationsLocalRpcPromise, {
          membersType: RPCChatTypes.commonConversationMembersType.team,
          tlfName: elems[2],
          topicType: RPCChatTypes.commonTopicType.chat,
        })

        if (!result.convs || !result.convs.length) {
          // TODO: error?
          return
        }

        yield Saga.put(
          FsGen.createSetSendLinkToChatChannels({
            channels: I.Map(result.convs.map(conv => [conv.convID, conv.channel])),
          })
        )

        if (result.convs.length === 1) {
          // Auto-select channel if it's the only one.
          yield Saga.put(
            FsGen.createSetSendLinkToChatConvID({
              convID: ChatTypes.stringToConversationIDKey(result.convs[0].convID),
            })
          )
        }
      })
    )
  }

  return Saga.all(actions)
}

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(FsGen.refreshLocalHTTPServerInfo, refreshLocalHTTPServerInfo)
  yield Saga.safeTakeEveryPure(FsGen.cancelDownload, cancelDownload)
  yield Saga.safeTakeEvery([FsGen.download, FsGen.shareNative, FsGen.saveMedia], download)
  yield Saga.safeTakeEvery(FsGen.upload, upload)
  yield Saga.safeTakeEvery([FsGen.folderListLoad, FsGen.editSuccess], folderList)
  yield Saga.actionToPromise(FsGen.filePreviewLoad, filePreview)
  yield Saga.actionToPromise(FsGen.favoritesLoad, loadFavorites)
  yield Saga.safeTakeEvery(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield Saga.actionToAction(FsGen.favoritesLoaded, updateFsBadge)
  yield Saga.safeTakeEvery(FsGen.mimeTypeLoad, loadMimeType)
  yield Saga.safeTakeEveryPure(FsGen.letResetUserBackIn, letResetUserBackIn, letResetUserBackInResult)
  yield Saga.actionToPromise(FsGen.commitEdit, commitEdit)
  yield Saga.safeTakeEvery(FsGen.notifySyncActivity, pollSyncStatusUntilDone)
  yield Saga.actionToAction(FsGen.notifyTlfUpdate, onTlfUpdate)
  yield Saga.actionToPromise(FsGen.deleteFile, deleteFile)
  yield Saga.actionToAction([FsGen.openPathItem, FsGen.openPathInFilesTab], openPathItem)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
  yield Saga.actionToPromise([FsGen.move, FsGen.copy], moveOrCopy)
  yield Saga.actionToAction(FsGen.moveOrCopyOpen, isMobile ? moveOrCopyOpenMobile : moveOrCopyOpenDesktop)
  yield Saga.actionToAction(FsGen.showMoveOrCopy, showMoveOrCopy)
  yield Saga.actionToAction(FsGen.cancelMoveOrCopy, cancelMoveOrCopy)
  yield Saga.actionToAction(FsGen.showSendLinkToChat, showSendLinkToChat)

  yield Saga.spawn(platformSpecificSaga)
}

export default fsSaga
