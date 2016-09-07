// @flow
import * as Constants from '../constants/tracker'
import Session from '../engine/session'
import _ from 'lodash'
import engine from '../engine'
import openUrl from '../util/open-url'
import setNotifications from '../util/set-notifications'
import type {Action, Dispatch, AsyncAction} from '../constants/types/flux'
import type {CancelHandlerType} from '../engine/session'
import type {ConfigState} from '../reducers/config'
import type {FriendshipUserInfo} from '../profile/friendships'
import type {RemoteProof, LinkCheckResult, UserCard, incomingCallMapType} from '../constants/types/flow-types'
import type {PendingIdentify, Proof} from '../constants/tracker'
import type {State as RootTrackerState} from '../reducers/tracker'
import type {TypedState} from '../constants/reducer'
import {
  apiserverGetRpc,
  delegateUiCtlRegisterIdentifyUIRpc,
  identifyIdentify2Rpc,
  trackCheckTrackingRpc,
  trackDismissWithTokenRpc,
  trackTrackWithTokenRpc,
  trackUntrackRpc,
  IdentifyCommonIdentifyReasonType,
} from '../constants/types/flow-types'
import {requestIdleCallback} from '../util/idle-callback'
import {routeAppend} from './router'
import {showAllTrackers} from '../local-debug'

const {bufferToNiceHexString} = Constants
type TrackerActionCreator = (dispatch: Dispatch, getState: () => TypedState) => ?Promise<*>

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

        trackCheckTrackingRpc({})
      }, Constants.rpcUpdateTimerSeconds)
    }
  }
}

export function stopTimer (): Action {
  return {
    type: Constants.stopTimer,
    payload: {},
  }
}

export function registerTrackerChangeListener (): TrackerActionCreator {
  return (dispatch, getState) => {
    engine().setIncomingHandler('keybase.1.NotifyTracking.trackingChanged', ({username}) => {
      const trackerState = getState().tracker.trackers[username]
      if (trackerState && trackerState.type === 'tracker') {
        dispatch(getProfile(username))
      }
    })
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
      console.log('Bailing on simultaneous getProfile', username)
      return
    }

    dispatch({type: Constants.updateUsername, payload: {username}})
    dispatch(triggerIdentify('', username, true, serverCallMap(dispatch, getState, true)))
    dispatch(fillFolders(username))
  }
}

export function getMyProfile (): TrackerActionCreator {
  return (dispatch, getState) => {
    const status = getState().config.status

    const username = status && status.user && status.user.username
    if (username) {
      dispatch(fillFolders(username))
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
    const status = getState().config.status
    const myUID = status && status.user && status.user.uid

    // Don't identify ourself
    if (allowSelf || myUID !== uid) {
      dispatch({type: Constants.identifyStarted, payload: null})
      identifyIdentify2Rpc({
        param: {
          uid,
          userAssertion,
          alwaysBlock: false,
          noErrorOnTrackFailure: true,
          forceRemoteCheck: false,
          useDelegateUI,
          needProofSet: true,
          reason: {
            type: IdentifyCommonIdentifyReasonType.id,
            reason,
            resource: '',
          },
          allowEmptySelfID,
          noSkipSelf,
        },
        incomingCallMap,
        callback: (error, response) => {
          console.log('called identify and got back', error, response)
          if (error) {
            dispatch({type: Constants.identifyFinished, error: true, payload: {error: error.desc}})
          }
          dispatch({type: Constants.identifyFinished, payload: null})
          resolve()
        },
      })
    }
  })
}

export function registerIdentifyUi (): TrackerActionCreator {
  return (dispatch, getState) => {
    engine().listenOnConnect('registerIdentifyUi', () => {
      delegateUiCtlRegisterIdentifyUIRpc({
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in registering identify ui: ', error)
          } else {
            console.log('Registered identify ui')
          }
        },
      })
    })

    const cancelHandler: CancelHandlerType = (session) => {
      const username = sessionIDToUsername[session.id]

      if (username) {
        dispatch({
          type: Constants.identifyFinished,
          error: true,
          payload: {
            username,
            error: 'Identify timed out',
          }})
      }
    }

    engine().setIncomingHandler('keybase.1.identifyUi.delegateIdentifyUI', (param: any, response: ?Object) => {
      const session: Session = engine().createSession(
        serverCallMap(dispatch, getState, false, () => {
          session.end()
        }), null, cancelHandler)

      response && response.result(session.id)
    })

    dispatch({
      type: Constants.registerIdentifyUi,
      payload: {started: true},
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
    dispatch(onWaiting(username, true))
    trackUntrackRpc({
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
    })

    dispatch({
      type: Constants.onUnfollow,
      payload: {username},
    })
  }
}

