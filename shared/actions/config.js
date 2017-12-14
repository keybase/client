// @flow
import logger from '../logger'
import * as KBFSGen from './kbfs-gen'
import * as ConfigGen from './config-gen'
import * as LoginGen from './login-gen'
import * as Constants from '../constants/config'
import * as GregorCreators from '../actions/gregor'
import * as NotificationsGen from '../actions/notifications-gen'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import * as SignupGen from '../actions/signup-gen'
import engine from '../engine'
import {RouteStateStorage} from '../actions/route-state-storage'
import {getTeams} from './teams/creators'
import {createConfigurePush} from './push-gen'
import {isMobile, isSimulator} from '../constants/platform'
import {loggedInSelector} from '../constants/selectors'
import {type AsyncAction} from '../constants/types/flux'
import {type TypedState} from '../constants/reducer'

// TODO convert to sagas

isMobile &&
  module.hot &&
  module.hot.accept(() => {
    logger.info('accepted update in actions/config')
  })

const waitForKBFS = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    let timedOut = false

    // The rpc timeout doesn't seem to work correctly (not that we should trust that anyways) so we have our own local timeout
    // TODO clean this up with sagas!
    let timer = setTimeout(() => {
      timedOut = true
      reject(new Error("Waited for KBFS client, but it wasn't found"))
    }, 10 * 1000)

    RPCTypes.configWaitForClientRpcPromise({
      clientType: RPCTypes.commonClientType.kbfs,
      timeout: 10.0,
    })
      .then(found => {
        clearTimeout(timer)
        if (timedOut) {
          return
        }
        if (!found) {
          reject(new Error("Waited for KBFS client, but it wasn't not found"))
          return
        }
        resolve()
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })

// Must be an action which returns a promise so put.resolve continues to wait and work
// TODO could change this to use Take and make it 2 steps instead of using put.resolve()
const getExtendedStatus = (): AsyncAction => dispatch => {
  return new Promise((resolve, reject) => {
    RPCTypes.configGetExtendedStatusRpcPromise()
      .then(extendedConfig => {
        dispatch(ConfigGen.createExtendedConfigLoaded({extendedConfig}))
        resolve(extendedConfig)
      })
      .catch(error => {
        reject(error)
      })
  })
}

const registerListeners = (): AsyncAction => dispatch => {
  dispatch(GregorCreators.listenForNativeReachabilityEvents)
  dispatch(GregorCreators.registerGregorListeners())
  dispatch(GregorCreators.registerReachability())
}

const _retryBootstrap = () => {
  return Saga.all([Saga.put(ConfigGen.createBootstrapRetry()), Saga.put(ConfigGen.createBootstrap({}))])
}

// TODO: It's unfortunate that we have these globals. Ideally,
// bootstrap would be a method on an object.
let bootstrapSetup = false
const routeStateStorage = new RouteStateStorage()

// Until bootstrap is sagaized
function* _bootstrap({payload}: ConfigGen.BootstrapPayload) {
  yield Saga.put(bootstrap(payload))
}

const bootstrap = (opts: $PropertyType<ConfigGen.BootstrapPayload, 'payload'>): AsyncAction => (
  dispatch,
  getState
) => {
  const readyForBootstrap = getState().config.readyForBootstrap
  if (!readyForBootstrap) {
    logger.warn('Not ready for bootstrap/connect')
    return
  }

  if (!bootstrapSetup) {
    bootstrapSetup = true
    logger.info('[bootstrap] registered bootstrap')
    engine().listenOnConnect('bootstrap', () => {
      dispatch(ConfigGen.createDaemonError({daemonError: null}))
      dispatch(GregorCreators.checkReachabilityOnConnect())
      logger.info('[bootstrap] bootstrapping on connect')
      dispatch(ConfigGen.createBootstrap({}))
    })
    dispatch(registerListeners())
  } else {
    logger.info('[bootstrap] performing bootstrap...')
    Promise.all([
      dispatch(getBootstrapStatus()),
      dispatch(waitForKBFS()),
      dispatch(KBFSGen.createFuseStatus()),
    ])
      .then(() => {
        dispatch(ConfigGen.createBootstrapSuccess())
        engine().listenOnDisconnect('daemonError', () => {
          dispatch(ConfigGen.createDaemonError({daemonError: new Error('Disconnected')}))
          logger.flush()
        })
        dispatch(NotificationsGen.createListenForKBFSNotifications())
        if (!opts.isReconnect) {
          dispatch(async (): Promise<*> => {
            await dispatch(LoginGen.createNavBasedOnLoginAndInitialState())
            if (getState().config.loggedIn) {
              // If we're logged in, restore any saved route state and
              // then nav again based on it.
              // also load the teamlist for auxiliary information around the app
              await dispatch(routeStateStorage.load)
              await dispatch(LoginGen.createNavBasedOnLoginAndInitialState())
              await dispatch(getTeams())
            }
          })
          dispatch(SignupGen.createResetSignup())
        }
      })
      .catch(error => {
        logger.warn('[bootstrap] error bootstrapping: ', error)
        const triesRemaining = getState().config.bootstrapTriesRemaining
        dispatch(ConfigGen.createBootstrapAttemptFailed())
        if (triesRemaining > 0) {
          const retryDelay = Constants.bootstrapRetryDelay / triesRemaining
          logger.info(`[bootstrap] resetting engine in ${retryDelay / 1000}s (${triesRemaining} tries left)`)
          setTimeout(() => engine().reset(), retryDelay)
        } else {
          logger.error('[bootstrap] exhausted bootstrap retries')
          dispatch(ConfigGen.createBootstrapFailed())
        }
        logger.flush()
      })
  }
}

// Until routeStateStorage is sagaized.
function* _clearRouteState(action: ConfigGen.ClearRouteStatePayload) {
  yield Saga.put(routeStateStorage.clear)
}

// Until routeStateStorage is sagaized.
function* _persistRouteState(action: ConfigGen.PersistRouteStatePayload) {
  yield Saga.put(routeStateStorage.store)
}

const getBootstrapStatus = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    RPCTypes.configGetBootstrapStatusRpcPromise()
      .then(bootstrapStatus => {
        dispatch(ConfigGen.createBootstrapStatusLoaded({bootstrapStatus}))
        resolve(bootstrapStatus)
      })
      .catch(error => {
        reject(error)
      })
  })

function _bootstrapSuccess(action: ConfigGen.BootstrapSuccessPayload, state: TypedState) {
  if (!isMobile) {
    return null
  }

  const actions = []
  const pushLoaded = state.config.pushLoaded
  const loggedIn = loggedInSelector(state)
  if (!pushLoaded && loggedIn) {
    if (!isSimulator) {
      actions.push(Saga.put(createConfigurePush()))
    }
    actions.push(Saga.put(ConfigGen.createPushLoaded({pushLoaded: true})))
  }

  return Saga.all(actions)
}

function* configSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(ConfigGen.bootstrapSuccess, _bootstrapSuccess)
  yield Saga.safeTakeEvery(ConfigGen.bootstrap, _bootstrap)
  yield Saga.safeTakeEveryPure(ConfigGen.clearRouteState, _clearRouteState)
  yield Saga.safeTakeEvery(ConfigGen.persistRouteState, _persistRouteState)
  yield Saga.safeTakeEvery(ConfigGen.retryBootstrap, _retryBootstrap)
}

export {getExtendedStatus}
export default configSaga
