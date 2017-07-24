// @flow

import type {FSOpen, OpenInFileUI} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'

function* fuseStatusSaga(): SagaGenerator<any, any> {}

function* installFuseSaga(): SagaGenerator<any, any> {}

function* installKBFSSaga(): SagaGenerator<any, any> {}

function* openSaga(action: FSOpen): SagaGenerator<any, any> {}

function* openInFileUISaga(action: OpenInFileUI): SagaGenerator<any, any> {}

export {fuseStatusSaga, installFuseSaga, installKBFSSaga, openInFileUISaga, openSaga}
