import chat2Saga from '../actions/chat2'
import configSaga from '../actions/config'
import createSagaMiddleware from 'redux-saga'
import deeplinksSaga from '../actions/deeplinks'
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
import tracker2Saga from '../actions/tracker2'
import sagaMonitor from './saga-monitor'
import searchSaga from '../actions/search'
import settingsSaga from '../actions/settings'
import signupSaga from '../actions/signup'
import teamsSaga from '../actions/teams'
import unlockFoldersSaga from '../actions/unlock-folders'
import usersSaga from '../actions/users'
import walletsSaga from '../actions/wallets'
import {reduxSagaLogger} from '../local-debug'
import {sagaTimer} from '../util/user-timings'
import * as Saga from '../util/saga'

function* mainSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.spawn(chat2Saga)
  yield Saga.spawn(configSaga)
  yield Saga.spawn(deeplinksSaga)
  yield Saga.spawn(deviceSaga)
  yield Saga.spawn(fsSaga)
  yield Saga.spawn(gregorSaga)
  yield Saga.spawn(loginSaga)
  yield Saga.spawn(provisionSaga)
  yield Saga.spawn(notificationsSaga)
  yield Saga.spawn(pinentrySaga)
  yield Saga.spawn(profileSaga)
  yield Saga.spawn(tracker2Saga)
  yield Saga.spawn(searchSaga)
  yield Saga.spawn(settingsSaga)
  yield Saga.spawn(teamsSaga)
  yield Saga.spawn(unlockFoldersSaga)
  yield Saga.spawn(usersSaga)
  yield Saga.spawn(gitSaga)
  yield Saga.spawn(peopleSaga)
  yield Saga.spawn(walletsSaga)
  yield Saga.spawn(signupSaga)
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
