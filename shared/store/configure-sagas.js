// @flow
import chat2Saga from '../actions/chat2'
import configSaga from '../actions/config'
import createSagaMiddleware from 'redux-saga'
import deviceSaga from '../actions/devices'
import fsSaga from '../actions/fs'
import gitSaga from '../actions/git'
import gregorSaga from '../actions/gregor'
import loginSaga from '../actions/login'
import provisionSaga from '../actions/provision'
import notificationsSaga from '../actions/notifications'
import peopleSaga from '../actions/people'
import pinentrySaga from '../actions/pinentry'
import profileSaga from '../actions/profile'
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
import {reduxSagaLogger} from '../local-debug'
import {sagaTimer} from '../dev/user-timings'
import * as Saga from '../util/saga'

function* mainSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.fork(chat2Saga)
  yield Saga.fork(configSaga)
  yield Saga.fork(deviceSaga)
  yield Saga.fork(fsSaga)
  yield Saga.fork(gregorSaga)
  yield Saga.fork(loginSaga)
  yield Saga.fork(provisionSaga)
  yield Saga.fork(notificationsSaga)
  yield Saga.fork(pinentrySaga)
  yield Saga.fork(profileSaga)
  yield Saga.fork(routeSaga)
  yield Saga.fork(searchSaga)
  yield Saga.fork(settingsSaga)
  yield Saga.fork(trackerSaga)
  yield Saga.fork(teamsSaga)
  yield Saga.fork(unlockFoldersSaga)
  yield Saga.fork(usersSaga)
  yield Saga.fork(gitSaga)
  yield Saga.fork(peopleSaga)
  yield Saga.fork(walletsSaga)
  yield Saga.fork(signupSaga)
}

let middleWare
function create(crashHandler: (err: any) => void) {
  if (!__DEV__ && middleWare) {
    throw new Error('Only create one saga middleware!')
  }
  middleWare = createSagaMiddleware({
    onError: crashHandler,
    sagaMonitor: sagaTimer || (reduxSagaLogger ? sagaMonitor : undefined),
  })
  return middleWare
}

function run() {
  middleWare && middleWare.run(mainSaga)
}

export {create, run}
