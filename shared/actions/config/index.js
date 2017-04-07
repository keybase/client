// @flow
import * as Constants from '../../constants/config'
import engine from '../../engine'
import {CommonClientType, configGetConfigRpc, configGetExtendedStatusRpc, configGetCurrentStatusRpc, configWaitForClientRpc, userListTrackingRpc, userListTrackersByNameRpc, userLoadUncheckedUserSummariesRpc} from '../../constants/types/flow-types'
import {isMobile} from '../../constants/platform'
import {listenForKBFSNotifications} from '../../actions/notifications'
import {navBasedOnLoginState} from '../../actions/login/creators'
import {checkReachabilityOnConnect, registerGregorListeners, registerReachability, listenForNativeReachabilityEvents} from '../../actions/gregor'
import {resetSignup} from '../../actions/signup'

import type {Tab} from '../../constants/tabs'
import type {UpdateFollowing} from '../../constants/config'
import type {AsyncAction} from '../../constants/types/flux'

// TODO convert to sagas

isMobile && module.hot && module.hot.accept(() => {
  console.log('accepted update in actions/config')
})

const setInitialTab = (tab: ?Tab): Constants.SetInitialTab => (
  {payload: {tab}, type: 'config:setInitialTab'}
)

const setLaunchedViaPush = (pushed: boolean): Constants.SetLaunchedViaPush => (
  {payload: pushed, type: 'config:setLaunchedViaPush'}
)

const getConfig = (): AsyncAction => (dispatch, getState) => (
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
)

function isFollower (getState: any, username: string): boolean {
  return !!getState().config.followers[username]
}

const getMyFollowers = (username: string): AsyncAction => dispatch => {
  userListTrackersByNameRpc({
    callback: (error, trackers) => {
      if (error) {
        return
      }

      if (trackers && trackers.length) {
        const uids = trackers.map(t => t.tracker)
        userLoadUncheckedUserSummariesRpc({
          callback: (error, summaries) => {
            if (error) {
              return
            }

            const followers = {}
            summaries && summaries.forEach(s => { followers[s.username] = true })
            dispatch({
              payload: {followers},
              type: Constants.setFollowers,
            })
          },
          param: {uids},
        })
      }
    },
    param: {username},
  })
}

function isFollowing (getState: () => any, username: string) : boolean {
  return !!getState().config.following[username]
}

const getMyFollowing = (username: string): AsyncAction => dispatch => {
  userListTrackingRpc({
    callback: (error, summaries) => {
      if (error) {
        return
      }

      const following = {}
      summaries && summaries.forEach(s => { following[s.username] = true })
      dispatch({
        payload: {following},
        type: Constants.setFollowing,
      })
    },
    param: {assertion: username, filter: ''},
  })
}

const waitForKBFS = (): AsyncAction => dispatch => (
  new Promise((resolve, reject) => {
    configWaitForClientRpc({
      callback: (error, found) => {
        if (error) {
          reject(error)
          return
        }
        if (!found) {
          reject(new Error('Waited for KBFS client, but it wasn\'t not found'))
          return
        }
        resolve()
      },
      param: {clientType: CommonClientType.kbfs, timeout: 10.0},
    })
  })
)

const getExtendedStatus = (): AsyncAction => dispatch => (
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
)

const registerListeners = (): AsyncAction => dispatch => {
  dispatch(listenForNativeReachabilityEvents)
  dispatch(registerGregorListeners())
  dispatch(registerReachability())
}

const retryBootstrap = (): AsyncAction => (dispatch, getState) => {
  dispatch({payload: null, type: Constants.bootstrapRetry})
  dispatch(bootstrap())
}

const daemonError = (error: ?string): Constants.DaemonError => (
  {payload: {daemonError: error ? new Error(error) : null}, type: Constants.daemonError}
)

let bootstrapSetup = false
type BootstrapOptions = {isReconnect?: boolean}

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
    engine().listenOnDisconnect('daemonError', () => {
      dispatch(daemonError('Disconnected'))
    })
    dispatch(registerListeners())
  } else {
    console.log('[bootstrap] performing bootstrap...')
    Promise.all(
      [dispatch(getCurrentStatus()), dispatch(getExtendedStatus()), dispatch(getConfig()), dispatch(waitForKBFS())]).then(([username]) => {
        if (username) {
          dispatch(getMyFollowers(username))
          dispatch(getMyFollowing(username))
        }
        dispatch({payload: null, type: Constants.bootstrapped})
        dispatch(listenForKBFSNotifications())
        if (!opts.isReconnect) {
          dispatch(navBasedOnLoginState())
          dispatch(resetSignup())
        }
      }).catch(error => {
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

const getCurrentStatus = (): AsyncAction => dispatch => (
  new Promise((resolve, reject) => {
    configGetCurrentStatusRpc({
      callback: (error, status) => {
        if (error) {
          reject(error)
          return
        }

        dispatch({
          payload: {status},
          type: Constants.statusLoaded,
        })

        resolve(status && status.user && status.user.username)
      },
    })
  })
)

const updateFollowing = (username: string, isTracking: boolean): UpdateFollowing => (
  {payload: {username, isTracking}, type: Constants.updateFollowing}
)

export {
  bootstrap,
  getExtendedStatus,
  isFollower,
  isFollowing,
  retryBootstrap,
  setInitialTab,
  setLaunchedViaPush,
  updateFollowing,
  waitForKBFS,
}
