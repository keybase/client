// @flow
import logger from '../logger'
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
import {type TypedState} from '../util/container'

const _jsonToFolders = (json: Object, myKID: any): Array<Types.FolderRPCWithMeta> => {
  const folderSets = [json.favorites, json.ignored, json.new]
  const fillFolder = folder => {
    folder.waitingForParticipantUnlock = []
    folder.youCanUnlock = []

    if (!folder.problem_set) {
      return
    }

    const solutions = folder.problem_set.solution_kids || {}
    if (Object.keys(solutions).length) {
      folder.meta = 'rekey'
    }

    if (folder.problem_set.can_self_help) {
      const mySolutions = solutions[myKID] || []
      folder.youCanUnlock = mySolutions.map(kid => {
        const device = json.devices[kid]
        return {...device, deviceID: kid}
      })
    } else {
      folder.waitingForParticipantUnlock = Object.keys(solutions).map(userID => {
        const devices = solutions[userID].map(kid => json.devices[kid].name)
        const numDevices = devices.length
        const last = numDevices > 1 ? devices.pop() : null

        return {
          name: json.users[userID],
          devices: `Tell them to turn on${numDevices > 1 ? ':' : ' '} ${devices.join(', ')}${
            last ? ` or ${last}` : ''
          }.`,
        }
      })
    }
  }

  folderSets.forEach(folders => folders.forEach(fillFolder))
  return flatten(folderSets)
}

// TODO: unexport once it's used.
// TODO: hook up PathItems
export function _getFavoritesRPCToFiles(
  txt: string,
  username: string = '',
  loggedIn: boolean
): Array<Types.FolderRPCWithMeta> {
  let json
  try {
    json = JSON.parse(txt)
  } catch (err) {
    logger.warn('Invalid json from getFavorites: ', err)
    return []
  }

  const myKID = findKey(json.users, name => name === username)

  // inject our meta tag
  json.favorites && json.favorites.forEach(injectMeta(null))
  json.ignored && json.ignored.forEach(injectMeta('ignored'))
  json.new && json.new.forEach(injectMeta('new'))

  // figure out who can solve the rekey
  const folders: Array<FolderRPCWithMeta> = _jsonToFolders(json, myKID)

  // Ensure private/public folders exist for us
  if (username && loggedIn) {
    ;[true, false].forEach(isPrivate => {
      const idx = folders.findIndex(f => f.name === username && f.private === isPrivate)
      let toAdd = {
        meta: null,
        name: username,
        private: isPrivate,
        notificationsOn: false,
        created: false,
        waitingForParticipantUnlock: [],
        youCanUnlock: [],
        folderType: isPrivate ? RPCTypes.favoriteFolderType.private : RPCTypes.favoriteFolderType.public,
      }

      if (idx !== -1) {
        toAdd = folders[idx]
        folders.splice(idx, 1)
      }

      folders.unshift(toAdd)
    })
  }

  return folders
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

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(FsGen.cancelTransfer, cancelTransfer)
  yield Saga.safeTakeEvery(FsGen.download, download)
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
  yield Saga.safeTakeEvery(FsGen.filePreviewLoad, filePreview)
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
