// @flow
import chat2Saga from '../actions/chat2'
import configSaga from '../actions/config'
import createSagaMiddleware from 'redux-saga'
import deviceSaga from '../actions/devices'
import favoriteSaga from '../actions/favorite'
import fsSaga from '../actions/fs'
import gitSaga from '../actions/git'
import gregorSaga from '../actions/gregor'
import kbfsSaga from '../actions/kbfs'
import loginSaga from '../actions/login'
import provisionSaga from '../actions/provision'
import notificationsSaga from '../actions/notifications'
import peopleSaga from '../actions/people'
import pinentrySaga from '../actions/pinentry'
import planBillingSaga from '../actions/plan-billing'
import profileSaga from '../actions/profile'
import pushSaga from '../actions/push'
import routeSaga from '../actions/route-tree'
import sagaMonitor from './saga-monitor'
import searchSaga from '../actions/search'
import settingsSaga from '../actions/settings'
import signupSaga from '../actions/signup'
import teamsSaga from '../actions/teams'
import trackerSaga from '../actions/tracker'
import unlockFoldersSaga from '../actions/unlock-folders'
import usersSaga from '../actions/users'
import walletsSaga from '../actions/wallets'
import {fork} from 'redux-saga/effects'
import {reduxSagaLogger} from '../local-debug'
import {sagaTimer} from '../dev/user-timings'

import type {SagaGenerator} from '../constants/types/saga'

function* mainSaga(): SagaGenerator<any, any> {
  yield fork(chat2Saga)
  yield fork(configSaga)
  yield fork(deviceSaga)
  yield fork(favoriteSaga)
  yield fork(fsSaga)
  yield fork(gregorSaga)
  yield fork(kbfsSaga)
  yield fork(loginSaga)
  yield fork(provisionSaga)
  yield fork(notificationsSaga)
  yield fork(pinentrySaga)
  yield fork(planBillingSaga)
  yield fork(profileSaga)
  yield fork(pushSaga)
  yield fork(routeSaga)
  yield fork(searchSaga)
  yield fork(settingsSaga)
  yield fork(trackerSaga)
  yield fork(teamsSaga)
  yield fork(unlockFoldersSaga)
  yield fork(usersSaga)
  yield fork(gitSaga)
  yield fork(peopleSaga)
  yield fork(walletsSaga)
  yield fork(signupSaga)
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
