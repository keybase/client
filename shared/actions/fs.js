// @flow
import logger from '../logger'
import * as Constants from '../constants/fs'
import * as FsGen from './fs-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import engine from '../engine'
import * as NotificationsGen from './notifications-gen'
import * as Types from '../constants/types/fs'
import {
  openInFileUISaga,
  fuseStatusSaga,
  fuseStatusResultSaga,
  installKBFS,
  installKBFSSuccess,
  installFuseSaga,
  installDokanSaga,
  uninstallKBFSConfirmSaga,
  uninstallKBFS,
  uninstallKBFSSuccess,
} from './fs-platform-specific'
import {isWindows} from '../constants/platform'
import {saveAttachmentDialog, showShareActionSheet} from './platform-specific'
import {type TypedState} from '../util/container'

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

function* filePreview(action: FsGen.FilePreviewLoadPayload): Saga.SagaGenerator<any, any> {
  const rootPath = action.payload.path

  const dirent = yield Saga.call(RPCTypes.SimpleFSSimpleFSStatRpcPromise, {
    path: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(rootPath),
    },
  })

  const meta = Constants.makeFile({
    name: Types.getPathName(rootPath),
    lastModifiedTimestamp: dirent.time,
    size: dirent.size,
    progress: 'loaded',
    lastWriter: dirent.lastWriterUnverified,
  })
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

  const direntToMetadata = (d: RPCTypes.Dirent) => ({
    name: d.name,
    lastModifiedTimestamp: d.time,
    lastWriter: d.lastWriterUnverified,
    size: d.size,
  })

  const direntToPathAndPathItem = (d: RPCTypes.Dirent) => [
    Types.pathConcat(rootPath, d.name),
    d.direntType === RPCTypes.simpleFSDirentType.dir
      ? Constants.makeFolder(direntToMetadata(d))
      : Constants.makeFile(direntToMetadata(d)),
  ]

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
      default:
        // eslint-disable-next-line no-unused-expressions
        ;(intent: empty) // this breaks when a new intent is added but not handled here
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

    // If this is for anyting other than a simple download, kick that off now
    // that the file is available locally.
    switch (intent) {
      case 'none':
        break
      case 'camera-roll':
        yield Saga.call(saveAttachmentDialog, localPath)
        break
      case 'share':
        yield Saga.call(showShareActionSheet, {url: localPath})
        break
      default:
        // eslint-disable-next-line no-unused-expressions
        ;(intent: empty) // this breaks when a new intent is added but not handled here
        break
    }
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
  const {meta: {opID}} = transfer
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
    let _kbfsUploading = false // Don't send duplicates else we get high cpu usage.
    while (status.totalSyncingBytes > 0) {
      if (!_kbfsUploading) {
        _kbfsUploading = true
        yield Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: true}))
        yield Saga.put(FsGen.createSyncingStatus({isSyncing: true}))
      }
      yield Saga.delay(2000)
      status = yield Saga.call(RPCTypes.SimpleFSSimpleFSSyncStatusRpcPromise)
    }
    if (_kbfsUploading) {
      yield Saga.put(NotificationsGen.createBadgeApp({key: 'kbfsUploading', on: false}))
      yield Saga.put(FsGen.createSyncingStatus({isSyncing: false}))
    }
  } finally {
    polling = false
  }
}

function _setupFSHandlers() {
  console.log('SONGGAO-setupfshandler')
  return Saga.put((dispatch: Dispatch) => {
    engine().setIncomingHandler('keybase.1.NotifyFS.FSSyncActivity', ({status}) => {
      dispatch(FsGen.createFsActivity())
    })
  })
}

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(FsGen.cancelTransfer, cancelTransfer)
  yield Saga.safeTakeEvery(FsGen.download, download)
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
  yield Saga.safeTakeEvery(FsGen.filePreviewLoad, filePreview)
  yield Saga.safeTakeEvery(FsGen.favoritesLoad, listFavoritesSaga)
  yield Saga.safeTakeEveryPure(FsGen.openInFileUI, openInFileUISaga)
  yield Saga.safeTakeEvery(FsGen.fuseStatus, fuseStatusSaga)
  yield Saga.safeTakeEveryPure(FsGen.fuseStatusResult, fuseStatusResultSaga)
  if (isWindows) {
    yield Saga.safeTakeEveryPure(FsGen.installFuse, installDokanSaga)
  } else {
    yield Saga.safeTakeEvery(FsGen.installFuse, installFuseSaga)
  }
  yield Saga.safeTakeEveryPure(FsGen.installKBFS, installKBFS, installKBFSSuccess)
  yield Saga.safeTakeEveryPure(FsGen.uninstallKBFSConfirm, uninstallKBFSConfirmSaga)
  yield Saga.safeTakeEveryPure(FsGen.uninstallKBFS, uninstallKBFS, uninstallKBFSSuccess)
  yield Saga.safeTakeEvery(FsGen.fsActivity, pollSyncStatusUntilDone)

  yield Saga.safeTakeEveryPure(FsGen.setupFSHandlers, _setupFSHandlers)
}

export default fsSaga
