import initChat from '../actions/chat2'
import initConfig from '../actions/config'
import initGit from '../actions/git'
import initPeople from '../actions/people'
import initSettings from '../actions/settings'
import initSignup from '../actions/signup'
import initTeams from '../actions/teams'
import initTeamBuilding from '../actions/team-building'
import * as Z from '../util/zustand'

export const initListeners = () => {
  initChat()
  initConfig()
  initSettings()
  initTeams()
  initTeamBuilding()
  initGit()
  initPeople()
  initSignup()

  const f = async () => {
    const Devices = await import('../constants/devices')
    Devices.useState.getState().dispatch.setupSubscriptions()
    const AutoReset = await import('../constants/autoreset')
    AutoReset.useState.getState().dispatch.setupSubscriptions()
    const FS = await import('../constants/fs')
    FS.useState.getState().dispatch.setupSubscriptions()
    const Config = await import('../constants/config')
    Config.useConfigState.getState().dispatch.setupSubscriptions()
  }
  Z.ignorePromise(f())
}
