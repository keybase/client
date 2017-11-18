// @flow
import * as KBFSGen from '../kbfs-gen'
import * as Platform from './index.platform'
import * as Saga from '../../util/saga'
import * as RPCTypes from '../../constants/types/flow-types'
import {isWindows} from '../../constants/platform'

function* _listSaga(action: KBFSGen.ListPayload): Saga.SagaGenerator<any, any> {
  try {
    const result: ?RPCTypes.ListResult = yield Saga.call(RPCTypes.fsListRpcPromise, {
      param: {path: action.payload.path},
    })

    if (result) {
      console.log('fs.List: ', result)
      yield Saga.put(KBFSGen.createListed({result}))
    }
  } catch (error) {
    yield Saga.put(KBFSGen.createListedError({error}))
  }
}

function* kbfsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(KBFSGen.list, _listSaga)
  yield Saga.safeTakeEvery(KBFSGen.open, Platform.openSaga)
  yield Saga.safeTakeEvery(KBFSGen.openInFileUI, Platform.openInFileUISaga)
  yield Saga.safeTakeLatest(KBFSGen.fuseStatus, Platform.fuseStatusSaga)
  yield Saga.safeTakeLatest(KBFSGen.fuseStatusUpdate, Platform.fuseStatusUpdateSaga)
  yield Saga.safeTakeLatest(KBFSGen.installFuse, Platform.installFuseSaga)
  if (isWindows) {
    yield Saga.safeTakeLatest(KBFSGen.installFuse, Platform.installDokanSaga)
  } else {
    yield Saga.safeTakeLatest(KBFSGen.installFuse, Platform.installFuseSaga)
  }
  yield Saga.safeTakeLatest(KBFSGen.installKBFS, Platform.installKBFSSaga)
  yield Saga.safeTakeLatest(KBFSGen.uninstallKBFS, Platform.uninstallKBFSSaga)
}

export default kbfsSaga
