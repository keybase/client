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

function* folderList(action: FsGen.FolderListLoadPayload): Saga.SagaGenerator<any, any> {
  const opID = Constants.makeUUID()
  const rootPath = action.payload.path

  yield Saga.call(RPCTypes.SimpleFSSimpleFSListRpcPromise, {
    opID,
    path: {
      PathType: RPCTypes.simpleFSPathType.kbfs,
      kbfs: Constants.fsPathToRpcPathString(rootPath),
    },
  })

  yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})

  const result = yield Saga.call(RPCTypes.SimpleFSSimpleFSReadListRpcPromise, {opID})
  const entries = result.entries || []

  const direntToMetadata = (d: RPCTypes.Dirent) => ({
    name: d.name,
    lastModifiedTimestamp: d.time,
    lastWriter: 'jareddunn' + (d.name.length < 10 ? '' : 'andfriendsandfriends'), // TODO fix this when we have it from RPC
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
  const {path} = action.payload
  const opID = Constants.makeUUID()
  let localPath = action.payload.localPath
  if (!localPath) {
    localPath = yield Saga.call(Constants.downloadFilePathFromPath, path)
  }
  const key = Constants.makeDownloadKey(path, localPath)

  yield Saga.put(FsGen.createDownloadStarted({key, path, localPath}))

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

  // Fake out progress until we have the real thing.
  // TODO: have the real thing.
  const total = 6
  for (let progress = 0; progress < total - 1; ++progress) {
    yield Saga.delay(500)
    yield Saga.call(RPCTypes.SimpleFSSimpleFSCheckRpcPromise, {opID})
    yield Saga.put(FsGen.createFileTransferProgress({key, completePortion: progress / total}))
  }

  let error
  try {
    yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})
  } catch (err) {
    error = err
  }
  yield Saga.put(FsGen.createFileTransferProgress({key, completePortion: 1}))
  yield Saga.put(FsGen.createDownloadFinished({key, error}))
}

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
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
