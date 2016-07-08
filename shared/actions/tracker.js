/* @flow */

import {showAllTrackers} from '../local-debug'
import * as Constants from '../constants/tracker'
import {routeAppend} from './router'
import engine from '../engine'
import {createServer} from '../engine/server'
import {flattenCallMap, promisifyResponses} from '../engine/call-map-middleware'
import {identifyCommon, Common} from '../constants/types/keybase-v1'
import {isFollowing, isFollower} from '../actions/config'
import _ from 'lodash'

import setNotifications from '../util/set-notifications'

import type {CallMap} from '../engine/call-map-middleware'
import type {State as RootTrackerState} from '../reducers/tracker'
import type {State as FavoriteState} from '../constants/favorite'
import type {ConfigState} from '../reducers/config'
import type {Action, Dispatch} from '../constants/types/flux'

import type {ShowNonUser, TrackingInfo, PendingIdentify} from '../constants/tracker'

import type {RemoteProof, LinkCheckResult, TrackOptions, UserCard, delegateUiCtlRegisterIdentifyUIRpc,
  trackCheckTrackingRpc, trackUntrackRpc, trackTrackWithTokenRpc, incomingCallMapType,
  identifyIdentify2Rpc, trackDismissWithTokenRpc, userListTrackersByNameRpc, UID,
  userLoadUncheckedUserSummariesRpc, UserSummary, userListTrackingRpc} from '../constants/types/flow-types'

type TrackerActionCreator = (dispatch: Dispatch, getState: () => {tracker: RootTrackerState, config: ConfigState, favorite: FavoriteState}) => ?Promise

export function startTimer (): TrackerActionCreator {
  return (dispatch, getState) => {
    // Increments timerActive as a count of open tracker popups.
    dispatch({type: Constants.startTimer, payload: undefined})
    const timerActive = getState().tracker.timerActive
    if (timerActive === 1) {
      // We're transitioning from 0->1, no tracker popups to one, start timer.
      const intervalId = setInterval(() => {
        const timerActive = getState().tracker.timerActive
        if (timerActive <= 0) {
          // All popups are closed now.
          clearInterval(intervalId)
        }

        const params : trackCheckTrackingRpc = {
          method: 'track.checkTracking',
          callback: () => {},
        }

        engine.rpc(params)
      }, Constants.rpcUpdateTimerSeconds)
    }
  }
}

export function stopTimer (): Action {
  return {
    type: Constants.stopTimer,
    payload: null,
  }
}

export function registerTrackerChangeListener (): TrackerActionCreator {
  return dispatch => {
    const params: incomingCallMapType = {
      'keybase.1.NotifyTracking.trackingChanged': args => {
        dispatch({
          type: Constants.userUpdated,
          payload: args,
        })
      },
    }

    engine.listenGeneralIncomingRpc(params)
    setNotifications({tracking: true})
  }
}

export function registerTrackerIncomingRpcs (): TrackerActionCreator {
  return dispatch => {
    dispatch(registerTrackerChangeListener())
  }
}

export function getProfile (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    // If we have a pending identify no point in firing off another one
    if (getState().tracker.pendingIdentifies[username]) {
      return
    }

    dispatch({type: Constants.updateUsername, payload: {username}})
    dispatch(triggerIdentify('', username, true, serverCallMap(dispatch, getState, true)))
    dispatch(fillFolders(getState, username))
  }
}

export function getMyProfile (): TrackerActionCreator {
  return (dispatch, getState) => {
    const status = getState().config.status

    const username = status && status.user && status.user.username
    if (username) {
      dispatch(fillFolders(getState, username))
      dispatch({type: Constants.updateUsername, payload: {username}})
    }

    const myUID = status && status.user && status.user.uid
    if (myUID) {
      dispatch(triggerIdentify(myUID, '', true, serverCallMap(dispatch, getState, true)))
    }
  }
}

const profileReason = 'Profile'

