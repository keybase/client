// @flow
import * as Constants from '../../constants/config'
import * as Creators from './creators'
import engine from '../../engine'
import {
  CommonClientType,
  configGetBootstrapStatusRpc,
  configGetConfigRpc,
  configGetExtendedStatusRpc,
  configWaitForClientRpc,
} from '../../constants/types/flow-types'
import {isMobile, isSimulator} from '../../constants/platform'
import {listenForKBFSNotifications} from '../../actions/notifications'
import {navBasedOnLoginState} from '../../actions/login/creators'
import {
  checkReachabilityOnConnect,
  registerGregorListeners,
  registerReachability,
  listenForNativeReachabilityEvents,
} from '../../actions/gregor'
import {resetSignup} from '../../actions/signup'
import * as Saga from '../../util/saga'
import {configurePush} from '../push/creators'
import {put, select} from 'redux-saga/effects'
import {loggedInSelector} from '../../constants/selectors'

import type {TypedState} from '../../constants/reducer'
import type {SagaGenerator} from '../../constants/types/saga'
import type {Tab} from '../../constants/tabs'
import type {UpdateFollowing} from '../../constants/config'
import type {AsyncAction} from '../../constants/types/flux'

// TODO convert to sagas

isMobile &&
  module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in actions/config')
  })

const setInitialTab = (tab: ?Tab): Constants.SetInitialTab => ({payload: {tab}, type: 'config:setInitialTab'})

const setInitialLink = (url: ?string): Constants.SetInitialLink => ({
  payload: {url},
  type: 'config:setInitialLink',
})

const setLaunchedViaPush = (pushed: boolean): Constants.SetLaunchedViaPush => ({
  payload: pushed,
  type: 'config:setLaunchedViaPush',
})

const getConfig = (): AsyncAction => (dispatch, getState) =>
  new Promise((resolve, reject) => {
    configGetConfigRpc({
      callback: (error, config) => {
        if (error) {
          reject(error)
          return
        }

        dispatch({payload: {config}, type: Constants.configLoaded})
        resolve()
      },
    })
  })

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

    configWaitForClientRpc({
      callback: (error, found) => {
        clearTimeout(timer)

        if (timedOut) {
          return
        }
        if (error) {
          reject(error)
          return
        }
        if (!found) {
          reject(new Error("Waited for KBFS client, but it wasn't not found"))
          return
        }
        resolve()
      },
      param: {clientType: CommonClientType.kbfs, timeout: 10.0},
    })
  })

const getExtendedStatus = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    configGetExtendedStatusRpc({
      callback: (error, extendedConfig) => {
        if (error) {
          reject(error)
          return
        }

        dispatch({payload: {extendedConfig}, type: Constants.extendedConfigLoaded})
        resolve(extendedConfig)
      },
    })
  })

const registerListeners = (): AsyncAction => dispatch => {
  dispatch(listenForNativeReachabilityEvents)
  dispatch(registerGregorListeners())
  dispatch(registerReachability())
}

const retryBootstrap = (): AsyncAction => (dispatch, getState) => {
  dispatch({payload: null, type: Constants.bootstrapRetry})
  dispatch(bootstrap())
}

const daemonError = (error: ?string): Constants.DaemonError => ({
  payload: {daemonError: error ? new Error(error) : null},
  type: Constants.daemonError,
})

let bootstrapSetup = false
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
      dispatch(daemonError(null))
      dispatch(checkReachabilityOnConnect())
      console.log('[bootstrap] bootstrapping on connect')
      dispatch(bootstrap())
    })
    dispatch(registerListeners())
  } else {
    console.log('[bootstrap] performing bootstrap...')
    Promise.all([dispatch(getBootstrapStatus()), dispatch(waitForKBFS())])
      .then(() => {
        dispatch({type: 'config:bootstrapSuccess', payload: undefined})
        engine().listenOnDisconnect('daemonError', () => {
          dispatch(daemonError('Disconnected'))
        })
        dispatch(listenForKBFSNotifications())
        if (!opts.isReconnect) {
          dispatch(navBasedOnLoginState())
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
      })
  }
}

const getBootstrapStatus = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    configGetBootstrapStatusRpc({
      callback: (error, bootstrapStatus) => {
        if (error) {
          reject(error)
          return
        }

        dispatch({
          payload: {bootstrapStatus},
          type: Constants.bootstrapStatusLoaded,
        })

        resolve(bootstrapStatus)
      },
    })
  })

const updateFollowing = (username: string, isTracking: boolean): UpdateFollowing => ({
  payload: {username, isTracking},
  type: Constants.updateFollowing,
})

function* _bootstrapSuccessSaga(): SagaGenerator<any, any> {
  if (isMobile) {
    const pushLoaded = yield select(({config: {pushLoaded}}: TypedState) => pushLoaded)
    const loggedIn = yield select(loggedInSelector)
    if (!pushLoaded && loggedIn) {
      if (!isSimulator) {
        yield put(configurePush())
      }
      yield put(Creators.pushLoaded(true))
    }
  }
}

function* configSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('config:bootstrapSuccess', _bootstrapSuccessSaga)
}

export {
  bootstrap,
  getConfig,
  getExtendedStatus,
  isFollower,
  isFollowing,
  retryBootstrap,
  setInitialTab,
  setInitialLink,
  setLaunchedViaPush,
  updateFollowing,
  waitForKBFS,
}

export default configSaga
