/* @flow */
import * as Constants from '../../constants/config'
import engine from '../../engine'

import {navBasedOnLoginState} from '../../actions/login'

// $FlowFixMe
import * as native from './index.native'

import type {AsyncAction} from '../../constants/types/flux'
import type {configGetConfigRpc, configGetExtendedStatusRpc, configGetCurrentStatusRpc,
  userListTrackingRpc, userListTrackersByNameRpc, userLoadUncheckedUserSummariesRpc} from '../../constants/types/flow-types'

function getConfig (): AsyncAction {
  return (dispatch, getState) => {
    return new Promise((resolve, reject) => {
      const params : configGetConfigRpc = {
        method: 'config.getConfig',
        param: {},
        incomingCallMap: {},
        callback: (error, config) => {
          if (error) {
            reject(error)
            return
          }

          dispatch({type: Constants.configLoaded, payload: {config}})
          resolve()
        },
      }

      engine.rpc(params)
    })
  }
}

let followers = {}

export function isFollower (username: string) : boolean {
  return !!followers[username]
}

function getMyFollowers (username: string): AsyncAction {
  return dispatch => {
    const params : userListTrackersByNameRpc = {
      method: 'user.listTrackersByName',
      param: {username},
      incomingCallMap: {},
      callback: (error, trackers) => {
        if (error) {
          return
        }

        const uids = trackers.map(t => t.tracker)
        const params : userLoadUncheckedUserSummariesRpc = {
          method: 'user.loadUncheckedUserSummaries',
          param: {uids},
          incomingCallMap: {},
          callback: (error, summaries) => {
            if (error) {
              return
            }

            followers = {}
            summaries.forEach(s => { followers[s.username] = true })
            dispatch({
              type: Constants.updateFollowers,
              payload: {followers},
            })
          },
        }

        engine.rpc(params)
      },
    }

    engine.rpc(params)
  }
}

let following = {}
export function isFollowing (username: string) : boolean {
  return !!following[username]
}

function getMyFollowing (username: string): AsyncAction {
  return dispatch => {
    const params : userListTrackingRpc = {
      method: 'user.listTracking',
      param: {username, filter: ''},
      incomingCallMap: {},
      callback: (error, summaries) => {
        if (error) {
          return
        }

        following = {}
        summaries.forEach(s => { following[s.username] = true })
        dispatch({
          type: Constants.updateFollowing,
          payload: {following},
        })
      },
    }

    engine.rpc(params)
  }
}

function getExtendedStatus (): AsyncAction {
  return dispatch => {
    return new Promise((resolve, reject) => {
      const params : configGetExtendedStatusRpc = {
        method: 'config.getExtendedStatus',
        param: {},
        incomingCallMap: {},
        callback: (error, extendedConfig) => {
          if (error) {
            reject(error)
            return
          }

          dispatch({type: Constants.extendedConfigLoaded, payload: {extendedConfig}})
          resolve(extendedConfig)
        },
      }

      engine.rpc(params)
    })
  }
}

let bootstrapSetup = false
export function bootstrap (): AsyncAction {
  return dispatch => {
    if (!bootstrapSetup) {
      bootstrapSetup = true
      console.log('Registered bootstrap')
      engine.listenOnConnect('bootstrap', () => {
        console.log('Bootstrapping')
        dispatch(bootstrap())
      })
    } else {
      Promise.all(
        [dispatch(getCurrentStatus()), dispatch(getExtendedStatus()), dispatch(getConfig())]).then(([username]) => {
          if (username) {
            dispatch(getMyFollowers(username))
            dispatch(getMyFollowing(username))
          }
          dispatch({type: Constants.bootstrapped, payload: null})
          dispatch(navBasedOnLoginState())
        }).catch(error => {
          console.warn('Error bootstrapping: ', error)
        })
    }
  }
}

function getCurrentStatus (): AsyncAction {
  return dispatch => {
    return new Promise((resolve, reject) => {
      const params : configGetCurrentStatusRpc = {
        method: 'config.getCurrentStatus',
        param: {},
        incomingCallMap: {},
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
      }

      engine.rpc(params)
    })
  }
}

export function getDevSettings () {
  return native.getDevSettings()
}

export function saveDevSettings () {
  return native.saveDevSettings()
}

export function updateDevSettings (updates: any) {
  return native.updateDevSettings(updates)
}
