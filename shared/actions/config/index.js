// @flow
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/config'
import * as GregorCreators from '../../actions/gregor'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import engine from '../../engine'
import {RouteStateStorage} from '../../actions/route-state-storage'
import {configurePush} from '../push/creators'
import {flushLogFile} from '../../util/forward-logs'
import {fuseStatus} from '../../actions/kbfs'
import {isMobile, isSimulator} from '../../constants/platform'
import {listenForKBFSNotifications} from '../../actions/notifications'
import {loggedInSelector} from '../../constants/selectors'
import {navBasedOnLoginAndInitialState} from '../../actions/login/creators'
import {put, select} from 'redux-saga/effects'
import {resetSignup} from '../../actions/signup'
import {type AsyncAction} from '../../constants/types/flux'
import {type TypedState} from '../../constants/reducer'

// TODO convert to sagas

isMobile &&
  module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in actions/config')
  })

// const getConfig = (): AsyncAction => (dispatch, getState) =>
// new Promise((resolve, reject) => {
// RPCTypes.configGetConfigRpcPromise()
// .then(config => {
// dispatch({payload: {config}, type: Constants.configLoaded})
// resolve()
// })
// .catch(error => {
// reject(error)
// })
// })

function isFollower(getState: any, username: string): boolean {
  return !!getState().config.followers[username]
}

function isFollowing(getState: () => any, username: string): boolean {
  return !!getState().config.following[username]
}

const waitForKBFS = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    let timedOut = false

    // The rpc timeout doesn't seem to work correctly (not that we should trust that anyways) so we have our own local timeout
    // TODO clean this up with sagas!
    let timer = setTimeout(() => {
      timedOut = true
      reject(new Error("Waited for KBFS client, but it wasn't not found"))
    }, 10 * 1000)

    RPCTypes.configWaitForClientRpcPromise({
      param: {clientType: RPCTypes.CommonClientType.kbfs, timeout: 10.0},
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

const getExtendedStatus = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    RPCTypes.configGetExtendedStatusRpcPromise()
      .then(extendedConfig => {
        dispatch({payload: {extendedConfig}, type: Constants.extendedConfigLoaded})
        resolve(extendedConfig)
      })
      .catch(error => {
        reject(error)
      })
  })

const registerListeners = (): AsyncAction => dispatch => {
  dispatch(GregorCreators.listenForNativeReachabilityEvents)
  dispatch(GregorCreators.registerGregorListeners())
  dispatch(GregorCreators.registerReachability())
}

const retryBootstrap = (): AsyncAction => (dispatch, getState) => {
  dispatch({payload: null, type: Constants.bootstrapRetry})
  dispatch(bootstrap())
}

// TODO: It's unfortunate that we have these globals. Ideally,
// bootstrap would be a method on an object.
let bootstrapSetup = false
const routeStateStorage = new RouteStateStorage()
type BootstrapOptions = {isReconnect?: boolean}

// TODO: We REALLY need to saga-ize this.

const bootstrap = (opts?: BootstrapOptions = {}): AsyncAction => (dispatch, getState) => {
  const readyForBootstrap = getState().config.readyForBootstrap
  if (!readyForBootstrap) {
    console.warn('Not ready for bootstrap/connect')
    return
  }

  if (!bootstrapSetup) {
    bootstrapSetup = true
    console.log('[bootstrap] registered bootstrap')
    engine().listenOnConnect('bootstrap', () => {
      dispatch(ConfigGen.createDaemonError({error: null}))
      dispatch(GregorCreators.checkReachabilityOnConnect())
      console.log('[bootstrap] bootstrapping on connect')
      dispatch(bootstrap())
    })
    dispatch(registerListeners())
  } else {
    console.log('[bootstrap] performing bootstrap...')
    Promise.all([dispatch(getBootstrapStatus()), dispatch(waitForKBFS()), dispatch(fuseStatus())])
      .then(() => {
        dispatch({type: 'config:bootstrapSuccess', payload: undefined})
        engine().listenOnDisconnect('daemonError', () => {
          dispatch(ConfigGen.createDaemonError({error: new Error('Disconnected')}))
          flushLogFile()
        })
        dispatch(listenForKBFSNotifications())
        if (!opts.isReconnect) {
          dispatch(async (): Promise<*> => {
            await dispatch(navBasedOnLoginAndInitialState())
            if (getState().config.loggedIn) {
              // If we're logged in, restore any saved route state and
              // then nav again based on it.
              await dispatch(routeStateStorage.load)
              await dispatch(navBasedOnLoginAndInitialState())
            }
          })
          dispatch(resetSignup())
        }
      })
      .catch(error => {
        console.warn('[bootstrap] error bootstrapping: ', error)
        const triesRemaining = getState().config.bootstrapTriesRemaining
        dispatch({payload: null, type: Constants.bootstrapAttemptFailed})
        if (triesRemaining > 0) {
          const retryDelay = Constants.bootstrapRetryDelay / triesRemaining
          console.log(`[bootstrap] resetting engine in ${retryDelay / 1000}s (${triesRemaining} tries left)`)
          setTimeout(() => engine().reset(), retryDelay)
        } else {
          console.error('[bootstrap] exhausted bootstrap retries')
          dispatch({payload: {error}, type: Constants.bootstrapFailed})
        }
        flushLogFile()
      })
  }
}

const persistRouteState: AsyncAction = routeStateStorage.store
const clearRouteState: AsyncAction = routeStateStorage.clear

const getBootstrapStatus = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    RPCTypes.configGetBootstrapStatusRpcPromise()
      .then(bootstrapStatus => {
        dispatch({
          payload: {bootstrapStatus},
          type: Constants.bootstrapStatusLoaded,
        })

        resolve(bootstrapStatus)
      })
      .catch(error => {
        reject(error)
      })
  })

function* _bootstrapSuccessSaga(): Saga.SagaGenerator<any, any> {
  if (isMobile) {
    const pushLoaded = yield select(({config: {pushLoaded}}: TypedState) => pushLoaded)
    const loggedIn = yield select(loggedInSelector)
    if (!pushLoaded && loggedIn) {
      if (!isSimulator) {
        yield put(configurePush())
      }
      yield put(ConfigGen.createPushLoaded({isLoaded: true}))
    }
  }
}

function* configSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('config:bootstrapSuccess', _bootstrapSuccessSaga)
}

export {
  bootstrap,
  clearRouteState,
  // getConfig,
  getExtendedStatus,
  isFollower,
  isFollowing,
  persistRouteState,
  retryBootstrap,
  waitForKBFS,
}

export default configSaga
