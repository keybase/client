import * as Constants from '../constants/settings'
import * as ConfigConstants from '../constants/config'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouterConstants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
import * as Container from '../util/container'

const initSettings = () => {
  Container.listenAction(EngineGen.keybase1NotifyUsersPasswordChanged, (_, action) => {
    const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
    Constants.usePasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
  })

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

  Container.listenAction(EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged, (_, action) => {
    const {list} = action.payload.params
    Constants.usePhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
  })

  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailsChanged, (_, action) => {
    const list = action.payload.params.list ?? []
    Constants.useEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(list)
  })

  Container.listenAction(EngineGen.keybase1NotifyEmailAddressEmailAddressVerified, (_, action) => {
    logger.info('email verified')
    Constants.useEmailState.getState().dispatch.notifyEmailVerified(action.payload.params.emailAddress)
  })
}

export default initSettings
