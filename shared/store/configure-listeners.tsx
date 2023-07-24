import initAutoReset from '../actions/autoreset'
import initBots from '../actions/bots'
import initChat from '../actions/chat2'
import initConfig from '../actions/config'
import initDeeplinks from '../actions/deeplinks'
import initDevice from '../actions/devices'
import initFS from '../actions/fs'
import initGit from '../actions/git'
import initGregor from '../actions/gregor'
import initNotifications from '../actions/notifications'
import initPeople from '../actions/people'
import initPinentry from '../actions/pinentry'
import initSettings from '../actions/settings'
import initSignup from '../actions/signup'
import initTeams from '../actions/teams'
import initTeamBuilding from '../actions/team-building'
import initUnlockFolders from '../actions/unlock-folders'
import initUsers from '../actions/users'

export const initListeners = () => {
  initAutoReset()
  initBots()
  initChat()
  initConfig()
  initDeeplinks()
  initDevice()
  initFS()
  initGregor()
  initNotifications()
  initPinentry()
  initSettings()
  initTeams()
  initTeamBuilding()
  initUnlockFolders()
  initUsers()
  initGit()
  initPeople()
  initSignup()
}
