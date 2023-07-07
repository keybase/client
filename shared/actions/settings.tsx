import * as ConfigGen from './config-gen'
import * as Constants from '../constants/settings'
import * as WaitingConstants from '../constants/waiting'
import * as ConfigConstants from '../constants/config'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Router2Constants from '../constants/router2'
import * as SettingsGen from './settings-gen'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
import * as Container from '../util/container'
import {pprofDir} from '../constants/platform'

const dbNuke = async () => {
  await RPCTypes.ctlDbNukeRpcPromise(undefined, Constants.settingsWaitingKey)
}

const deleteAccountForever = async (_: unknown, action: SettingsGen.DeleteAccountForeverPayload) => {
  const username = ConfigConstants.useCurrentUserState.getState().username

  if (!username) {
    throw new Error('Unable to delete account: no username set')
  }

  await RPCTypes.loginAccountDeleteRpcPromise(
    {passphrase: action.payload.passphrase?.stringValue()},
    Constants.settingsWaitingKey
  )

  ConfigConstants.useConfigState.getState().dispatch.setJustDeletedSelf(username)

  return [
    RouteTreeGen.createSwitchLoggedIn({loggedIn: false}),
    RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}),
  ]
}

const trace = async (
  _: Container.TypedState,
  action: SettingsGen.TracePayload,
  listenerApi: Container.ListenerApi
) => {
  const durationSeconds = action.payload.durationSeconds
  await RPCTypes.pprofLogTraceRpcPromise({logDirForMobile: pprofDir, traceDurationSeconds: durationSeconds})
  const {decrement, increment} = WaitingConstants.useWaitingState.getState().dispatch
  increment(Constants.traceInProgressKey)
  await listenerApi.delay(durationSeconds * 1_000)
  decrement(Constants.traceInProgressKey)
}

const processorProfile = async (
  _: Container.TypedState,
  action: SettingsGen.ProcessorProfilePayload,
  listenerApi: Container.ListenerApi
) => {
  const durationSeconds = action.payload.durationSeconds
  await RPCTypes.pprofLogProcessorProfileRpcPromise({
    logDirForMobile: pprofDir,
    profileDurationSeconds: durationSeconds,
  })

  const {decrement, increment} = WaitingConstants.useWaitingState.getState().dispatch
  increment(Constants.processorProfileInProgressKey)
  await listenerApi.delay(durationSeconds * 1_000)
  decrement(Constants.processorProfileInProgressKey)
}

const stop = async (_: unknown, action: SettingsGen.StopPayload) => {
  await RPCTypes.ctlStopRpcPromise({exitCode: action.payload.exitCode})
  return false as const
}

const initSettings = () => {
  Container.listenAction(SettingsGen.dbNuke, dbNuke)
  Container.listenAction(SettingsGen.deleteAccountForever, deleteAccountForever)
  Container.listenAction(SettingsGen.trace, trace)
  Container.listenAction(SettingsGen.processorProfile, processorProfile)
  Container.listenAction(EngineGen.keybase1NotifyUsersPasswordChanged, (_, action) => {
    const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
    Constants.usePasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
  })

  Container.listenAction(SettingsGen.stop, stop)

  // Contacts
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
