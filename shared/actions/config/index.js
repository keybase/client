// @flow
import * as Constants from '../../constants/config'
import engine from '../../engine'
import {configGetConfigRpc, configGetExtendedStatusRpc, configGetCurrentStatusRpc, userListTrackingRpc, userListTrackersByNameRpc, userLoadUncheckedUserSummariesRpc} from '../../constants/types/flow-types'
import {isMobile} from '../../constants/platform'
import {navBasedOnLoginState} from '../../actions/login'
import {registerGregorListeners} from '../../actions/gregor'
import {resetSignup} from '../../actions/signup'

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

          dispatch({type: Constants.configLoaded, payload: {config}})
          resolve()
        },
      })
    })
  }
}

export function isFollower (getState: any, username: string) : boolean {
  return !!getState().config.followers[username]
}

function getMyFollowers (username: string): AsyncAction {
  return dispatch => {
    userListTrackersByNameRpc({
      param: {username},
      callback: (error, trackers) => {
        if (error) {
          return
        }

        if (trackers && trackers.length) {
          const uids = trackers.map(t => t.tracker)
          userLoadUncheckedUserSummariesRpc({
            param: {uids},
            callback: (error, summaries) => {
              if (error) {
                return
              }

              const followers = {}
              summaries && summaries.forEach(s => { followers[s.username] = true })
              dispatch({
                type: Constants.updateFollowers,
                payload: {followers},
              })
            },
          })
        }
      },
    })
  }
}

export function isFollowing (getState: () => any, username: string) : boolean {
  return !!getState().config.following[username]
}

function getMyFollowing (username: string): AsyncAction {
  return dispatch => {
    userListTrackingRpc({
      param: {assertion: username, filter: ''},
      callback: (error, summaries) => {
        if (error) {
          return
        }

        const following = {}
        summaries && summaries.forEach(s => { following[s.username] = true })
        dispatch({
          type: Constants.updateFollowing,
          payload: {following},
        })
      },
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

          dispatch({type: Constants.extendedConfigLoaded, payload: {extendedConfig}})
          resolve(extendedConfig)
        },
      })
    })
  }
}

function _registerListeners (): AsyncAction {
  return dispatch => {
    dispatch(registerGregorListeners())
  }
}

export function retryBootstrap (): AsyncAction {
  return (dispatch, getState) => {
    dispatch({type: Constants.bootstrapRetry, payload: null})
    dispatch(bootstrap())
  }
}

let bootstrapSetup = false
export function bootstrap (): AsyncAction {
  return (dispatch, getState) => {
    const state = getState()
    if (!bootstrapSetup) {
      bootstrapSetup = true
      console.log('[bootstrap] registered bootstrap')
      engine().listenOnConnect('bootstrap', () => {
        console.log('[bootstrap] bootstrapping on connect')
        dispatch(bootstrap())
      })
    } else if (state.dev && state.dev.reloading) {
      // Let's still register the listeners
      dispatch(_registerListeners())
    } else {
      console.log('[bootstrap] performing bootstrap...')
      Promise.all(
        [dispatch(getCurrentStatus()), dispatch(getExtendedStatus()), dispatch(getConfig())]).then(([username]) => {
          if (username) {
            dispatch(getMyFollowers(username))
            dispatch(getMyFollowing(username))
          }
          dispatch({type: Constants.bootstrapped, payload: null})
          dispatch(navBasedOnLoginState())
          dispatch((resetSignup(): Action))
          dispatch(_registerListeners())
        }).catch(error => {
          console.warn('[bootstrap] error bootstrapping: ', error)
          const triesRemaining = getState().config.bootstrapTriesRemaining
          dispatch({type: Constants.bootstrapAttemptFailed, payload: null})
          if (triesRemaining > 0) {
            const retryDelay = Constants.bootstrapRetryDelay / triesRemaining
            console.log(`[bootstrap] resetting engine in ${retryDelay / 1000}s (${triesRemaining} tries left)`)
            setTimeout(() => engine().reset(), retryDelay)
          } else {
            console.error('[bootstrap] exhausted bootstrap retries')
            dispatch({type: Constants.bootstrapFailed, payload: {error}})
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
            type: Constants.statusLoaded,
            payload: {status},
          })

          resolve(status && status.user && status.user.username)
        },
      })
    })
  }
}

export {getExtendedStatus}
