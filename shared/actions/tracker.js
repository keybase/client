/* @flow */

import * as Constants from '../constants/tracker'
import {routeAppend} from './router'
import engine from '../engine'
import {createServer} from '../engine/server'
import {flattenCallMap, promisifyResponses} from '../engine/call-map-middleware'

import setNotifications from '../util/setNotifications'

import type {State as RootTrackerState} from '../reducers/tracker'
import type {ConfigState} from '../reducers/config'

import type {CallMap} from '../engine/call-map-middleware'
import type {Action, Dispatch} from '../constants/types/flux'

import type {RemoteProof, LinkCheckResult, TrackOptions, UserCard, delegateUiCtl_registerIdentifyUI_rpc,
  track_checkTracking_rpc, track_untrack_rpc, track_trackWithToken_rpc, incomingCallMapType} from '../constants/types/flow-types'

type TrackerActionCreator = (dispatch: Dispatch, getState: () => {tracker: RootTrackerState}) => void

// TODO make actions for all the call back stuff.

export function startTimer (): TrackerActionCreator {
  return (dispatch, getState) => {
    // Increments timerActive as a count of open tracker popups.
    dispatch({type: Constants.startTimer})
    const timerActive = getState().tracker.timerActive
    if (timerActive === 1) {
      // We're transitioning from 0->1, no tracker popups to one, start timer.
      const intervalId = setInterval(() => {
        const timerActive = getState().tracker.timerActive
        if (timerActive <= 0) {
          // All popups are closed now.
          clearInterval(intervalId)
        }

        const params : track_checkTracking_rpc = {
          method: 'track.checkTracking',
          param: {},
          incomingCallMap: {},
          callback: null
        }

        engine.rpc(params)
      }, Constants.rpcUpdateTimerSeconds)
    }
  }
}

export function stopTimer (): Action {
  return {
    type: Constants.stopTimer
  }
}

export function registerTrackerChangeListener (): TrackerActionCreator {
  return dispatch => {
    const params: incomingCallMapType = {
      'keybase.1.NotifyTracking.trackingChanged': args => {
        dispatch({
          type: Constants.userUpdated,
          payload: args
        })
      }
    }

    engine.listenGeneralIncomingRpc(params)
    setNotifications({tracking: true})
  }
}

export function registerIdentifyUi (): TrackerActionCreator {
  return (dispatch, getState) => {
    engine.listenOnConnect('registerIdentifyUi', () => {
      const params : delegateUiCtl_registerIdentifyUI_rpc = {
        method: 'delegateUiCtl.registerIdentifyUI',
        param: {},
        incomingCallMap: {},
        callback: (error, response) => {
          if (error != null) {
            console.error('error in registering identify ui: ', error)
          } else {
            console.log('Registered identify ui')
          }
        }
      }

      engine.rpc(params)
    })

    createServer(
      engine,
      'keybase.1.identifyUi.delegateIdentifyUI',
      'keybase.1.identifyUi.finish',
      () => serverCallMap(dispatch, getState)
    )

    dispatch({
      type: Constants.registerIdentifyUi,
      payload: {
        started: true
      }
    })
  }
}

export function pushDebugTracker (username: string): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch({
      type: Constants.updateUsername,
      payload: {username}
    })

    dispatch(routeAppend([{path: 'tracker', username}]))
  }
}

export function onFollowChecked (newFollowCheckedValue: boolean, username: string): Action {
  console.log('follow checked:', newFollowCheckedValue)
  return {
    type: Constants.onFollowChecked,
    payload: {
      shouldFollow: newFollowCheckedValue,
      username
    }
  }
}

export function onRefollow (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    console.log('onRefollow')
    const {trackToken} = (getState().tracker.trackers[username] || {})
    const dispatchAction = () => {
      dispatch({
        type: Constants.onRefollow,
        payload: {username}
      })
    }

    dispatch(onUserTrackingLoading(username))
    trackUser(trackToken)
      .then(dispatchAction)
      .catch(err => {
        console.error(`Couldn't track user:`, err)
        dispatchAction()
      })
  }
}

function onUserTrackingLoading (username: string): Action {
  return {
    type: Constants.onUserTrackingLoading,
    payload: {username}
  }
}

export function onUnfollow (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const params : track_untrack_rpc = {
      method: 'track.untrack',
      param: {username},
      incomingCallMap: {},
      callback: (err, response) => {
        if (err) {
          console.log('err untracking', err)
        } else {
          dispatch({
            type: Constants.reportLastTrack,
            payload: {username}
          })
          console.log('success in untracking')
        }
      }
    }

    engine.rpc(params)

    dispatch({
      type: Constants.onUnfollow,
      payload: {username}
    })
  }
}

export function onFollowHelp (username: string): Action {
  window.open('https://keybase.io/docs/tracking') // TODO
  return {
    type: Constants.onFollowHelp,
    payload: {username}
  }
}

