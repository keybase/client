import initAutoReset from '../actions/autoreset'
import initBots from '../actions/bots'
import initChat from '../actions/chat2'
import initCrypto from '../actions/crypto'
import initConfig from '../actions/config'
import initDeeplinks from '../actions/deeplinks'
import initDevice from '../actions/devices'
import initFS from '../actions/fs'
import initGit from '../actions/git'
import initGregor from '../actions/gregor'
import initLogin from '../actions/login'
import initProvision from '../actions/provision'
import initNotifications from '../actions/notifications'
import initPeople from '../actions/people'
import initPinentry from '../actions/pinentry'
import initProfile from '../actions/profile'
import initRecoverPassword from '../actions/recover-password'
import initTracker from '../actions/tracker2'
import initSettings from '../actions/settings'
import initSignup from '../actions/signup'
import initTeams from '../actions/teams'
import initUnlockFolders from '../actions/unlock-folders'
import initUsers from '../actions/users'
import initWallets from '../actions/wallets'

export const initListeners = () => {
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
  initProfile()
  initRecoverPassword()
  initTracker()
  initSettings()
  initTeams()
  initUnlockFolders()
  initUsers()
  initGit()
  initPeople()
  initWallets()
  initSignup()
}