export function triggerIdentify (uid: string = '', userAssertion: string = ''
  , skipPopup: boolean = false, incomingCallMap: Object = {}): TrackerActionCreator {
  let allowSelf
  let useDelegateUI
  let allowEmptySelfID
  let noSkipSelf
  let reason

  if (skipPopup) {
    allowSelf = true
    useDelegateUI = false
    allowEmptySelfID = true
    noSkipSelf = true
    reason = profileReason
  } else {
    allowSelf = false
    useDelegateUI = true
    allowEmptySelfID = false
    noSkipSelf = false
    reason = ''
  }

  return (dispatch, getState) => new Promise((resolve, reject) => {
    dispatch(pendingIdentify(userAssertion || uid, true))

    // In case something explodes, we'll clear the pending Identify after 1 minute
    const clearPendingTimeout = setTimeout(() => {
      dispatch(pendingIdentify(userAssertion || uid, false))
    }, 60e3)

    const params: identifyIdentify2Rpc = {
      method: 'identify.identify2',
      param: {
        uid,
        userAssertion,
        alwaysBlock: false,
        noErrorOnTrackFailure: true,
        forceRemoteCheck: false,
        useDelegateUI,
        needProofSet: true,
        reason: {
          type: identifyCommon.IdentifyReasonType.id,
          reason,
          resource: '',
        },
        source: Common.ClientType.gui,
        allowEmptySelfID,
        noSkipSelf,
      },
      incomingCallMap,
      callback: (error, response) => {
        console.log('called identify and got back', error, response)
        clearTimeout(clearPendingTimeout)
        dispatch(pendingIdentify(userAssertion || uid, false))
        resolve()
      },
    }

    const status = getState().config.status
    const myUID = status && status.user && status.user.uid

    // Don't identify ourself
    if (allowSelf || myUID !== uid) {
      engine.rpc(params)
    }
  })
}

export function registerIdentifyUi (): TrackerActionCreator {
  return (dispatch, getState) => {
    engine.listenOnConnect('registerIdentifyUi', () => {
      const params : delegateUiCtlRegisterIdentifyUIRpc = {
        method: 'delegateUiCtl.registerIdentifyUI',
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in registering identify ui: ', error)
          } else {
            console.log('Registered identify ui')
          }
        },
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
        started: true,
      },
    })
  }
}

export function pushDebugTracker (username: string): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch({
      type: Constants.updateUsername,
      payload: {username},
    })

    dispatch(routeAppend([{path: 'tracker', username}]))
  }
}

export function onRefollow (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const trackToken = _getTrackToken(getState(), username)

    const dispatchRefollowAction = () => {
      dispatch(onWaiting(username, false))
      dispatch({
        type: Constants.onRefollow,
        payload: {username},
      })
    }
    const dispatchErrorAction = () => {
      dispatch(onWaiting(username, false))
      dispatch({
        type: Constants.onError,
        payload: {username},
      })
    }

    dispatch(onWaiting(username, true))
    trackUser(trackToken, false)
      .then(dispatchRefollowAction)
      .catch(err => {
        console.warn("Couldn't track user:", err)
        dispatchErrorAction()
      })
  }
}
export function onUnfollow (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const params : trackUntrackRpc = {
      method: 'track.untrack',
      param: {username},
      callback: (err, response) => {
        dispatch(onWaiting(username, false))
        if (err) {
          console.log('err untracking', err)
        } else {
          dispatch({
            type: Constants.reportLastTrack,
            payload: {username},
          })
          console.log('success in untracking')
        }
      },
    }

    dispatch(onWaiting(username, true))
    engine.rpc(params)

    dispatch({
      type: Constants.onUnfollow,
      payload: {username},
    })
  }
}

function trackUser (trackToken: ?string, localIgnore: bool): Promise<boolean> {
  const options: TrackOptions = {
    localOnly: localIgnore,
    expiringLocal: localIgnore,
    bypassConfirm: false,
    forceRetrack: false,
  }

  return new Promise((resolve, reject) => {
    if (trackToken != null) {
      const params : trackTrackWithTokenRpc = {
        method: 'track.trackWithToken',
        param: {trackToken, options},
        callback: (err, response) => {
          if (err) {
            console.log('error: Track with token: ', err)
            reject(err)
          }

          console.log('Finished tracking', response)
          resolve(true)
        },
      }

      engine.rpc(params)
    } else {
      resolve(false)
    }
  })
}

function onWaiting (username: string, waiting: bool): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch({type: Constants.onWaiting, payload: {username, waiting}})
  }
}

export function onIgnore (username: string): (dispatch: Dispatch, getState: () => {tracker: RootTrackerState}) => void {
  return dispatch => {
    dispatch(onFollow(username, true))
    dispatch(onClose(username))
  }
}

function _getTrackToken (state, username) {
  const trackerState = state.tracker.trackers[username]
  return trackerState && trackerState.type === 'tracker' ? trackerState.trackToken : null
}

export function onFollow (username: string, localIgnore: bool): (dispatch: Dispatch, getState: () => {tracker: RootTrackerState}) => void {
  return (dispatch, getState) => {
    const trackToken = _getTrackToken(getState(), username)

    const dispatchFollowedAction = () => {
      dispatch({type: Constants.onFollow, payload: {username}})
      dispatch(onWaiting(username, false))
    }
    const dispatchErrorAction = () => {
      dispatch({type: Constants.onError, payload: {username}})
      dispatch(onWaiting(username, false))
    }

    dispatch(onWaiting(username, true))
    trackUser(trackToken, localIgnore)
      .then(dispatchFollowedAction)
      .catch(err => {
        console.warn("Couldn't track user: ", err)
        dispatchErrorAction()
      })
  }
}

