// @flow
import * as FsGen from './fs-gen'
import * as Saga from '../util/saga'
import type {TypedState} from '../constants/reducer'

export function openInFileUISaga(payload: FsGen.OpenInFileUIPayload, state: TypedState) {}
export function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {}
export function* fuseStatusUpdateSaga(): Saga.SagaGenerator<any, any> {}
