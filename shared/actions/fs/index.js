// @flow
import logger from '../../logger'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'
import * as LoginGen from '../login-gen'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import engine from '../../engine'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import flags from '../../util/feature-flags'
import {platformSpecificSaga, platformSpecificIntentEffect} from './platform-specific'
import {getContentTypeFromURL} from '../platform-specific'
import {isMobile} from '../../constants/platform'
import {type TypedState} from '../../util/container'
import {putActionIfOnPath, navigateAppend} from '../route-tree'

function* listFavoritesSaga(): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  try {
    const results = yield Saga.call(RPCTypes.apiserverGetWithSessionRpcPromise, {
      args: [{key: 'problems', value: '1'}],
      endpoint: 'kbfs/favorite/list',
    })
    const username = state.config.username || ''
    const loggedIn = state.config.loggedIn
    const folders = Constants.folderToFavoriteItems(results && results.body, username, loggedIn)

    yield Saga.put(FsGen.createFavoritesLoaded({folders}))
  } catch (e) {
    logger.warn('Error listing favorites:', e)
  }
}

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
      })
    case RPCTypes.simpleFSDirentType.sym:
      return Constants.makeSymlink({
        ...direntToMetadata(d),
        progress: 'loaded',
        // TODO: plumb link target
      })
    case RPCTypes.simpleFSDirentType.file:
    case RPCTypes.simpleFSDirentType.exec:
      return Constants.makeFile({
        ...direntToMetadata(d),
        progress: 'loaded',
      })
    default:
      return Constants.makeUnknownPathItem({
        ...direntToMetadata(d),
        progress: 'loaded',
      })
  }
}

function* filePreview(action: FsGen.FilePreviewLoadPayload): Saga.SagaGenerator<any, any> {
  const rootPath = action.payload.path

  const dirent = yield Saga.call(RPCTypes.SimpleFSSimpleFSStatRpcPromise, {
    path: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(rootPath),
    },
  })

  const meta = makeEntry(dirent)
  yield Saga.put(FsGen.createFilePreviewLoaded({meta, path: rootPath}))
}

// See constants/types/fs.js on what this is for.
// We intentionally keep this here rather than in the redux store.
const folderListRefreshTags: Map<Types.RefreshTag, Types.Path> = new Map()
const mimeTypeRefreshTags: Map<Types.RefreshTag, Types.Path> = new Map()

function* folderList(action: FsGen.FolderListLoadPayload): Saga.SagaGenerator<any, any> {
  const opID = Constants.makeUUID()
  const {refreshTag, path: rootPath} = action.payload

  refreshTag && folderListRefreshTags.set(refreshTag, rootPath)

  const pathElems = Types.getPathElements(rootPath)
  if (pathElems.length < 3) {
    yield Saga.call(RPCTypes.SimpleFSSimpleFSListRpcPromise, {
      opID,
      path: {
        PathType: RPCTypes.simpleFSPathType.kbfs,
        kbfs: Constants.fsPathToRpcPathString(rootPath),
      },
      filter: RPCTypes.simpleFSListFilter.filterAllHidden,
      refreshSubscription: false,
    })
  } else {
    yield Saga.call(RPCTypes.SimpleFSSimpleFSListRecursiveToDepthRpcPromise, {
      opID,
      path: {
        PathType: RPCTypes.simpleFSPathType.kbfs,
        kbfs: Constants.fsPathToRpcPathString(rootPath),
      },
      filter: RPCTypes.simpleFSListFilter.filterAllHidden,
      refreshSubscription: false,
      depth: 1,
    })
  }

  yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})

  const result = yield Saga.call(RPCTypes.SimpleFSSimpleFSReadListRpcPromise, {opID})
  const entries = pathElems.length === 3
    ? result.entries || []
    : (result.entries || []: Array<RPCTypes.Dirent>).map((d: RPCTypes.Dirent): RPCTypes.Dirent => ({
      ...d,
      name: d.name.substring(d.name.indexOf('/') + 1),
    }))
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
    return [path, makeEntry(d, childMap.get(path))]
  }

  // Get metadata fields of the directory that we just loaded from state to
  // avoid overriding them.
  const state = yield Saga.select()
  const {lastModifiedTimestamp, lastWriter, size, writable, favoriteChildren, tlfMeta}: Types.FolderPathItem = state.fs.pathItems.get(
    rootPath
  )

  const pathItems = [
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
        tlfMeta,
        favoriteChildren,
      }),
    ],
    ...entries.map(direntToPathAndPathItem),
  ]
  yield Saga.put(FsGen.createFolderListLoaded({pathItems: I.Map(pathItems), path: rootPath}))
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

function* download(action: FsGen.DownloadPayload): Saga.SagaGenerator<any, any> {
  const {path, intent} = action.payload
  const opID = Constants.makeUUID()

  // Figure out the local path we are downloading into.
  let localPath = action.payload.localPath
  if (!localPath) {
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
  }

  const key = Constants.makeDownloadKey(path, localPath)

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

    // Kick off any post-download actions, now that the file is available locally.
    const intentEffect = platformSpecificIntentEffect(intent, localPath, mimeType)
    intentEffect && (yield intentEffect)
  } catch (error) {
    console.log(`Download for intent[${intent}] error: ${error}`)
    yield Saga.put(FsGen.createDownloadFinished({key, error}))
    return
  }

  yield Saga.put(FsGen.createDownloadFinished({key}))
}

