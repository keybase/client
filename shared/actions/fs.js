// @flow
import * as Constants from '../constants/fs'
import * as FsGen from './fs-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
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
    // FIXME currently lastWriter is not provided by simplefs.
    // the GUI supports it when added here.
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
  // avoid override them.
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
          children: I.List(entries.map(d => d.name)),
          progress: 'loaded',
        }),
      ],
    ])
  )
  yield Saga.put(FsGen.createFolderListLoaded({pathItems, path: rootPath}))
}

function* download(action: FsGen.DownloadPayload): Saga.SagaGenerator<any, any> {
  const {path, intent} = action.payload
  const opID = Constants.makeUUID()
  let localPath = action.payload.localPath
  if (!localPath) {
    switch (intent) {
      case 'none':
        localPath = yield Saga.call(Constants.downloadFilePathFromPath, path)
        break
      case 'camera-roll':
      case 'share':
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

  yield Saga.put(FsGen.createDownloadStarted({key, path, localPath, intent}))

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

  let progress
  do {
    yield Saga.delay(500)
    progress = yield Saga.call(RPCTypes.SimpleFSSimpleFSCheckRpcPromise, {opID})
    yield Saga.put(
      FsGen.createFileTransferProgress({
        key,
        endEstimate: progress.endEstimate,
        completePortion: progress.bytesWritten / progress.bytesTotal,
      })
    )
  } while (progress.bytesWritten < progress.bytesTotal)

  let error
  try {
    yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})
  } catch (err) {
    error = err
  }
  yield Saga.put(FsGen.createFileTransferProgress({key, completePortion: 1}))

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

  yield Saga.put(FsGen.createDownloadFinished({key, error}))
}

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
  yield Saga.safeTakeEvery(FsGen.filePreviewLoad, filePreview)
  yield Saga.safeTakeEvery(FsGen.download, download)
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
}

export default fsSaga
