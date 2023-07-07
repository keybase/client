import * as ConfigGen from './config-gen'
import * as Constants from '../constants/settings'
import * as EngineGen from './engine-gen-gen'
import * as SettingsGen from './settings-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
import * as Container from '../util/container'

const initSettings = () => {
  Container.listenAction(SettingsGen.stop, (_, action) => {
    Constants.useState.getState().dispatch.stop(action.payload.exitCode)
  })
  Container.listenAction(EngineGen.keybase1NotifyUsersPasswordChanged, (_, action) => {
    const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
    Constants.usePasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
  })

  Container.listenAction(ConfigGen.loadOnStart, () => {
    Constants.useContactsState.getState().dispatch.loadContactImportEnabled()
  })

  Container.listenAction(RouteTreeGen.onNavChanged, (_, action) => {
    const {prev, next} = action.payload
    // Clear "check your inbox" in settings when you leave the settings tab
    if (
      Constants.useEmailState.getState().addedEmail &&
      prev &&
      Router2Constants.getTab(prev) === Tabs.settingsTab &&
      next &&
      Router2Constants.getTab(next) !== Tabs.settingsTab
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
