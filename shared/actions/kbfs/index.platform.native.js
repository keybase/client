// @flow

import type {FSOpen, OpenInFileUI} from '../../constants/kbfs'
import type {SagaGenerator} from '../../constants/types/saga'

const openSaga = function*(action: FSOpen): SagaGenerator<any, any> {}

const openInFileUISaga = function*(action: OpenInFileUI): SagaGenerator<any, any> {}

export {openInFileUISaga, openSaga}
