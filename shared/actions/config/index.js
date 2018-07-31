// @flow
import logger from '../../logger'
// import * as KBFSGen from '../kbfs-gen'
// import * as FsGen from '../fs-gen'
import * as LoginGen from '../login-gen'
import * as ConfigGen from '../config-gen'
import * as TeamsGen from '../teams-gen'
import * as Constants from '../../constants/config'
import * as GregorCreators from '../gregor'
import * as NotificationsGen from '../notifications-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as PinentryGen from '../pinentry-gen'
import * as PlatformSpecific from '../platform-specific'
import avatarSaga from './avatar'
import engine from '../../engine'
import {createGetPeopleData} from '../people-gen'
import {defaultNumFollowSuggestions} from '../../constants/people'
import {isMobile} from '../../constants/platform'
import {type AsyncAction} from '../../constants/types/flux'
import {type TypedState} from '../../constants/reducer'
import {throttle} from 'lodash-es'

// Must be an action which returns a promise so put.resolve continues to wait and work
// TODO could change this to use Take and make it 2 steps instead of using put.resolve()
// const getExtendedStatus = (): AsyncAction => dispatch => {
// return new Promise((resolve, reject) => {
// RPCTypes.configGetExtendedStatusRpcPromise()
// .then(extendedConfig => {
// dispatch(ConfigGen.createExtendedConfigLoaded({extendedConfig}))
// resolve(extendedConfig)
// })
// .catch(error => {
// reject(error)
// })
// })
// }

// bootstrap would be a method on an object.
// let bootstrapSetup = false
// let didInitialNav = false

// we need to reset this if you log out, else we won't get configured accounts.
// const clearDidInitialNav = () => {
// didInitialNav = false
// }

// Until bootstrap is sagaized
// function _bootstrap({payload}: ConfigGen.BootstrapPayload) {
// return Saga.put(bootstrap(payload))
// }

// const bootstrap = (opts: $PropertyType<ConfigGen.BootstrapPayload, 'payload'>): AsyncAction => (

// dispatch(NotificationsGen.createListenForKBFSNotifications())
//
// if (!didInitialNav) {
// dispatch(async () => {
// if (getState().config.loggedIn) {
// dispatch(LoginGen.createNavBasedOnLoginAndInitialState())
// // TODO move these to a bootstrapSuccess handler
// didInitialNav = true
// // If we're logged in, restore any saved route state and
// // then nav again based on it.
// // load people tab info on startup as well
// // also load the teamlist for auxiliary information around the app
// await dispatch(TeamsGen.createGetTeams())
// await dispatch(
// createGetPeopleData({
// markViewed: false,
// numFollowSuggestionsWanted: defaultNumFollowSuggestions,
// })
// )
// }
// })
// }
// })
// .catch(error => {
// logger.warn('[bootstrap] error bootstrapping: ', error)
// const triesRemaining = getState().config.bootstrapTriesRemaining
// dispatch(ConfigGen.createBootstrapAttemptFailed())
// if (triesRemaining > 0) {
// const retryDelay = Constants.bootstrapRetryDelay / triesRemaining
// logger.info(`[bootstrap] resetting engine in ${retryDelay / 1000}s (${triesRemaining} tries left)`)
// setTimeout(() => engine().reset(), retryDelay)
// } else {
// logger.error('[bootstrap] exhausted bootstrap retries')
// dispatch(ConfigGen.createBootstrapFailed())
// }
// logger.flush()
// })
// }
// }

// const getConfigOnce = (state: TypedState) =>

// We get a counter for badge state, if we get one that's less than what we've seen we toss it
let lastBadgeStateVersion = -1
const throttledDispatch = throttle((dispatch, action) => dispatch(action), 1000, {
  leading: false,
  trailing: true,
})
const setupEngineListeners = () => {
  engine().setIncomingActionCreators('keybase.1.NotifyTracking.trackingChanged', ({isTracking, username}) => [
    ConfigGen.createUpdateFollowing({isTracking, username}),
  ])

  engine().actionOnDisconnect('daemonError', () => {
    logger.flush()
    return ConfigGen.createDaemonError({daemonError: new Error('Disconnected')})
  })
  engine().actionOnConnect('handshake', () => ConfigGen.createStartHandshake())

  engine().setIncomingActionCreators(
    'keybase.1.NotifyBadges.badgeState',
    ({badgeState}, _, dispatch, getState) => {
      // TODO move this to the reducer
      if (badgeState.inboxVers < lastBadgeStateVersion) {
        logger.info(
          `Ignoring older badgeState, got ${badgeState.inboxVers} but have seen ${lastBadgeStateVersion}`
        )
        return
      }

      lastBadgeStateVersion = badgeState.inboxVers
      const conversations = badgeState.conversations
      const totalChats = (conversations || []).reduce((total, c) => total + c.unreadMessages, 0)
      const action = NotificationsGen.createReceivedBadgeState({badgeState})
      if (totalChats > 0) {
        // Defer this slightly so we don't get flashing if we're quickly receiving and reading
        throttledDispatch(dispatch, action)
      } else {
        // If clearing go immediately
        throttledDispatch.cancel()
        dispatch(action)
      }
    }
  )
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

  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)

  // yield Saga.safeTakeEveryPure(LoginGen.logout, clearDidInitialNav)
  // yield Saga.safeTakeEveryPure(ConfigGen.bootstrap, _bootstrap)
  // yield Saga.safeTakeEveryPure(ConfigGen.retryBootstrap, _retryBootstrap)
  // yield Saga.actionToPromise(ConfigGen.loadConfig, getConfig)

  yield Saga.fork(PlatformSpecific.platformConfigSaga)
  yield Saga.fork(avatarSaga)
}

// export {getExtendedStatus}
export default configSaga
