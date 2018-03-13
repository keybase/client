// @flow
import * as FsGen from './fs-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import type {TypedState} from '../constants/reducer'

export function openInFileUISaga(payload: FsGen.OpenInFileUIPayload, state: TypedState) {}
export function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {}
export function fuseStatusResultSaga() {}
export function* installFuseSaga(): Saga.SagaGenerator<any, any> {}
export function installDokanSaga() {}
export function* installKBFSSaga(): Saga.SagaGenerator<any, any> {}
export function uninstallKBFSSaga() {}
export function uninstallKBFSSagaSuccess(result: RPCTypes.UninstallResult) {}
