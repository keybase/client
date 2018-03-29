// @flow
import * as Saga from '../util/saga'
import * as AppGen from './app-gen'
import {showMainWindow} from './platform-specific'

function _onShowMain() {
  showMainWindow()
}

function* appStateSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatestPure(AppGen.showMain, _onShowMain)
}

export default appStateSaga
