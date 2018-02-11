// @flow
import * as Constants from '../constants/fs'
import * as FsGen from './fs-gen'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Types from '../constants/types/fs'
import * as FsPath from '../constants/fs-path'

function* folderList(action: FsGen.FolderListLoadPayload): Saga.SagaGenerator<any, any> {
  if (action.payload.path === '/keybase') {
    yield Saga.cancel()
    return
  }

  const opID = Constants.makeUUID()
  const rootPath = action.payload.path

  yield Saga.call(RPCTypes.SimpleFSSimpleFSListRpcPromise, {
    opID,
    path: {
      PathType: 1,
      kbfs: Constants.fsPathToRpcPathString(rootPath),
    },
  })

  yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {opID})

  const result = yield Saga.call(RPCTypes.SimpleFSSimpleFSReadListRpcPromise, {opID})

  const direntToPathAndPathItem = (d: RPCTypes.Dirent) => [
    FsPath.join(Types.pathToString(rootPath), d.name),
    d.direntType === RPCTypes.simpleFSDirentType.dir ? Constants.makeFolder() : Constants.makeFile(),
  ]

  const pathItems: I.Map<Types.Path, Types.PathItem> = I.Map(
    result.entries.map(direntToPathAndPathItem).concat([
      [
        rootPath,
        Constants.makeFolder({
          children: I.List(result.entries.map(d => d.name)),
          progress: 'loaded',
        }),
      ],
    ])
  )
  yield Saga.put(FsGen.createFolderListLoaded({pathItems}))
}

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
}

export default fsSaga
