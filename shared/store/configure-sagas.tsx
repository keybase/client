import initAutoReset from '../actions/autoreset'
import initBots from '../actions/bots'
import initChat from '../actions/chat2'
import initCrypto from '../actions/crypto'
import initConfig from '../actions/config'
import createSagaMiddleware from 'redux-saga'
import initDeeplinks from '../actions/deeplinks'
import initDevice from '../actions/devices'
import initFS from '../actions/fs'
import gitSaga from '../actions/git'
import initGregor from '../actions/gregor'
import initLogin from '../actions/login'
import initProvision from '../actions/provision'
import initNotifications from '../actions/notifications'
import initPeople from '../actions/people'
import initPinentry from '../actions/pinentry'
import profileSaga from '../actions/profile'
import recoverPasswordSaga from '../actions/recover-password'
import tracker2Saga from '../actions/tracker2'
import settingsSaga from '../actions/settings'
import signupSaga from '../actions/signup'
import teamsSaga from '../actions/teams'
import initUnlockFolders from '../actions/unlock-folders'
import initUsers from '../actions/users'
import walletsSaga from '../actions/wallets'
import * as Saga from '../util/saga'

function* mainSaga() {
  initAutoReset()
  initBots()
  initChat()
  initCrypto()
  initConfig()
  initDeeplinks()
  initDevice()
  initFS()
  initGregor()
  initLogin()
  initProvision()
  initNotifications()
  initPinentry()
  yield Saga.spawn(profileSaga)
  yield Saga.spawn(recoverPasswordSaga)
  yield Saga.spawn(tracker2Saga)
  yield Saga.spawn(settingsSaga)
  yield Saga.spawn(teamsSaga)
  initUnlockFolders()
  initUsers()
  yield Saga.spawn(gitSaga)
  initPeople()
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
