import initAutoReset from '../actions/autoreset'
import initBots from '../actions/bots'
import initChat from '../actions/chat2'
import initConfig from '../actions/config'
import initDevice from '../actions/devices'
import initFS from '../actions/fs'
import initGit from '../actions/git'
import initGregor from '../actions/gregor'
import initPeople from '../actions/people'
import initSettings from '../actions/settings'
import initSignup from '../actions/signup'
import initTeams from '../actions/teams'
import initTeamBuilding from '../actions/team-building'
import initUnlockFolders from '../actions/unlock-folders'

export const initListeners = () => {
  initAutoReset()
  initBots()
  initChat()
  initConfig()
  initDevice()
  initFS()
  initGregor()
  initSettings()
  initTeams()
  initTeamBuilding()
  initUnlockFolders()
  initGit()
  initPeople()
  initSignup()
}