function trackUser (trackToken: ?string): Promise<boolean> {
  const options: TrackOptions = {
    localOnly: false,
    bypassConfirm: false,
    forceRetrack: false
  }

  return new Promise((resolve, reject) => {
    if (trackToken != null) {
      const params : track_trackWithToken_rpc = {
        method: 'track.trackWithToken',
        param: {trackToken, options},
        incomingCallMap: {},
        callback: (err, response) => {
          if (err) {
            console.log('error: Track with token: ', err)
            reject(err)
          }

          console.log('Finished tracking', response)
          resolve(true)
        }
      }

      engine.rpc(params)
    } else {
      resolve(false)
    }
  })
}

export function onCloseFromActionBar (username: string): (dispatch: Dispatch, getState: () => {tracker: RootTrackerState}) => void {
  return (dispatch, getState) => {
    const trackerState = getState().tracker.trackers[username]
    const {shouldFollow} = trackerState
    const {trackToken} = (trackerState || {})

    const dispatchCloseAction = () => dispatch({type: Constants.onCloseFromActionBar, payload: {username}})

    if (shouldFollow) {
      dispatch(onUserTrackingLoading(username))
      trackUser(trackToken)
        .then(dispatchCloseAction)
        .catch(err => {
          console.error('Couldn\'t track user:', err)
          dispatchCloseAction()
        })
    } else {
      dispatchCloseAction()
    }
  }
}

export function onCloseFromHeader (username: string): Action {
  return {
    type: Constants.onCloseFromHeader,
    payload: {username}
  }
}

function updateUserInfo (userCard: UserCard, username: string, getState: () => {tracker: RootTrackerState, config: ConfigState}): Action {
  const config = getState().config.config
  const serverURI = config && config.serverURI
  return {
    type: Constants.updateUserInfo,
    payload: {
      userInfo: {
        fullname: userCard.fullName,
        followersCount: userCard.followers,
        followingCount: userCard.following,
        followsYou: userCard.theyFollowYou,
        avatar: `${serverURI}/${username}/picture`,
        location: userCard.location
      },
      username
    }
  }
}

// TODO: if we get multiple tracker calls we should cancel one of the sessionIDs, now they'll clash
function serverCallMap (dispatch: Dispatch, getState: Function): CallMap {
  /* eslint-disable arrow-parens */
  const sessionIDToUsername: { [key: number]: string } = {}

  // TODO the promisifyResponses is actually dangerous. you can't send errors back and it makes typing it more difficult
  const identifyUi = {
    start: params => {
      const {username, sessionID, reason} = params
      sessionIDToUsername[sessionID] = username

      dispatch({
        type: Constants.updateUsername,
        payload: {username}
      })

      dispatch({
        type: Constants.updateReason,
        payload: {username, reason: reason && reason.reason}
      })

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {username, active: true}
      })

      dispatch({
        type: Constants.reportLastTrack,
        payload: {username}
      })
    },
    displayKey: params => {
    },
    reportLastTrack: params => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch({
        type: Constants.reportLastTrack,
        payload: {
          username,
          track: params.track
        }
      })
    },

    launchNetworkChecks: params => {
      const username = sessionIDToUsername[params.sessionID]
      // This is the first spot that we have access to the user, so let's use that to get
      // The user information

      dispatch({
        type: Constants.setProofs,
        payload: {
          identity: params.identity,
          username
        }
      })
      dispatch({type: Constants.updateProofState, payload: {username}})
    },

    displayTrackStatement: params => {
    },

    finishWebProofCheck: params => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateProof(params.rp, params.lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})
      dispatch({type: Constants.decideToShowTracker, payload: {username}})
    },
    finishSocialProofCheck: params => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateProof(params.rp, params.lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})
      dispatch({type: Constants.decideToShowTracker, payload: {username}})
    },
    displayCryptocurrency: params => {
    },
    displayUserCard: params => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateUserInfo(params.card, username, getState))
    },
    reportTrackToken: params => {
      const username = sessionIDToUsername[params.sessionID]
      const {trackToken} = params
      dispatch({type: Constants.updateTrackToken, payload: {username, trackToken}})
    },
    confirm: params => {
      return {
        identityConfirmed: false,
        remoteConfirmed: false
      }
    },
    finish: params => {
      const username = sessionIDToUsername[params.sessionID]
      // Check if there were any errors in the proofs
      dispatch({type: Constants.updateProofState, payload: {username}})

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {
          active: false,
          username
        }
      })
    }
  }

  return promisifyResponses(flattenCallMap({keybase: {'1': {identifyUi}}}))
  /* eslint-enable arrow-parens */
}

function updateProof (remoteProof: RemoteProof, linkCheckResult: LinkCheckResult, username: string): Action {
  return {
    type: Constants.updateProof,
    payload: {remoteProof, linkCheckResult, username}
  }
}
