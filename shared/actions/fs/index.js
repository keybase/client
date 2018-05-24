// @flow
import logger from '../../logger'
import * as Constants from '../../constants/fs'
import * as FsGen from '../fs-gen'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import engine from '../../engine'
import * as NotificationsGen from '../notifications-gen'
import * as Types from '../../constants/types/fs'
import {platformSpecificSaga, platformSpecificIntentEffect} from './platform-specific'
import {getMimeTypeFromURL} from '../platform-specific'
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
  name: d.name,
  lastModifiedTimestamp: d.time,
  lastWriter: d.lastWriterUnverified,
  size: d.size,
})

const makeEntry = (d: RPCTypes.Dirent) => {
  switch (d.direntType) {
    case RPCTypes.simpleFSDirentType.dir:
      return Constants.makeFolder(direntToMetadata(d))
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

function* folderList(action: FsGen.FolderListLoadPayload): Saga.SagaGenerator<any, any> {
  const opID = Constants.makeUUID()
  const rootPath = action.payload.path

  yield Saga.call(RPCTypes.SimpleFSSimpleFSListRpcPromise, {
    opID,
    path: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(rootPath),
    },
    filter: RPCTypes.simpleFSListFilter.filterAllHidden,
  })

  yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})

  const result = yield Saga.call(RPCTypes.SimpleFSSimpleFSReadListRpcPromise, {opID})
  const entries = result.entries || []

  const direntToPathAndPathItem = (d: RPCTypes.Dirent) => [Types.pathConcat(rootPath, d.name), makeEntry(d)]

  // Get metadata fields of the directory that we just loaded from state to
  // avoid overriding them.
  const state = yield Saga.select()
  const {lastModifiedTimestamp, lastWriter, size}: Types.PathItemMetadata = state.fs.pathItems.get(rootPath)

  const pathItems: I.Map<Types.Path, Types.PathItem> = I.Map(
    entries.map(direntToPathAndPathItem).concat([
      [
        rootPath,
        Constants.makeFolder({
          lastModifiedTimestamp,
          lastWriter,
          size,
          name: Types.getPathName(rootPath),
          children: I.Set(entries.map(d => d.name)),
          progress: 'loaded',
        }),
      ],
    ])
  )
  yield Saga.put(FsGen.createFolderListLoaded({pathItems, path: rootPath}))
}

function* monitorTransferProgress(key: string, opID: RPCTypes.OpID) {
  // This loop doesn't finish on its own, but it's in a Saga.race with
  // `SimpleFSWait`, so it's "canceled" when the other finishes.
  while (true) {
    yield Saga.delay(500)
    const progress = yield Saga.call(RPCTypes.SimpleFSSimpleFSCheckRpcPromise, {opID})
    if (progress.bytesTotal === 0) {
      continue
    }
    yield Saga.put(
      FsGen.createTransferProgress({
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

  yield Saga.put(FsGen.createDownloadStarted({key, path, localPath, intent, opID}))

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
      monitor: Saga.call(monitorTransferProgress, key, opID),
      wait: Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID}),
    })

    // No error, so the download has finished successfully. Set the
    // completePortion to 1.
    yield Saga.put(FsGen.createTransferProgress({key, completePortion: 1}))

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

function cancelTransfer({payload: {key}}: FsGen.CancelTransferPayload, state: TypedState) {
  const transfer = state.fs.transfers.get(key)
  if (!transfer) {
    console.log(`unknown transfer: ${key}`)
    return
  }
  const {
    meta: {opID},
  } = transfer
  return Saga.call(RPCTypes.SimpleFSSimpleFSCancelRpcPromise, {opID})
}

let polling = false
function* pollSyncStatusUntilDone(): Saga.SagaGenerator<any, any> {
  if (polling) {
    return
  }
  polling = true
  try {
    let status: RPCTypes.FSSyncStatus = yield Saga.call(RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise)
    if (status.totalSyncingBytes <= 0) {
      return
    }

    yield Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: true}))
    yield Saga.put(FsGen.createSetFlags({syncing: true}))

    while (status.totalSyncingBytes > 0) {
      yield Saga.delay(2000)
      status = yield Saga.call(RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise)
    }
  } finally {
    polling = false
    yield Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false}))
    yield Saga.put(FsGen.createSetFlags({syncing: false}))
  }
}

