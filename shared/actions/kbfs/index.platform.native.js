// @flow

import type {FSOpen, OpenInFileUI} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'

function* fuseStatusSaga(): SagaGenerator<any, any> {}

function* fuseStatusUpdateSaga(): SagaGenerator<any, any> {}

function* installFuseSaga(): SagaGenerator<any, any> {}

function* installDokanSaga(): SagaGenerator<any, any> {}

function* installKBFSSaga(): SagaGenerator<any, any> {}

function* openSaga(action: FSOpen): SagaGenerator<any, any> {}

const openInFileUISaga = function*(action: OpenInFileUI): SagaGenerator<any, any> {}

export {
  fuseStatusSaga,
  fuseStatusUpdateSaga,
  installFuseSaga,
  installKBFSSaga,
  installDokanSaga,
  openInFileUISaga,
  openSaga,
}