function* upload(action: FsGen.UploadPayload) {
  const {parentPath, localPath} = action.payload
  const opID = Constants.makeUUID()
  const name = Types.getLocalPathName(localPath)
  const path = Types.pathConcat(parentPath, name)

  yield Saga.put(FsGen.createUploadStarted({path}))

  // TODO: confirm overwrites?
  // TODO: what about directory merges?
  yield Saga.call(RPCTypes.SimpleFSSimpleFSCopyRecursiveRpcPromise, {
    opID,
    src: {
      PathType: RPCTypes.simpleFSPathType.local,
      local: localPath,
    },
    dest: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(path),
    },
  })

  try {
    yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})
    yield Saga.put(FsGen.createUploadWritingFinished({path}))
  } catch (error) {
    console.log(`Upload error: ${error}`)
    yield Saga.put(FsGen.createUploadWritingFinished({path, error}))
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
function* pollSyncStatusUntilDone(): Saga.SagaGenerator<any, any> {
  if (polling) {
    return
  }
  polling = true
  try {
    while (1) {
      yield Saga.call(RPCTypes.SimpleFSSimpleFSSuppressNotificationsRpcPromise, {
        suppressDurationSec: 8,
      })
      let {syncingPaths, totalSyncingBytes, endEstimate}: RPCTypes.FSSyncStatus = yield Saga.call(
        RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise
      )
      yield Saga.sequentially([
        Saga.put(
          FsGen.createJournalUpdate({
            syncingPaths: (syncingPaths || []).map(Types.stringToPath),
            totalSyncingBytes,
            endEstimate,
          })
        ),

        // Trigger folderListLoad and mimeTypeLoad for paths that user might be
        // looking at. Note that we are not checking the syncingPaths here,
        // because we are polling and things can slip through between
        // SimpleFSSyncStatus calls. So instead just always re-load them on the
        // same interval we are polling on journal status.
        ...Array.from(folderListRefreshTags).map(([_, path]) => Saga.put(FsGen.createFolderListLoad({path}))),
        ...Array.from(mimeTypeRefreshTags).map(([_, path]) => Saga.put(FsGen.createMimeTypeLoad({path}))),
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
  } finally {
    polling = false
    yield Saga.sequentially([
      Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false})),
      Saga.put(FsGen.createSetFlags({syncing: false})),
    ])
  }
}

function _setupFSHandlers() {
  engine().setIncomingActionCreators('keybase.1.NotifyFS.FSSyncActivity', () => [FsGen.createFsActivity()])
  engine().setIncomingActionCreators('keybase.1.NotifyFS.FSActivity', () => [FsGen.createFsActivity()])
}

function refreshLocalHTTPServerInfo() {
  return Saga.call(RPCTypes.SimpleFSSimpleFSGetHTTPAddressAndTokenRpcPromise)
}

function refreshLocalHTTPServerInfoResult({address, token}: RPCTypes.SimpleFSGetHTTPAddressAndTokenResponse) {
  return Saga.put(FsGen.createLocalHTTPServerInfo({address, token}))
}

function* ignoreFavoriteSaga(action: FsGen.FavoriteIgnorePayload): Saga.SagaGenerator<any, any> {
  const folder = Constants.folderRPCFromPath(action.payload.path)
  if (!folder) {
    yield Saga.put(
      FsGen.createFavoriteIgnoreError({
        path: action.payload.path,
        errorText: 'No folder specified',
      })
    )
  } else {
    try {
      yield Saga.call(RPCTypes.favoriteFavoriteIgnoreRpcPromise, {
        folder,
      })
    } catch (error) {
      logger.warn('Err in favorite.favoriteAddOrIgnore', error)
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

const getMimeTypePromise = (path: Types.Path, serverInfo: Types._LocalHTTPServer) =>
  new Promise((resolve, reject) =>
    getContentTypeFromURL(Constants.generateFileURL(path, serverInfo), ({error, statusCode, contentType}) => {
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
        default:
          reject(new Error(`unexpected HTTP status code: ${statusCode || ''}`))
      }
    })
  )

// _loadMimeType uses HEAD request to load mime type from the KBFS HTTP server.
// If the server address/token are not populated yet, or if the token turns out
// to be invalid, it automatically calls refreshLocalHTTPServerInfo to refresh
// that. The generator function returns the loaded mime type for the given
// path, and in addition triggers a mimeTypeLoaded so the loaded mime type for
// given path is populated in the store.
function* _loadMimeType(path: Types.Path, refreshTag?: Types.RefreshTag) {
  refreshTag && mimeTypeRefreshTags.set(refreshTag, path)

  const state = yield Saga.select()
  let {address, token} = state.fs.localHTTPServerInfo || Constants.makeLocalHTTPServer()
  // This should finish within 2 iterations most. But just in case we bound it
  // at 4.
  for (let i = 0; i < 4; ++i) {
    if (address === '' || token === '') {
      ;({address, token} = yield refreshLocalHTTPServerInfo())
      yield refreshLocalHTTPServerInfoResult({address, token})
    }
    try {
      const mimeType = yield Saga.call(getMimeTypePromise, path, {address, token})
      yield Saga.put(FsGen.createMimeTypeLoaded({path, mimeType}))
      return mimeType
    } catch (err) {
      if (err !== Constants.invalidTokenError) {
        throw err
      }
      token = '' // Set token to '' to trigger the refresh in next iteration.
    }
  }
  throw new Error('failed to load mime type')
}

const loadMimeType = (action: FsGen.MimeTypeLoadPayload) =>
  Saga.call(_loadMimeType, action.payload.path, action.payload.refreshTag)

const commitEdit = (action: FsGen.CommitEditPayload, state: TypedState) => {
  const {editID} = action.payload
  const edit = state.fs.edits.get(editID)
  if (!edit) {
    return null
  }
  const {parentPath, name, type} = edit
  switch (type) {
    case 'new-folder':
      return Saga.call(RPCTypes.SimpleFSSimpleFSOpenRpcPromise, {
        opID: Constants.makeUUID(),
        dest: {
          PathType: RPCTypes.simpleFSPathType.kbfs,
          kbfs: Constants.fsPathToRpcPathString(Types.pathConcat(parentPath, name)),
        },
        flags: RPCTypes.simpleFSOpenFlags.directory,
      })
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(type);
      */
      return null
  }
}

const editSuccess = (res, action, state: TypedState) => {
  const {editID} = action.payload
  const edit = state.fs.edits.get(editID)
  if (!edit) {
    return null
  }
  const {parentPath, type} = edit
  const effects = [Saga.put(FsGen.createEditSuccess({editID}))]

  switch (type) {
    case 'new-folder':
      effects.push(Saga.put(FsGen.createFolderListLoad({path: parentPath})))
      break
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(type);
      */
      break
  }

  return Saga.sequentially(effects)
}

const editFailed = (res, {payload: {editID}}) => Saga.put(FsGen.createEditFailed({editID}))

function* openPathItem(action: FsGen.OpenPathItemPayload): Saga.SagaGenerator<any, any> {
  const {path, routePath} = action.payload
  const state: TypedState = yield Saga.select()
  const pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  if (pathItem.type === 'folder') {
    yield Saga.put(
      putActionIfOnPath(
        routePath,
        navigateAppend([
          {
            props: {path},
            selected: 'folder',
          },
        ])
      )
    )
    return
  }

  let bare = false
  if (pathItem.type === 'file') {
    let mimeType = pathItem.mimeType
    if (mimeType === '') {
      mimeType = yield Saga.call(_loadMimeType, path)
    }
    bare = isMobile && Constants.viewTypeFromMimeType(mimeType) === 'image'
  }

  yield Saga.put(
    putActionIfOnPath(
      routePath,
      navigateAppend([
        {
          props: {path},
          selected: bare ? 'barePreview' : 'preview',
        },
      ])
    )
  )
}

const letResetUserBackIn = ({payload: {id, username}}: FsGen.LetResetUserBackInPayload) =>
  Saga.call(RPCTypes.teamsTeamReAddMemberAfterResetRpcPromise, {id, username})

const letResetUserBackInResult = () => undefined // Saga.put(FsGen.createLoadResets())

const resetStore = () => Saga.put({type: FsGen.resetStore})

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPureSimple(LoginGen.logout, resetStore)
  yield Saga.safeTakeEveryPure(
    FsGen.refreshLocalHTTPServerInfo,
    refreshLocalHTTPServerInfo,
    refreshLocalHTTPServerInfoResult
  )
  yield Saga.safeTakeEveryPure(FsGen.cancelDownload, cancelDownload)
  yield Saga.safeTakeEvery(FsGen.download, download)
  yield Saga.safeTakeEvery(FsGen.upload, upload)
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
  yield Saga.safeTakeEvery(FsGen.filePreviewLoad, filePreview)
  yield Saga.safeTakeEvery(FsGen.favoritesLoad, listFavoritesSaga)
  yield Saga.safeTakeEvery(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield Saga.safeTakeEveryPure(FsGen.mimeTypeLoad, loadMimeType)
  yield Saga.safeTakeEveryPure(FsGen.letResetUserBackIn, letResetUserBackIn, letResetUserBackInResult)
  if (flags.fsWritesEnabled) {
    yield Saga.safeTakeEveryPure(FsGen.commitEdit, commitEdit, editSuccess, editFailed)
  }

  yield Saga.safeTakeEvery(FsGen.fsActivity, pollSyncStatusUntilDone)
  yield Saga.safeTakeEveryPure(FsGen.setupFSHandlers, _setupFSHandlers)

  yield Saga.fork(platformSpecificSaga)

  // These are saga tasks that may use actions above.
  yield Saga.safeTakeEvery(FsGen.openPathItem, openPathItem)
}

export default fsSaga
