/* @flow */

import * as Constants from '../constants/tracker'
import {routeAppend} from './router'
import engine from '../engine'
import {createServer} from '../engine/server'
import {flattenCallMap, promisifyResponses} from '../engine/call-map-middleware'

import type {State as RootTrackerState} from '../reducers/tracker'
import type {ConfigState} from '../reducers/config'

import type {CallMap} from '../engine/call-map-middleware'
import type {Action, Dispatch} from '../constants/types/flux'

import type {Identity, IdentifyKey, TrackSummary, User, Cryptocurrency, IdentifyOutcome, RemoteProof, LinkCheckResult, TrackOptions, UserCard} from '../constants/types/flow-types'

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
        engine.rpc('track.checkTracking')
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
    const param = {
      channels: {
        tracking: true
      }
    }
    engine.listenGeneralIncomingRpc('keybase.1.NotifyTracking.trackingChanged', function (args) {
      dispatch({
        type: Constants.userUpdated,
        payload: args
      })
    })

    engine.listenOnConnect(() => {
      engine.rpc('notifyCtl.setNotifications', param, {}, (error, response) => {
        if (error != null) {
          console.error('error in toggling notifications: ', error)
        }
      })
    })
  }
}

export function registerIdentifyUi (): TrackerActionCreator {
  return (dispatch, getState) => {
    engine.rpc('delegateUiCtl.registerIdentifyUI', {}, {}, (error, response) => {
      if (error != null) {
        console.error('error in registering identify ui: ', error)
      }
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
    trackUser(username, getState())
    dispatch({
      type: Constants.onRefollow,
      payload: {username}
    })
  }
}

export function onUnfollow (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    engine.rpc('track.untrack', {username}, {}, (err, response) => {
      if (err) {
        console.log('err untracking', err)
      } else {
        dispatch({
          type: Constants.reportLastTrack,
          payload: {username}
        })
        console.log('success in untracking')
      }
    })

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

function trackUser (username: string, state: {tracker: RootTrackerState}): Promise<boolean> {
  const trackers = state.tracker.trackers
  const trackerState = trackers[username]
  const {shouldFollow, trackToken} = (trackerState || {})

  const options: TrackOptions = {
    localOnly: false,
    bypassConfirm: false
  }

  if (trackerState && trackToken && shouldFollow) {
    return new Promise((resolve, reject) => {
      engine.rpc('track.trackWithToken', {trackToken, options}, {}, (err, response) => {
        if (err) {
          console.log('error: Track with token: ', err)
          reject(err)
        }

        console.log('Finished tracking', response)
        resolve(true)
      })
    })
  }

  return Promise.resolve(false)
}

export function onCloseFromActionBar (username: string): (dispatch: Dispatch, getState: () => {tracker: RootTrackerState}) => void {
  return (dispatch, getState) => {
    trackUser(username, getState())

    dispatch({
      type: Constants.onCloseFromActionBar,
      payload: {username}
    })
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
  const identifyUi = {
    start: (params: {sessionID: number, username: string}) => {
      const {username, sessionID} = params
      sessionIDToUsername[sessionID] = username

      dispatch({
        type: Constants.updateUsername,
        payload: {username}
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
    displayKey: (params: {sessionID: number, key: IdentifyKey}) => {
    },
    reportLastTrack: (params: {sessionID: number, track: ?TrackSummary}) => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch({
        type: Constants.reportLastTrack,
        payload: {
          username,
          track: params.track
        }
      })
    },

    launchNetworkChecks: (params: {sessionID: number, identity: Identity, user: User}) => {
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

    displayTrackStatement: (params: {sessionID: number, stmt: string}) => {
    },

    finishWebProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateProof(params.rp, params.lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})
      dispatch({type: Constants.decideToShowTracker, payload: {username}})
    },
    finishSocialProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateProof(params.rp, params.lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})
      dispatch({type: Constants.decideToShowTracker, payload: {username}})
    },
    displayCryptocurrency: (params: {sessionID: number, c: Cryptocurrency}) => {
    },
    displayUserCard: (params: {sessionID: number, card: UserCard}) => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateUserInfo(params.card, username, getState))
    },
    reportTrackToken: (params: {sessionID: number, trackToken: string}) => {
      const username = sessionIDToUsername[params.sessionID]
      const {trackToken} = params
      dispatch({type: Constants.updateTrackToken, payload: {username, trackToken}})
    },
    confirm: (params: {sessionID: number, outcome: IdentifyOutcome}): bool => {
      return false
    },
    finish: (params: {sessionID: number}) => {
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