function trackUser (trackToken: ?string, localIgnore: bool): Promise<boolean> {
  const options = {
    localOnly: localIgnore,
    expiringLocal: localIgnore,
    bypassConfirm: false,
    forceRetrack: false,
  }

  return new Promise((resolve, reject) => {
    if (trackToken != null) {
      trackTrackWithTokenRpc({
        param: {trackToken, options},
        callback: (err, response) => {
          if (err) {
            console.log('error: Track with token: ', err)
            reject(err)
          }

          console.log('Finished tracking', response)
          resolve(true)
        },
      })
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
  trackDismissWithTokenRpc({
    param: {trackToken},
    callback: err => {
      if (err) {
        console.log('err dismissWithToken', err)
      }
    },
  })
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
        uid: userCard.uid,
        bio: userCard.bio,
        avatar: `https://keybase.io/${username}/picture`,
        location: userCard.location,
      },
      username,
    },
  }
}

function updateBTC (username: string, address: string, sigID: string): Action {
  return {
    type: Constants.updateBTC,
    payload: {
      username,
      address,
      sigID,
    },
  }
}

function updatePGPKey (username: string, pgpFingerprint: Buffer, kid: string): Action {
  return {
    type: Constants.updatePGPKey,
    payload: {
      username,
      kid,
      fingerPrint: bufferToNiceHexString(pgpFingerprint),
    },
  }
}

