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
import * as Tabs from '../../constants/tabs'
import engine from '../../engine'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import logger from '../../logger'
import platformSpecificSaga from './platform-specific'
import {getContentTypeFromURL} from '../platform-specific'
import {isMobile} from '../../constants/platform'
import * as RouteTreeGen from '../route-tree-gen'
import {getPathProps} from '../../route-tree'
import {fsRootRoute, makeRetriableErrorHandler, makeUnretriableErrorHandler} from './shared'

const loadFavorites = (state, action) =>
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

const filePreview = (state, action) =>
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

function* folderList(_, action) {
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

function* download(state, action) {
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
    // This needs to be before the dismiss below, so that if it's a legit
    // error we'd show the red bar.
    yield Saga.put(makeRetriableErrorHandler(action)(error))
  } finally {
    if (intent !== 'none') {
      // If it's a normal download, we show a red card for the user to dismiss.
      // TODO: when we get rid of download cards on Android, check isMobile
      // here.
      yield Saga.put(FsGen.createDismissDownload({key}))
    }
  }
}

function* upload(_, action) {
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

const cancelDownload = (state, action) => {
  const download = state.fs.downloads.get(action.payload.key)
  if (!download) {
    return
  }
  const {
    meta: {opID},
  } = download
  return RPCTypes.SimpleFSSimpleFSCancelRpcPromise({opID}).then(() => {})
}

const getWaitDuration = (endEstimate: ?number, lower: number, upper: number): number => {
  if (!endEstimate) {
    return upper
  }

  const diff = endEstimate - Date.now()
  return diff < lower ? lower : diff > upper ? upper : diff
}

let polling = false
function* pollSyncStatusUntilDone(_, action) {
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

const onTlfUpdate = (state, action) => {
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
      ? actions.push(FsGen.createFolderListLoad({path}))
      : folderListRefreshTags.delete(refreshTag)
  )
  mimeTypeRefreshTags.forEach((path, refreshTag) =>
    Types.pathIsInTlfPath(path, action.payload.tlfPath)
      ? actions.push(FsGen.createMimeTypeLoad({path}))
      : mimeTypeRefreshTags.delete(refreshTag)
  )
  return actions
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

function* ignoreFavoriteSaga(_, action) {
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

const refreshLocalHTTPServerInfo = (state, action) =>
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

function* loadMimeType(_, action) {
  try {
    yield* _loadMimeType(action.payload.path, action.payload.refreshTag)
  } catch (error) {
    yield Saga.put(makeUnretriableErrorHandler(action)(error))
  }
}

const commitEdit = (state, action) => {
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

const _getRouteChangeForOpenPathInFilesTab = (action: FsGen.OpenPathInFilesTabPayload, finalRoute: any) =>
  isMobile
    ? RouteTreeGen.createNavigateTo({
        path:
          action.payload.path === Constants.defaultPath
            ? fsRootRoute
            : [
                ...fsRootRoute,
                // Construct all parent folders so back button works all the way back
                // to /keybase
                ...Types.getPathElements(action.payload.path)
                  .slice(1, -1) // fsTab default to /keybase, so we skip one here
                  .reduce(
                    (routes, elem) => [
                      ...routes,
                      {
                        props: {
                          path: routes.length
                            ? Types.pathConcat(routes[routes.length - 1].props.path, elem)
                            : Types.stringToPath(`/keybase/${elem}`),
                        },
                        selected: 'main',
                      },
                    ],
                    []
                  ),
                finalRoute,
              ],
      })
    : RouteTreeGen.createNavigateTo({
        path: [
          Tabs.fsTab,
          // Prepend the parent folder so when user clicks the back button they'd
          // go back to the parent folder.
          {props: {path: Types.getPathParent(action.payload.path)}, selected: 'main'},
          finalRoute,
        ],
      })

const _getRouteChangeActionForOpen = (
  action: FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload,
  finalRoute: any
) => {
  const routeChange =
    action.type === FsGen.openPathItem
      ? RouteTreeGen.createNavigateAppend({path: [finalRoute]})
      : _getRouteChangeForOpenPathInFilesTab(action, finalRoute)
  return action.payload.routePath
    ? RouteTreeGen.createPutActionIfOnPath({expectedPath: action.payload.routePath, otherAction: routeChange})
    : routeChange
}

const openPathItem = (state, action) =>
  _getRouteChangeActionForOpen(action, {props: {path: action.payload.path}, selected: 'main'})

function* loadPathMetadata(state, action) {
  const {path} = action.payload

  if (Types.getPathLevel(path) < 3) {
    return
  }

  let pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  try {
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
  } catch (err) {
    yield Saga.put(makeRetriableErrorHandler(action)(err))
    return
  }
  if (pathItem.type === 'file') {
    yield Saga.put(FsGen.createMimeTypeLoad({path}))
  }
}

const letResetUserBackIn = (_, {payload: {id, username}}) =>
  RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise({id, username}).then(() => {})

const updateFsBadge = (state, action) =>
  NotificationsGen.createSetBadgeCounts({
    counts: I.Map({
      [Tabs.fsTab]: Constants.computeBadgeNumberForAll(state.fs.tlfs),
    }),
  })

const deleteFile = (state, action) => {
  const opID = Constants.makeUUID()
  return RPCTypes.SimpleFSSimpleFSRemoveRpcPromise({
    opID,
    path: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(action.payload.path),
    },
    recursive: false,
  })
    .then(() => RPCTypes.SimpleFSSimpleFSWaitRpcPromise({opID}))
    .catch(makeRetriableErrorHandler(action))
}

const moveOrCopy = (state, action) => {
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

const moveOrCopyOpen = (state, action) => [
  FsGen.createSetMoveOrCopyDestinationParentPath({
    index: action.payload.currentIndex + 1,
    path: action.payload.path,
  }),
  RouteTreeGen.createPutActionIfOnPath({
    expectedPath: action.payload.routePath,
    otherAction: RouteTreeGen.createNavigateAppend({
      path: [{props: {index: action.payload.currentIndex + 1}, selected: 'destinationPicker'}],
    }),
  }),
]

const showMoveOrCopy = (state, action) =>
  RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})

const closeMoveOrCopy = (state, action) => {
  const currentRoutes = getPathProps(state.routeTree.routeState)
  const firstDestinationPickerIndex = currentRoutes.findIndex(({node}) => node === 'destinationPicker')
  const newRoute = currentRoutes.reduce(
    (routes, {node, props}, i) =>
      // node is never null
      i < firstDestinationPickerIndex ? [...routes, {props, selected: node || ''}] : routes,
    []
  )
  return [
    FsGen.createClearRefreshTag({refreshTag: 'destination-picker'}),
    RouteTreeGen.createNavigateTo({path: newRoute}),
  ]
}

function* showSendLinkToChat(state, action) {
  const elems = Types.getPathElements(state.fs.sendLinkToChat.path)
  const routeChange = Saga.put(
    action.payload.routePath
      ? RouteTreeGen.createPutActionIfOnPath({
          expectedPath: action.payload.routePath,
          otherAction: RouteTreeGen.createNavigateAppend({path: ['sendLinkToChat']}),
        })
      : RouteTreeGen.createNavigateAppend({path: ['sendLinkToChat']})
  )
  if (elems.length < 3 || elems[1] === 'public') {
    // Not a TLF, or a public TLF; just show the modal and let user copy the path.
    yield routeChange
    return
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

  yield Saga.all(actions)
}

const clearRefreshTag = (state, action) => {
  folderListRefreshTags.delete(action.payload.refreshTag)
  mimeTypeRefreshTags.delete(action.payload.refreshTag)
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
  yield* Saga.chainAction<FsGen.FilePreviewLoadPayload>(FsGen.filePreviewLoad, filePreview)
  yield* Saga.chainAction<FsGen.FavoritesLoadPayload>(FsGen.favoritesLoad, loadFavorites)
  yield* Saga.chainGenerator<FsGen.FavoriteIgnorePayload>(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield* Saga.chainAction<FsGen.FavoritesLoadedPayload>(FsGen.favoritesLoaded, updateFsBadge)
  yield* Saga.chainGenerator<FsGen.MimeTypeLoadPayload>(FsGen.mimeTypeLoad, loadMimeType)
  yield* Saga.chainAction<FsGen.LetResetUserBackInPayload>(FsGen.letResetUserBackIn, letResetUserBackIn)
  yield* Saga.chainAction<FsGen.CommitEditPayload>(FsGen.commitEdit, commitEdit)
  yield* Saga.chainGenerator<FsGen.NotifySyncActivityPayload>(
    FsGen.notifySyncActivity,
    pollSyncStatusUntilDone
  )
  yield* Saga.chainAction<FsGen.NotifyTlfUpdatePayload>(FsGen.notifyTlfUpdate, onTlfUpdate)
  yield* Saga.chainAction<FsGen.DeleteFilePayload>(FsGen.deleteFile, deleteFile)
  yield* Saga.chainAction<FsGen.OpenPathItemPayload | FsGen.OpenPathInFilesTabPayload>(
    [FsGen.openPathItem, FsGen.openPathInFilesTab],
    openPathItem
  )
  yield* Saga.chainGenerator<FsGen.LoadPathMetadataPayload>(FsGen.loadPathMetadata, loadPathMetadata)
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
  yield* Saga.chainAction<FsGen.MovePayload | FsGen.CopyPayload>([FsGen.move, FsGen.copy], moveOrCopy)
  yield* Saga.chainAction<FsGen.MoveOrCopyOpenPayload>(FsGen.moveOrCopyOpen, moveOrCopyOpen)
  yield* Saga.chainAction<FsGen.ShowMoveOrCopyPayload>(FsGen.showMoveOrCopy, showMoveOrCopy)
  yield* Saga.chainAction<FsGen.CloseMoveOrCopyPayload>(FsGen.closeMoveOrCopy, closeMoveOrCopy)
  yield* Saga.chainGenerator<FsGen.ShowSendLinkToChatPayload>(FsGen.showSendLinkToChat, showSendLinkToChat)
  yield* Saga.chainAction<FsGen.ClearRefreshTagPayload>(FsGen.clearRefreshTag, clearRefreshTag)

  yield Saga.spawn(platformSpecificSaga)
}

export default fsSaga
