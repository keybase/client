// @flow
import * as Saga from '../../util/saga'
import * as KBFSGen from '../kbfs-gen'

function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {}
function* fuseStatusUpdateSaga(): Saga.SagaGenerator<any, any> {}
function* installFuseSaga(): Saga.SagaGenerator<any, any> {}
function* installDokanSaga(): Saga.SagaGenerator<any, any> {}
function* installKBFSSaga(): Saga.SagaGenerator<any, any> {}
function* openSaga(action: KBFSGen.OpenPayload): Saga.SagaGenerator<any, any> {}
function* openInFileUISaga(action: KBFSGen.OpenInFileUIPayload): Saga.SagaGenerator<any, any> {}
function* uninstallKBFSSaga(): Saga.SagaGenerator<any, any> {}

export {
  fuseStatusSaga,
  fuseStatusUpdateSaga,
  installFuseSaga,
  installKBFSSaga,
  installDokanSaga,
  openInFileUISaga,
  openSaga,
  uninstallKBFSSaga,
}
