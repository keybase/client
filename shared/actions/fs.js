// @flow
import * as Constants from '../constants/fs'
import * as FsGen from "./fs-gen"
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Types from '../constants/types/fs'
import * as Path from 'path'

const fsPathToRpcPath = (p : Types.Path) => p.substring('/keybase'.length)

function* folderList(action: FsGen.FolderListLoadPayload): SagaGenerator<any, any> {
  if (action.payload.path === '/keybase') {
    yield Saga.cancel()
    return
  }

  yield Saga.call(RPCTypes.SimpleFSSimpleFSListRpcPromise, {
    opID: action.payload.opID,
    path: {
      "PathType": 1,
      "kbfs": fsPathToRpcPath(action.payload.path),
    }
  })

  yield Saga.call(RPCTypes.SimpleFSSimpleFSWaitRpcPromise, {
    opID: action.payload.opID
  })

  const result = yield Saga.call(RPCTypes.SimpleFSSimpleFSReadListRpcPromise, {
    opID: action.payload.opID
  })

  const rootPath = action.payload.path
  const direntToPathAndPathItem = (d : FsGen.Dirent) => [
    Path.join(Types.pathToString(rootPath), d.name),
    d.direntType === 1 /* DIR_1 */ ? Constants.makeFolder() : Constants.makeFile()
  ]

  const pathItems : I.Map<Types.Path, Types.PathItem> = I.Map(
    result.entries.map(direntToPathAndPathItem).concat(
      [ [rootPath, Constants.makeFolder({
        children: I.List(result.entries.map((d) => d.name))
      })] ]
    ))
  yield Saga.put(FsGen.createFolderListLoaded({pathItems}))
}

function* fsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(FsGen.folderListLoad, folderList)
}

export default fsSaga
