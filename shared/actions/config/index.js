// @flow
import logger from '../../logger'
import * as LoginGen from '../login-gen'
import * as ConfigGen from '../config-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as PlatformSpecific from '../platform-specific'
import * as RouteTree from '../route-tree'
import * as Tabs from '../../constants/tabs'
import appRouteTree from '../../app/routes-app'
import loginRouteTree from '../../app/routes-login'
import avatarSaga from './avatar'
import {getEngine} from '../../engine'
import {type TypedState} from '../../constants/reducer'

const getExtendedStatus = () =>
  RPCTypes.configGetExtendedStatusRpcPromise().then(extendedConfig =>
    ConfigGen.createExtendedConfigLoaded({extendedConfig})
  )

const setupEngineListeners = () => {
  getEngine().setIncomingActionCreators(
    'keybase.1.NotifyTracking.trackingChanged',
    ({isTracking, username}) => [ConfigGen.createUpdateFollowing({isTracking, username})]
  )

  getEngine().actionOnDisconnect('daemonError', () => {
    logger.flush()
    return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
  })
  getEngine().actionOnConnect('handshake', () => ConfigGen.createStartHandshake())

  getEngine().setIncomingActionCreators('keybase.1.NotifySession.loggedIn', ({username}, response) => {
    response && response.result()
    return [ConfigGen.createLoggedIn()]
  })

  getEngine().setIncomingActionCreators('keybase.1.NotifySession.loggedOut', (_, __, ___, getState) => {
    return [ConfigGen.createLoggedOut()]
  })
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

const showDeletedSelfRootPage = () =>
  Saga.sequentially([
    Saga.put(RouteTree.switchRouteDef(loginRouteTree)),
    Saga.put(RouteTree.navigateTo([Tabs.loginTab])),
  ])

const switchRouteDef = (state: TypedState) =>
  state.config.loggedIn
    ? Saga.put(RouteTree.switchRouteDef(appRouteTree))
    : Saga.put(RouteTree.switchRouteDef(loginRouteTree))

const resetGlobalStore = () => Saga.put({payload: undefined, type: ConfigGen.resetStore})

const startLogoutHandshake = () => Saga.put(ConfigGen.createLogoutHandshake())

const maybeDoneWithLogoutHandshake = (state: TypedState) =>
  state.config.logoutHandshakeWaiters.size <= 0 && Saga.call(RPCTypes.loginLogoutRpcPromise)

function* configSaga(): Saga.SagaGenerator<any, any> {
  // TODO handle logout stuff also
  yield Saga.actionToAction(ConfigGen.installerRan, dispatchSetupEngineListeners)
  yield Saga.actionToAction([ConfigGen.restartHandshake, ConfigGen.startHandshake], startHandshake)
  yield Saga.actionToAction(ConfigGen.daemonHandshakeWait, maybeDoneWithDaemonHandshake)
  yield Saga.actionToAction(ConfigGen.daemonHandshake, loadDaemonConfig)
  yield Saga.actionToAction(ConfigGen.daemonHandshake, loadDaemonBootstrapStatus)
  yield Saga.actionToAction(ConfigGen.daemonHandshake, loadDaemonAccounts)
  yield Saga.actionToPromise(ConfigGen.loggedIn, getExtendedStatus)
  yield Saga.actionToAction([ConfigGen.loggedIn, ConfigGen.loggedOut], switchRouteDef)

  yield Saga.actionToAction(ConfigGen.logout, startLogoutHandshake)
  yield Saga.actionToAction(ConfigGen.logoutHandshakeWait, maybeDoneWithLogoutHandshake)
  yield Saga.actionToAction(ConfigGen.loggedOut, resetGlobalStore)

  yield Saga.actionToAction(ConfigGen.setDeletedSelf, showDeletedSelfRootPage)

  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  yield Saga.fork(PlatformSpecific.platformConfigSaga)
  yield Saga.fork(avatarSaga)
}

export default configSaga
