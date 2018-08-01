// @flow
import logger from '../../logger'
import * as LoginGen from '../login-gen'
import * as ConfigGen from '../config-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as PlatformSpecific from '../platform-specific'
import avatarSaga from './avatar'
import engine from '../../engine'
import {type TypedState} from '../../constants/reducer'

const getExtendedStatus = () =>
  RPCTypes.configGetExtendedStatusRpcPromise().then(extendedConfig =>
    ConfigGen.createExtendedConfigLoaded({extendedConfig})
  )

const setupEngineListeners = () => {
  engine().setIncomingActionCreators('keybase.1.NotifyTracking.trackingChanged', ({isTracking, username}) => [
    ConfigGen.createUpdateFollowing({isTracking, username}),
  ])

  engine().actionOnDisconnect('daemonError', () => {
    logger.flush()
    return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
  })
  engine().actionOnConnect('handshake', () => ConfigGen.createStartHandshake())
}

// Only do this once
const loadDaemonConfig = (state: TypedState, action: ConfigGen.DaemonHandshakePayload) =>
  !state.config.version &&
  Saga.sequentially([
    Saga.put(ConfigGen.createDaemonHandshakeWait({increment: true, name: 'config.version'})),
    Saga.call(function*() {
      const loadedAction = yield RPCTypes.configGetConfigRpcPromise().then((config: RPCTypes.Config) => {
        logger.info(`Keybase version: ${config.version}`)
        return ConfigGen.createConfigLoaded({
          version: config.version,
          versionShort: config.versionShort,
        })
      })
      yield Saga.put(loadedAction)
    }),
    Saga.put(ConfigGen.createDaemonHandshakeWait({increment: false, name: 'config.version'})),
  ])

const loadDaemonBootstrapStatus = (state: TypedState, action: ConfigGen.DaemonHandshakePayload) =>
  Saga.sequentially([
    Saga.put(ConfigGen.createDaemonHandshakeWait({increment: true, name: 'config.getBootstrapStatus'})),
    Saga.call(function*() {
      const loadedAction = yield RPCTypes.configGetBootstrapStatusRpcPromise().then(
        (s: RPCTypes.BootstrapStatus) =>
          ConfigGen.createBootstrapStatusLoaded({
            deviceID: s.deviceID,
            deviceName: s.deviceName,
            followers: s.followers || [],
            following: s.following || [],
            loggedIn: s.loggedIn,
            registered: s.registered,
            uid: s.uid,
            username: s.username,
          })
      )
      yield Saga.put(loadedAction)
    }),
    Saga.put(ConfigGen.createDaemonHandshakeWait({increment: false, name: 'config.getBootstrapStatus'})),
  ])

let dispatchSetupEngineListenersOnce = false
const dispatchSetupEngineListeners = () => {
  if (dispatchSetupEngineListenersOnce) {
    return
  }
  dispatchSetupEngineListenersOnce = true
  return Saga.put(ConfigGen.createSetupEngineListeners())
}

let createDaemonHandshakeOnce = false
const startHandshake = () => {
  const firstTimeConnecting = !createDaemonHandshakeOnce
  createDaemonHandshakeOnce = true
  return Saga.put(ConfigGen.createDaemonHandshake({firstTimeConnecting}))
}

const maybeDoneWithDaemonHandshake = (state: TypedState) => {
  if (state.config.daemonHandshakeWaiters.size > 0) {
    // still waiting for things to finish
  } else {
    if (state.config.daemonHandshakeFailedReason) {
      if (state.config.daemonHandshakeRetriesLeft) {
        return Saga.put(ConfigGen.createRestartHandshake())
      }
    } else {
      return Saga.put(ConfigGen.createDaemonHandshakeDone())
    }
  }
}

const loadDaemonAccounts = () =>
  Saga.sequentially([
    Saga.put(ConfigGen.createDaemonHandshakeWait({increment: true, name: 'config.getAccounts'})),
    Saga.call(function*() {
      try {
        const accounts = yield Saga.call(RPCTypes.loginGetConfiguredAccountsRpcPromise)
        yield Saga.put(ConfigGen.createConfiguredAccounts({accounts: (accounts || []).map(a => a.username)}))
        yield Saga.put(ConfigGen.createDaemonHandshakeWait({increment: false, name: 'config.getAccounts'}))
      } catch (error) {
        yield Saga.put(
          ConfigGen.createDaemonHandshakeWait({
            failedReason: "Can't get accounts",
            increment: false,
            name: 'config.getAccounts',
          })
        )
      }
    }),
  ])

function* configSaga(): Saga.SagaGenerator<any, any> {
  // TODO handle logout stuff also
  yield Saga.actionToAction(ConfigGen.installerRan, dispatchSetupEngineListeners)
  yield Saga.actionToAction([ConfigGen.restartHandshake, ConfigGen.startHandshake], startHandshake)
  yield Saga.actionToAction(ConfigGen.daemonHandshakeWait, maybeDoneWithDaemonHandshake)
  yield Saga.actionToAction(ConfigGen.daemonHandshake, loadDaemonConfig)
  yield Saga.actionToAction(ConfigGen.daemonHandshake, loadDaemonBootstrapStatus)
  yield Saga.actionToAction(ConfigGen.daemonHandshake, loadDaemonAccounts)
  yield Saga.actionToPromise(LoginGen.loggedin, getExtendedStatus)

  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  yield Saga.fork(PlatformSpecific.platformConfigSaga)
  yield Saga.fork(avatarSaga)
}

export default configSaga
