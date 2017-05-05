// @flow
import chatSaga from '../actions/chat'
import createSagaMiddleware from 'redux-saga'
import deviceSaga from '../actions/devices'
import favoriteSaga from '../actions/favorite'
import gregorSaga from '../actions/gregor'
import kbfsSaga from '../actions/kbfs'
import loginSaga from '../actions/login/saga'
import notificationsSaga from '../actions/notifications'
import pgpSaga from '../actions/pgp'
import planBillingSaga from '../actions/plan-billing'
import profileSaga from '../actions/profile'
import routeSaga from '../actions/route-tree'
import settingsSaga from '../actions/settings'
import pushSaga from '../actions/push'
import {fork} from 'redux-saga/effects'
import sagaMonitor from './saga-monitor'
import {reduxSagaLogger} from '../local-debug'
import appStateSaga from '../actions/app'

import type {SagaGenerator} from '../constants/types/saga'

function * mainSaga (): SagaGenerator<any, any> {
  yield fork(chatSaga)
  yield fork(deviceSaga)
  yield fork(favoriteSaga)
  yield fork(gregorSaga)
  yield fork(kbfsSaga)
  yield fork(loginSaga)
  yield fork(notificationsSaga)
  yield fork(pgpSaga)
  yield fork(planBillingSaga)
  yield fork(profileSaga)
  yield fork(pushSaga)
  yield fork(routeSaga)
  yield fork(settingsSaga)
  yield fork(appStateSaga)
}

let middleWare
function create (crashHandler: (err: any) => void) {
  if (middleWare) {
    throw new Error('Only create one saga middleware!')
  }
  middleWare = createSagaMiddleware({
    onError: crashHandler,
    sagaMonitor: reduxSagaLogger ? sagaMonitor : undefined,
  })
  return middleWare
}

function run () {
  middleWare.run(mainSaga)
}

export {
  create,
  run,
}