function _dismissWithToken (trackToken) {
  const params : trackDismissWithTokenRpc = {
    method: 'track.dismissWithToken',
    param: {trackToken},
    callback: err => {
      if (err) {
        console.log('err dismissWithToken', err)
      }
    },
  }
  engine.rpc(params)
}

export function onClose (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const trackToken = _getTrackToken(getState(), username)

    if (trackToken) {
      _dismissWithToken(trackToken)
    } else {
      console.log(`Missing trackToken for ${username}, waiting...`)
    }

    dispatch({
      type: Constants.onClose,
      payload: {username},
    })
  }
}

function updateUserInfo (userCard: UserCard, username: string, getState: () => {tracker: RootTrackerState, config: ConfigState}): Action {
  return {
    type: Constants.updateUserInfo,
    payload: {
      userInfo: {
        fullname: userCard.fullName,
        followersCount: userCard.followers,
        followingCount: userCard.following,
        followsYou: userCard.theyFollowYou,
        bio: userCard.bio,
        avatar: `https://keybase.io/${username}/picture`,
        location: userCard.location,
      },
      username,
    },
  }
}

// TODO: if we get multiple tracker calls we should cancel one of the sessionIDs, now they'll clash
function serverCallMap (dispatch: Dispatch, getState: Function, skipPopups: boolean = false): CallMap {
  /* eslint-disable arrow-parens */
  const sessionIDToUsername: { [key: number]: string } = {}
  const identifyUi = {
    start: ({username, sessionID, reason}) => {
      sessionIDToUsername[sessionID] = username

      if (reason && (reason.reason === profileReason)) {
        skipPopups = true
      }

      dispatch({
        type: Constants.updateUsername,
        payload: {username},
      })

      dispatch({
        type: Constants.updateReason,
        payload: {username, reason: reason && reason.reason},
      })

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {username, active: true},
      })

      dispatch({
        type: Constants.reportLastTrack,
        payload: {username},
      })
    },

    displayTLFCreateWithInvite: (args, response) => dispatch(({payload: args, type: Constants.showNonUser}: ShowNonUser)),

    displayKey: ({sessionID, key}) => {
      const username = sessionIDToUsername[sessionID]

      if (key.breaksTracking) {
        dispatch({type: Constants.updateEldestKidChanged, payload: {username}})
        dispatch({type: Constants.updateReason, payload: {username, reason: `${username} has reset their account!`}})
        dispatch({type: Constants.updateProofState, payload: {username}})
        if (!skipPopups) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      }
    },
    reportLastTrack: ({sessionID, track}) => {
      const username = sessionIDToUsername[sessionID]
      dispatch({
        type: Constants.reportLastTrack,
        payload: {username, track},
      })

      if (!track && !skipPopups) {
        dispatch({type: Constants.showTracker, payload: {username}})
      }
    },

    launchNetworkChecks: ({sessionID, identity}) => {
      const username = sessionIDToUsername[sessionID]
      // This is the first spot that we have access to the user, so let's use that to get
      // The user information

      dispatch({
        type: Constants.setProofs,
        payload: {username, identity},
      })
      dispatch({type: Constants.updateProofState, payload: {username}})
      if (identity.breaksTracking && !skipPopups) {
        dispatch({type: Constants.showTracker, payload: {username}})
      }
    },

    displayTrackStatement: params => {
    },

    dismiss: ({username, reason}) => {
      dispatch({
        type: Constants.remoteDismiss,
        payload: {username, reason},
      })
    },

    finishWebProofCheck: ({sessionID, rp, lcr}) => {
      const username = sessionIDToUsername[sessionID]
      dispatch(updateProof(rp, lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})

      if (lcr.breaksTracking && !skipPopups) {
        dispatch({type: Constants.showTracker, payload: {username}})
      }
    },
    finishSocialProofCheck: ({sessionID, rp, lcr}) => {
      const username = sessionIDToUsername[sessionID]
      dispatch(updateProof(rp, lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})

      if (lcr.breaksTracking && !skipPopups) {
        dispatch({type: Constants.showTracker, payload: {username}})
      }
    },
    displayCryptocurrency: params => {
    },
    displayUserCard: ({sessionID, card}) => {
      const username = sessionIDToUsername[sessionID]
      dispatch(updateUserInfo(card, username, getState))
    },
    reportTrackToken: ({sessionID, trackToken}) => {
      const username = sessionIDToUsername[sessionID]
      dispatch({type: Constants.updateTrackToken, payload: {username, trackToken}})

      const userState = getState().tracker.trackers[username]
      if (userState && userState.needTrackTokenDismiss) {
        _dismissWithToken(trackToken)

        dispatch({
          type: Constants.setNeedTrackTokenDismiss,
          payload: {
            username,
            needTrackTokenDismiss: false,
          },
        })
      }
    },
    confirm: () => {
      // our UI doesn't use this at all, keep this to not get an unhandled incoming msg warning
    },
    finish: ({sessionID}) => {
      const username = sessionIDToUsername[sessionID]
      // Check if there were any errors in the proofs
      dispatch({type: Constants.updateProofState, payload: {username}})

      if (showAllTrackers && !skipPopups) {
        console.log('showAllTrackers is on, so showing tracker')
        dispatch({type: Constants.showTracker, payload: {username}})
      }

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {
          active: false,
          username,
        },
      })
    },
  }

  return promisifyResponses(flattenCallMap({keybase: {'1': {identifyUi}}}))
  /* eslint-enable arrow-parens */
}

