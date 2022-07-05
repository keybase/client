import initAutoReset from '../actions/autoreset'
import botsSaga from '../actions/bots'
import initChat from '../actions/chat2'
import cryptoSaga from '../actions/crypto'
import initConfig from '../actions/config'
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
import recoverPasswordSaga from '../actions/recover-password'
import tracker2Saga from '../actions/tracker2'
import settingsSaga from '../actions/settings'
import signupSaga from '../actions/signup'
import teamsSaga from '../actions/teams'
import unlockFoldersSaga from '../actions/unlock-folders'
import usersSaga from '../actions/users'
import walletsSaga from '../actions/wallets'
import * as Saga from '../util/saga'

function* mainSaga() {
  initAutoReset()
  yield Saga.spawn(botsSaga)
  initChat()
  yield Saga.spawn(cryptoSaga)
  initConfig()
  yield Saga.spawn(deeplinksSaga)
  yield Saga.spawn(deviceSaga)
  yield Saga.spawn(fsSaga)
  yield Saga.spawn(gregorSaga)
  yield Saga.spawn(loginSaga)
  yield Saga.spawn(provisionSaga)
  yield Saga.spawn(notificationsSaga)
  yield Saga.spawn(pinentrySaga)
  yield Saga.spawn(profileSaga)
  yield Saga.spawn(recoverPasswordSaga)
  yield Saga.spawn(tracker2Saga)
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
  })
  return middleWare
}

function run() {
  middleWare?.run(mainSaga)
}

export {create, run}