const sessionIDToUsername: { [key: number]: string } = {}
// TODO: if we get multiple tracker calls we should cancel one of the sessionIDs, now they'll clash
function serverCallMap (dispatch: Dispatch, getState: Function, skipPopups: boolean = false, onFinish: ?() => void): incomingCallMapType {
  // if true we already have a pending call so lets skip a ton of work
  let username
  let clearPendingTimeout
  let alreadyPending = false

  const requestIdle = f => {
    if (!alreadyPending) {
      requestIdleCallback(f)
    } else {
      console.log('skipped idle call due to already pending')
    }
  }

  return {
    'keybase.1.identifyUi.start': ({username: currentUsername, sessionID, reason}, response) => {
      response.result()
      username = currentUsername
      sessionIDToUsername[sessionID] = username

      if (getState().tracker.pendingIdentifies[username]) {
        console.log('Bailing on idenitifies in time window', username)
        alreadyPending = true
        return
      }

      dispatch(pendingIdentify(username, true))

      // We clear the pending timeout after a minute. Gives us some breathing room
      clearPendingTimeout = setTimeout(() => {
        dispatch(pendingIdentify(username, false))
      }, 60e3)

      if (reason && (reason.reason === profileReason)) {
        skipPopups = true
      }

      requestIdle(() => {
        dispatch({
          type: Constants.updateUsername,
          payload: {username},
        })

        dispatch({
          type: Constants.resetProofs,
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
      })
    },

    'keybase.1.identifyUi.displayTLFCreateWithInvite': (args, response) => {
      response.result()
      requestIdle(() => {
        dispatch({
          type: Constants.showNonUser,
          payload: {
            folderName: args.folderName,
            isPrivate: args.isPrivate,
            assertion: args.assertion,
            socialAssertion: args.socialAssertion,
            inviteLink: args.inviteLink,
            throttled: args.throttled,
          }})
      })
    },
    'keybase.1.identifyUi.displayKey': ({key}, response) => {
      response.result()
      requestIdle(() => {
        if (key.breaksTracking) {
          dispatch({type: Constants.updateEldestKidChanged, payload: {username}})
          dispatch({type: Constants.updateReason, payload: {username, reason: `${username} has reset their account!`}})
          dispatch({type: Constants.updateProofState, payload: {username}})
          if (!skipPopups) {
            dispatch({type: Constants.showTracker, payload: {username}})
          }
        } else if (key.pgpFingerprint) {
          dispatch(updatePGPKey(username, key.pgpFingerprint, key.KID))
          dispatch({type: Constants.updateProofState, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.reportLastTrack': ({track}, response) => {
      response.result()
      requestIdle(() => {
        dispatch({
          type: Constants.reportLastTrack,
          payload: {username, track},
        })

        if (!track && !skipPopups) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.launchNetworkChecks': ({identity}, response) => {
      response.result()
      requestIdle(() => {
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
      })
    },
    'keybase.1.identifyUi.displayTrackStatement': (params, response) => {
      response.result()
    },

    'keybase.1.identifyUi.dismiss': ({username, reason}, response) => {
      response.result()
      requestIdle(() => {
        dispatch({
          type: Constants.remoteDismiss,
          payload: {username, reason},
        })
      })
    },

    'keybase.1.identifyUi.finishWebProofCheck': ({rp, lcr}, response) => {
      response.result()
      requestIdle(() => {
        dispatch(updateProof(rp, lcr, username))
        dispatch({type: Constants.updateProofState, payload: {username}})

        if (lcr.breaksTracking && !skipPopups) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.finishSocialProofCheck': ({rp, lcr}, response) => {
      response.result()
      requestIdle(() => {
        dispatch(updateProof(rp, lcr, username))
        dispatch({type: Constants.updateProofState, payload: {username}})

        if (lcr.breaksTracking && !skipPopups) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.displayCryptocurrency': ({c: {address, sigID}}, response) => {
      response.result()
      requestIdle(() => {
        dispatch(updateBTC(username, address, sigID))
        dispatch({type: Constants.updateProofState, payload: {username}})
      })
    },
    'keybase.1.identifyUi.displayUserCard': ({card}, response) => {
      response.result()
      requestIdle(() => {
        dispatch(updateUserInfo(card, username, getState))
      })
    },
    'keybase.1.identifyUi.reportTrackToken': ({trackToken}, response) => {
      response.result()
      requestIdle(() => {
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
      })
    },
    'keybase.1.identifyUi.confirm': (param, response) => {
      response.result({
        identityConfirmed: false,
        remoteConfirmed: false,
        expiringLocal: false,
      })
    },
    'keybase.1.identifyUi.finish': (param, response) => {
      response.result()
      requestIdleCallback(() => {
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

        // Doing a non-tracker so explicitly cleanup instead of using the timeout
        if (skipPopups) {
          dispatch(pendingIdentify(username, false))
          clearTimeout(clearPendingTimeout)
        }

        onFinish && onFinish()
      })

      // if we're pending we still want to call onFinish
      if (alreadyPending) {
        onFinish && onFinish()
      }
    },
  }
}

function updateProof (remoteProof: RemoteProof, linkCheckResult: LinkCheckResult, username: string): Action {
  return {
    type: Constants.updateProof,
    payload: {remoteProof, linkCheckResult, username},
  }
}

type APIFriendshipUserInfo = {
  uid: string,
  username: string,
  full_name: string,
  location: string,
  bio: string,
  thumbnail: string,
  is_followee: boolean,
  is_follower: boolean,
}

function parseFriendship ({is_followee, is_follower, username, uid, full_name}: APIFriendshipUserInfo): FriendshipUserInfo {
  return {
    username,
    uid,
    fullname: full_name,
    followsYou: is_follower,
    following: is_followee,
  }
}

function _listTrackersOrTracking (uid: string, listTrackers: boolean): Promise<Array<FriendshipUserInfo>> {
  return new Promise((resolve, reject) => {
    apiserverGetRpc({
      param: {
        endpoint: 'user/list_followers_for_display',
        args: [
          {key: 'uid', value: uid},
          {key: 'reverse', value: String(!listTrackers)},
        ],
      },
      callback: (error, results) => {
        if (error) {
          console.log('err getting trackers', error)
          reject(error)
        } else {
          const json = JSON.parse(results.body)
          resolve(json.users.map(parseFriendship))
        }
      },
    })
  })
}

const listTrackers = uid => _listTrackersOrTracking(uid, true)
const listTracking = uid => _listTrackersOrTracking(uid, false)

function fillFolders (username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const state: TypedState = getState()
    const root = state.favorite
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

export function updateTrackers (username: string, uid: string): TrackerActionCreator {
  return (dispatch, getState) => {
    Promise.all([listTrackers(uid), listTracking(uid)]).then(([trackers, tracking]) => {
      dispatch({
        type: Constants.updateTrackers,
        payload: {username, trackers, tracking},
      })
    }).catch(e => {
      console.warn('Failed to get followers/followings', e)
    })
  }
}

export function pendingIdentify (username: string, pending: boolean): PendingIdentify {
  return {
    type: Constants.pendingIdentify,
    payload: {username, pending},
  }
}

export function openProofUrl (proof: Proof): AsyncAction {
  return (dispatch) => {
    openUrl(proof.humanUrl)
  }
}
