// @flow

import type {FSOpen, OpenInFileUI} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'

const fuseStatusSaga = function*(): SagaGenerator<any, any> {}

const fuseStatusUpdateSaga = function*(): SagaGenerator<any, any> {}

const installFuseSaga = function*(): SagaGenerator<any, any> {}

const installDokanSaga = function*(): SagaGenerator<any, any> {}

const installKBFSSaga = function*(): SagaGenerator<any, any> {}

const openSaga = function*(action: FSOpen): SagaGenerator<any, any> {}

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