function updateProof (remoteProof: RemoteProof, linkCheckResult: LinkCheckResult, username: string): Action {
  return {
    type: Constants.updateProof,
    payload: {remoteProof, linkCheckResult, username},
  }
}

function summaryToTrackingInfo (getState: any, summaries: Array<UserSummary>): Array<TrackingInfo> {
  return summaries.map(s => ({
    username: s.username,
    fullname: s.fullName,
    following: isFollowing(getState, s.username),
    followsYou: isFollower(getState, s.username),
  }))
}

function listTrackers (username: string): Promise {
  return new Promise((resolve, reject) => {
    const params : userListTrackersByNameRpc = {
      method: 'user.listTrackersByName',
      param: {username},
      incomingCallMap: {},
      callback: (err, trackers) => {
        if (err) {
          console.log('err getting trackers', err)
          reject()
        } else {
          resolve((trackers || []).map(t => t.tracker))
        }
      },
    }

    engine.rpc(params)
  })
}

function loadSummaries (getState: any, uids: Array<UID>): Promise {
  return new Promise((resolve, reject) => {
    if (!uids.length) {
      resolve([])
    } else {
      const params : userLoadUncheckedUserSummariesRpc = {
        method: 'user.loadUncheckedUserSummaries',
        param: {uids},
        incomingCallMap: {},
        callback: (err, summaries) => {
          if (err) {
            console.log('err getting tracker summaries', err)
            reject()
          } else {
            resolve(summaryToTrackingInfo(getState, summaries || []))
          }
        },
      }

      engine.rpc(params)
    }
  })
}

function getTracking (username: string): Promise {
  return new Promise((resolve, reject) => {
    const params : userListTrackingRpc = {
      method: 'user.listTracking',
      param: {assertion: username, filter: ''},
      incomingCallMap: {},
      callback: (err, summaries) => { // turns out this ISN'T a full usersummary, just a subset so we have to call loadSummaries
        if (err) {
          console.log('err getting tracker summaries', err)
          reject()
        } else {
          resolve((summaries || []).map(s => s.uid))
        }
      },
    }

    engine.rpc(params)
  })
}

function fillFolders (getState: () => {favorite: FavoriteState}, username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const root = getState().favorite.folders
    const pubIg = _.get(root, 'public.ignored', [])
    const pubTlf = _.get(root, 'public.tlfs', [])
    const privIg = _.get(root, 'private.ignored', [])
    const privTlf = _.get(root, 'private.tlfs', [])

    const tlfs = [].concat(pubIg, pubTlf, privIg, privTlf).filter(f => f.users.filter(u => u.username === username).length)
    dispatch({
      type: Constants.updateFolders,
      error: false,
      payload: {
        username,
        tlfs,
      },
    })
  }
}

export function updateTrackers (username: string) : TrackerActionCreator {
  return (dispatch, getState) => {
    const figureTrackers = listTrackers(username).then(uids => loadSummaries(getState, uids))
    const figureTracking = getTracking(username).then(uids => loadSummaries(getState, uids))

    Promise.all([figureTrackers, figureTracking]).then(([trackers, tracking]) => {
      dispatch({
        type: Constants.updateTrackers,
        payload: {username, trackers, tracking},
      })
    })
  }
}

export function pendingIdentify (username: string, pending: boolean): PendingIdentify {
  return {
    type: Constants.pendingIdentify,
    payload: {username, pending},
  }
}