function _setupFSHandlers() {
  engine().setIncomingActionCreators('keybase.1.NotifyFS.FSSyncActivity', () => [FsGen.createFsActivity()])
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

const getMimeTypePromise = (path: Types.Path, serverInfo: Types._LocalHTTPServer) =>
  new Promise((resolve, reject) =>
    getMimeTypeFromURL(Constants.generateFileURL(path, serverInfo), ({error, statusCode, mimeType}) => {
      if (error) {
        reject(error)
        return
      }
      switch (statusCode) {
        case 200:
          resolve(mimeType)
          return
        case 403:
          reject(Constants.invalidTokenError)
          return
        default:
          reject(new Error(`unexpected HTTP status code: ${statusCode}`))
          return
      }
    })
  )

// _loadMimeType uses HEAD request to load mime type from the KBFS HTTP server.
// If the server address/token are not populated yet, or if the token turns out
// to be invalid, it automatically calls refreshLocalHTTPServerInfo to refresh
// that. The generator function returns the loaded mime type for the given
// path, and in addition triggers a mimeTypeLoaded so the loaded mime type for
// given path is populated in the store.
function* _loadMimeType(path: Types.Path) {
  const state = yield Saga.select()
  let {address, token} = state.fs.localHTTPServerInfo || Constants.makeLocalHTTPServer()
  while (true) {
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
}

const loadMimeType = (action: FsGen.MimeTypeLoadPayload) => Saga.call(_loadMimeType, action.payload.path)

function* fileActionPopup(action: FsGen.FileActionPopupPayload): Saga.SagaGenerator<any, any> {
  const {path, type, targetRect, routePath} = action.payload
  // We may not have the folder loaded yet, but will need metadata to know
  // folder entry types in the popup. So dispatch an action now to load it.
  type === 'folder' && (yield Saga.put(FsGen.createFolderListLoad({path})))
  yield Saga.put(
    putActionIfOnPath(
      routePath,
      navigateAppend([
        {
          props: {
            path,
            position: 'bottom right',
            isShare: false,
            targetRect,
          },
          selected: 'pathItemAction',
        },
      ])
    )
  )
}

function* openPathItem(action: FsGen.OpenPathItemPayload): Saga.SagaGenerator<any, any> {
  const {path, routePath} = action.payload
  const state: TypedState = yield Saga.select()
  const pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
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
    bare = isMobile && 'image' === Constants.viewTypeFromMimeType(mimeType)
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

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(
    FsGen.refreshLocalHTTPServerInfo,
    refreshLocalHTTPServerInfo,
    refreshLocalHTTPServerInfoResult
  )
  yield Saga.safeTakeEveryPure(FsGen.cancelTransfer, cancelTransfer)
  yield Saga.safeTakeEvery(FsGen.download, download)
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
  yield Saga.safeTakeEvery(FsGen.filePreviewLoad, filePreview)
  yield Saga.safeTakeEvery(FsGen.favoritesLoad, listFavoritesSaga)
  yield Saga.safeTakeEvery(FsGen.favoriteIgnore, ignoreFavoriteSaga)
  yield Saga.safeTakeEveryPure(FsGen.mimeTypeLoad, loadMimeType)

  if (!isMobile) {
    // TODO: enable these when we need it on mobile.
    yield Saga.safeTakeEvery(FsGen.fsActivity, pollSyncStatusUntilDone)
    yield Saga.safeTakeEveryPure(FsGen.setupFSHandlers, _setupFSHandlers)
  }

  yield Saga.fork(platformSpecificSaga)

  // These are saga tasks that may use actions above.
  yield Saga.safeTakeEvery(FsGen.fileActionPopup, fileActionPopup)
  yield Saga.safeTakeEvery(FsGen.openPathItem, openPathItem)
}

export default fsSaga
