import * as Constants from '../constants/settings'
import * as ConfigConstants from '../constants/config'
import * as RouterConstants from '../constants/router2'
import * as Tabs from '../constants/tabs'

const initSettings = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.loadOnStartPhase === old.loadOnStartPhase) return
    switch (s.loadOnStartPhase) {
      case 'startupOrReloginButNotInARush':
        Constants.useContactsState.getState().dispatch.loadContactImportEnabled()
        break
      default:
    }
  })

  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    // Clear "check your inbox" in settings when you leave the settings tab
    if (
      Constants.useEmailState.getState().addedEmail &&
      prev &&
      RouterConstants.getTab(prev) === Tabs.settingsTab &&
      next &&
      RouterConstants.getTab(next) !== Tabs.settingsTab
    ) {
      Constants.useEmailState.getState().dispatch.resetAddedEmail()
    }
  })
}

export default initSettings
