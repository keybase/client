// @flow
import chatSaga from '../actions/chat'
import configSaga from '../actions/config'
import createSagaMiddleware from 'redux-saga'
import deviceSaga from '../actions/devices'
import favoriteSaga from '../actions/favorite'
import gregorSaga from '../actions/gregor'
import kbfsSaga from '../actions/kbfs'
import loginSaga from '../actions/login'
import notificationsSaga from '../actions/notifications'
import pinentrySaga from '../actions/pinentry'
import gitSaga from '../actions/git'
import planBillingSaga from '../actions/plan-billing'
import profileSaga from '../actions/profile'
import routeSaga from '../actions/route-tree'
import searchSaga from '../actions/search'
import settingsSaga from '../actions/settings'
import trackerSaga from '../actions/tracker'
import unlockFoldersSaga from '../actions/unlock-folders'
import pushSaga from '../actions/push'
import {fork} from 'redux-saga/effects'
import sagaMonitor from './saga-monitor'
import {reduxSagaLogger} from '../local-debug'
import appStateSaga from '../actions/app'
import teamsSaga from '../actions/teams'
import {sagaTimer} from '../dev/user-timings'

import type {SagaGenerator} from '../constants/types/saga'

function* mainSaga(): SagaGenerator<any, any> {
  yield fork(chatSaga)
  yield fork(configSaga)
  yield fork(deviceSaga)
  yield fork(favoriteSaga)
  yield fork(gregorSaga)
  yield fork(kbfsSaga)
  yield fork(loginSaga)
  yield fork(notificationsSaga)
  yield fork(pinentrySaga)
  yield fork(planBillingSaga)
  yield fork(profileSaga)
  yield fork(pushSaga)
  yield fork(routeSaga)
  yield fork(searchSaga)
  yield fork(settingsSaga)
  yield fork(appStateSaga)
  yield fork(trackerSaga)
  yield fork(teamsSaga)
  yield fork(unlockFoldersSaga)
  yield fork(gitSaga)
}

let middleWare
function create(crashHandler: (err: any) => void) {
  if (middleWare) {
    throw new Error('Only create one saga middleware!')
  }
  middleWare = createSagaMiddleware({
    onError: crashHandler,
    sagaMonitor: sagaTimer || (reduxSagaLogger ? sagaMonitor : undefined),
  })
  return middleWare
}

function run() {
  middleWare.run(mainSaga)
}

export {create, run}
