// @flow
import * as Constants from '../../constants/config'
import engine from '../../engine'
import {CommonClientType, configGetConfigRpc, configGetExtendedStatusRpc, configGetCurrentStatusRpc, configWaitForClientRpc, userListTrackingRpc, userListTrackersByNameRpc, userLoadUncheckedUserSummariesRpc} from '../../constants/types/flow-types'
import {isMobile} from '../../constants/platform'
import {listenForKBFSNotifications} from '../../actions/notifications'
import {navBasedOnLoginState} from '../../actions/login'
import {registerGregorListeners, registerReachability} from '../../actions/gregor'
import {resetSignup} from '../../actions/signup'

import type {UpdateFollowing} from '../../constants/config'
import type {AsyncAction, Action} from '../../constants/types/flux'

isMobile && module.hot && module.hot.accept(() => {
  console.log('accepted update in actions/config')
})

function getConfig (): AsyncAction {
  return (dispatch, getState) => {
    return new Promise((resolve, reject) => {
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
  }
}

function isFollower (getState: any, username: string): boolean {
  return !!getState().config.followers[username]
}

function getMyFollowers (username: string): AsyncAction {
  return dispatch => {
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
}

function isFollowing (getState: () => any, username: string) : boolean {
  return !!getState().config.following[username]
}

function getMyFollowing (username: string): AsyncAction {
  return dispatch => {
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
}

function waitForKBFS (): AsyncAction {
  return dispatch => {
    return new Promise((resolve, reject) => {
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
  }
}

function getExtendedStatus (): AsyncAction {
  return dispatch => {
    return new Promise((resolve, reject) => {
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
  }
}

function registerListeners (): AsyncAction {
  return dispatch => {
    dispatch(registerGregorListeners())
    if (!isMobile) {
      dispatch(registerReachability())
    }
  }
}

function retryBootstrap (): AsyncAction {
  return (dispatch, getState) => {
    dispatch({payload: null, type: Constants.bootstrapRetry})
    dispatch(bootstrap())
  }
}

function daemonError (error: ?string): Action {
  return {payload: {daemonError: error ? new Error(error) : null}, type: Constants.daemonError}
}

let bootstrapSetup = false
type BootstrapOptions = {isReconnect?: boolean}
function bootstrap (opts?: BootstrapOptions = {}): AsyncAction {
  return (dispatch, getState) => {
    if (!bootstrapSetup) {
      bootstrapSetup = true
      console.log('[bootstrap] registered bootstrap')
      engine().listenOnConnect('bootstrap', () => {
        dispatch(daemonError(null))
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
            dispatch((resetSignup(): Action))
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
}

function getCurrentStatus (): AsyncAction {
  return dispatch => {
    return new Promise((resolve, reject) => {
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
  }
}

function updateFollowing (username: string, isTracking: boolean): UpdateFollowing {
  return {payload: {username, isTracking}, type: Constants.updateFollowing}
}

export {
  bootstrap,
  getExtendedStatus,
  isFollower,
  isFollowing,
  retryBootstrap,
  updateFollowing,
  waitForKBFS,
}
