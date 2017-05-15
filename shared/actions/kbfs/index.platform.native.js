// @flow

import type {FSOpen, OpenInFileUI} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'

function* openSaga(action: FSOpen): SagaGenerator<any, any> {}

function* openInFileUISaga(action: OpenInFileUI): SagaGenerator<any, any> {}

export {openInFileUISaga, openSaga}
