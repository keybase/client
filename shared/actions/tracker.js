// @flow
import * as Constants from '../constants/tracker'
import * as RPCTypes from '../constants/types/flow-types'
import Session from '../engine/session'
import get from 'lodash/get'
import engine from '../engine'
import openUrl from '../util/open-url'
import {requestIdleCallback} from '../util/idle-callback'
import {showAllTrackers} from '../local-debug'
import {isMobile} from '../constants/platform'

import type {Action, Dispatch, AsyncAction} from '../constants/types/flux'
import type {CancelHandlerType} from '../engine/session'
import type {State as ConfigState} from '../constants/config'
import type {FriendshipUserInfo} from '../profile/friendships'
import type {PendingIdentify, Proof} from '../constants/tracker'
import type {TypedState} from '../constants/reducer'

const {bufferToNiceHexString, cachedIdentifyGoodUntil} = Constants
type TrackerActionCreator = (dispatch: Dispatch, getState: () => TypedState) => ?Promise<*>

const profileFromUI = '@@UI-PROFILE'

function startTimer(): TrackerActionCreator {
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

        RPCTypes.trackCheckTrackingRpc({})
      }, Constants.rpcUpdateTimerSeconds)
    }
  }
}

function stopTimer(): Action {
  return {
    type: Constants.stopTimer,
    payload: {},
  }
}

function _clearIdentifyCache(uid: string): Action {
  return {
    type: Constants.cacheIdentify,
    payload: {uid, goodTill: 0},
  }
}

function setupUserChangedHandler(): TrackerActionCreator {
  return (dispatch, getState) => {
    engine().setIncomingHandler('keybase.1.NotifyUsers.userChanged', ({uid}) => {
      dispatch(_clearIdentifyCache(uid))
      const username = _getUsername(uid, getState())
      if (username) {
        dispatch(getProfile(username))
      }
    })
  }
}

function getProfile(
  username: string,
  ignoreCache: boolean = false,
  forceDisplay: boolean = false
): TrackerActionCreator {
  return (dispatch, getState) => {
    const tracker = getState().tracker

    // If we have a pending identify no point in firing off another one
    if (!ignoreCache && tracker.pendingIdentifies[username]) {
      console.log('Bailing on simultaneous getProfile', username)
      return
    }

    const trackerState = tracker && tracker.trackers ? tracker.trackers[username] : null
    const uid = trackerState && trackerState.type === 'tracker'
      ? trackerState.userInfo && trackerState.userInfo.uid
      : null
    const goodTill = uid && tracker.cachedIdentifies[uid + '']
    if (!ignoreCache && goodTill && goodTill >= Date.now()) {
      console.log('Bailing on cached getProfile', username, uid)
      return
    }

    dispatch({type: Constants.updateUsername, payload: {username}})
    dispatch(triggerIdentify('', username, forceDisplay))
    dispatch(_fillFolders(username))
  }
}

function getMyProfile(ignoreCache?: boolean): TrackerActionCreator {
  return (dispatch, getState) => {
    const username = getState().config.username
    if (username) {
      dispatch(getProfile(username, ignoreCache || false))
    }
  }
}

function triggerIdentify(
  uid: string = '',
  userAssertion: string = '',
  forceDisplay: boolean = false
): TrackerActionCreator {
  return (dispatch, getState) =>
    new Promise((resolve, reject) => {
      dispatch({type: Constants.identifyStarted, payload: null})
      RPCTypes.identifyIdentify2Rpc({
        param: {
          uid,
          userAssertion,
          alwaysBlock: false,
          noErrorOnTrackFailure: true,
          forceRemoteCheck: false,
          forceDisplay,
          useDelegateUI: true,
          needProofSet: true,
          reason: {
            type: RPCTypes.IdentifyCommonIdentifyReasonType.id,
            reason: profileFromUI,
            resource: '',
          },
          allowEmptySelfID: true,
          noSkipSelf: true,
        },
        incomingCallMap: {},
        callback: (error, response) => {
          if (error) {
            dispatch({
              type: Constants.identifyFinished,
              error: true,
              payload: {username: uid || userAssertion, error: error.desc},
            })
          }
          dispatch({type: Constants.identifyFinished, payload: {username: uid || userAssertion}})
          resolve()
        },
      })
    })
}

function registerIdentifyUi(): TrackerActionCreator {
  return (dispatch, getState) => {
    engine().listenOnConnect('registerIdentifyUi', () => {
      RPCTypes.delegateUiCtlRegisterIdentifyUIRpc({
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in registering identify ui: ', error)
          } else {
            console.log('Registered identify ui')
          }
        },
      })
    })

    const cancelHandler: CancelHandlerType = session => {
      const username = sessionIDToUsername[session.id]

      if (username) {
        dispatch({
          type: Constants.identifyFinished,
          error: true,
          payload: {
            username,
            error: 'Identify timed out',
          },
        })
      }
    }

    engine().setIncomingHandler(
      'keybase.1.identifyUi.delegateIdentifyUI',
      (param: any, response: ?Object) => {
        // If we don't finish the session by our timeout, we'll display an error
        const trackerTimeout = 1e3 * 60 * 5
        let trackerTimeoutError = 0

        const onStart = username => {
          // Don't do this on mobile
          if (isMobile) {
            return
          }
          trackerTimeoutError = setTimeout(() => {
            dispatch({
              type: Constants.identifyFinished,
              error: true,
              payload: {username, error: 'Identify timed out'},
            })
          }, trackerTimeout)
        }

        const onFinish = () => {
          session.end()
          clearTimeout(trackerTimeoutError)
        }

        const session: Session = engine().createSession(
          _serverCallMap(dispatch, getState, onStart, onFinish),
          null,
          cancelHandler
        )

        response && response.result(session.id)
      }
    )

    dispatch({
      type: Constants.registerIdentifyUi,
      payload: {started: true},
    })
  }
}

function onRefollow(username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const trackToken = _getTrackToken(getState(), username)

    const dispatchRefollowAction = () => {
      dispatch(_onWaiting(username, false))
      dispatch({
        type: Constants.onRefollow,
        payload: {username},
      })
    }
    const dispatchErrorAction = errText => {
      dispatch(_onWaiting(username, false))
      dispatch({type: Constants.onError, payload: {username, extraText: errText}})
    }

    dispatch(_onWaiting(username, true))
    _trackUser(trackToken, false).then(dispatchRefollowAction).catch(err => {
      console.warn("Couldn't track user:", err)
      dispatchErrorAction(err.desc)
    })
  }
}

function onUnfollow(username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    dispatch(_onWaiting(username, true))

    RPCTypes.trackUntrackRpc({
      param: {username},
      callback: (err, response) => {
        dispatch(_onWaiting(username, false))
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

function _trackUser(trackToken: ?string, localIgnore: boolean): Promise<boolean> {
  const options = {
    localOnly: localIgnore,
    expiringLocal: localIgnore,
    bypassConfirm: false,
    forceRetrack: false,
    forPGPPull: false,
  }

  return new Promise((resolve, reject) => {
    if (trackToken != null) {
      RPCTypes.trackTrackWithTokenRpc({
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

function _onWaiting(username: string, waiting: boolean): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch({type: Constants.onWaiting, payload: {username, waiting}})
  }
}

function onIgnore(username: string): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(onFollow(username, true))
    dispatch(onClose(username))
  }
}

function _getTrackToken(state, username) {
  const trackerState = state.tracker.trackers[username]
  return trackerState && trackerState.type === 'tracker' ? trackerState.trackToken : null
}

function _getUsername(uid: string, state: {tracker: Constants.State}): ?string {
  const trackers = state.tracker && state.tracker.trackers
  return Object.keys(trackers).find(
    (name: string) =>
      trackers[name].type === 'tracker' && trackers[name].userInfo && trackers[name].userInfo.uid === uid
  )
}

function onFollow(
  username: string,
  localIgnore?: boolean
): (dispatch: Dispatch, getState: () => {tracker: Constants.State}) => void {
  return (dispatch, getState) => {
    const trackToken = _getTrackToken(getState(), username)

    const dispatchFollowedAction = () => {
      dispatch({type: Constants.onFollow, payload: {username}})
      dispatch(_onWaiting(username, false))
    }
    const dispatchErrorAction = errText => {
      dispatch({type: Constants.onError, payload: {username, extraText: errText}})
      dispatch(_onWaiting(username, false))
    }

    dispatch(_onWaiting(username, true))
    _trackUser(trackToken, localIgnore || false).then(dispatchFollowedAction).catch(err => {
      console.warn("Couldn't track user: ", err)
      dispatchErrorAction(err.desc)
    })
  }
}

function _dismissWithToken(trackToken) {
  RPCTypes.trackDismissWithTokenRpc({
    param: {trackToken},
    callback: err => {
      if (err) {
        console.log('err dismissWithToken', err)
      }
    },
  })
}

function onClose(username: string): TrackerActionCreator {
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

function _updateUserInfo(
  userCard: RPCTypes.UserCard,
  username: string,
  getState: () => {tracker: Constants.State, config: ConfigState}
): Action {
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

function _updateBTC(username: string, address: string, sigID: string): Action {
  return {
    type: Constants.updateBTC,
    payload: {
      username,
      address,
      sigID,
    },
  }
}

function _updateZcash(username: string, address: string, sigID: string): Action {
  return {
    type: Constants.updateZcash,
    payload: {
      username,
      address,
      sigID,
    },
  }
}

function _updatePGPKey(username: string, pgpFingerprint: Buffer, kid: string): Action {
  return {
    type: Constants.updatePGPKey,
    payload: {
      username,
      kid,
      fingerPrint: bufferToNiceHexString(pgpFingerprint),
    },
  }
}

const sessionIDToUsername: {[key: number]: string} = {}
// TODO: if we get multiple tracker calls we should cancel one of the sessionIDs, now they'll clash
function _serverCallMap(
  dispatch: Dispatch,
  getState: Function,
  onStart: ?(username: string) => void,
  onFinish: ?() => void
): RPCTypes.incomingCallMapType {
  // if true we already have a pending call so lets skip a ton of work
  let username
  let clearPendingTimeout
  let alreadyPending = false
  let isGetProfile = false

  const requestIdle = f => {
    if (!alreadyPending) {
      // The timeout with the requestIdleCallback says f must be run when idle or if 1 second passes whichover comes first.
      // The timeout is necessary because the callback fn f won't be called if the window is hidden.
      requestIdleCallback(f, {timeout: 1e3})
    } else {
      console.log('skipped idle call due to already pending')
    }
  }

  // We queue up responses and handle them one at a time
  let _idleResponseQueue = []

  const addToIdleResponseQueue = (f: () => void) => {
    _idleResponseQueue.push(f)
    requestIdle(onRequestIdleQueueHandler)
  }

  const onRequestIdleQueueHandler = deadline => {
    if (!_idleResponseQueue.length) {
      return
    }

    do {
      const toHandle = _idleResponseQueue.pop()
      toHandle()
    } while (deadline.timeRemaining() > 10 && _idleResponseQueue.length)

    if (_idleResponseQueue.length) {
      requestIdle(onRequestIdleQueueHandler)
    }
  }

  return {
    'keybase.1.identifyUi.start': (
      {username: currentUsername, sessionID, reason, forceDisplay},
      response
    ) => {
      isGetProfile = reason.reason === profileFromUI
      response.result()
      username = currentUsername
      sessionIDToUsername[sessionID] = username
      onStart && onStart(username)

      if (getState().tracker.pendingIdentifies[username]) {
        console.log('Bailing on idenitifies in time window', username)
        alreadyPending = true

        // Display anyways
        if (forceDisplay) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
        return
      }

      dispatch(pendingIdentify(username, true))

      // We clear the pending timeout after a minute. Gives us some breathing room
      clearPendingTimeout = setTimeout(() => {
        dispatch(pendingIdentify(username, false))
      }, 60e3)

      dispatch({
        type: Constants.updateUsername,
        payload: {username},
      })

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {username, active: true},
      })

      requestIdle(() => {
        dispatch({
          type: Constants.resetProofs,
          payload: {username},
        })

        dispatch({
          type: Constants.updateReason,
          payload: {username, reason: reason && reason.reason},
        })

        dispatch({
          type: Constants.reportLastTrack,
          payload: {username},
        })

        if (forceDisplay) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },

    'keybase.1.identifyUi.displayTLFCreateWithInvite': (args, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch({
          type: Constants.showNonUser,
          payload: {
            folderName: args.folderName,
            isPrivate: args.isPrivate,
            assertion: args.assertion,
            socialAssertion: args.socialAssertion,
            inviteLink: args.inviteLink,
            throttled: args.throttled,
          },
        })
      })
    },
    'keybase.1.identifyUi.displayKey': ({key}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        if (key.breaksTracking) {
          dispatch({type: Constants.updateEldestKidChanged, payload: {username}})
          dispatch({
            type: Constants.updateReason,
            payload: {username, reason: `${username} has reset their account!`},
          })
          dispatch({type: Constants.updateProofState, payload: {username}})
          if (!isGetProfile) {
            dispatch({type: Constants.showTracker, payload: {username}})
          }
        } else if (key.pgpFingerprint) {
          dispatch(_updatePGPKey(username, key.pgpFingerprint, key.KID))
          dispatch({type: Constants.updateProofState, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.reportLastTrack': ({track}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch({
          type: Constants.reportLastTrack,
          payload: {username, track},
        })

        if (!track && !isGetProfile) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.launchNetworkChecks': ({identity}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        // This is the first spot that we have access to the user, so let's use that to get
        // The user information

        dispatch({
          type: Constants.setProofs,
          payload: {username, identity},
        })
        dispatch({type: Constants.updateProofState, payload: {username}})
        if (identity.breaksTracking && !isGetProfile) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.displayTrackStatement': (params, response) => {
      response.result()
    },

    'keybase.1.identifyUi.dismiss': ({username, reason}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch({
          type: Constants.remoteDismiss,
          payload: {username, reason},
        })
      })
    },

    'keybase.1.identifyUi.finishWebProofCheck': ({rp, lcr}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(_updateProof(rp, lcr, username))
        dispatch({type: Constants.updateProofState, payload: {username}})

        if (lcr.breaksTracking && !isGetProfile) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.finishSocialProofCheck': ({rp, lcr}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(_updateProof(rp, lcr, username))
        dispatch({type: Constants.updateProofState, payload: {username}})

        if (lcr.breaksTracking && !isGetProfile) {
          dispatch({type: Constants.showTracker, payload: {username}})
        }
      })
    },
    'keybase.1.identifyUi.displayCryptocurrency': ({c: {address, sigID, type, family}}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        if (family === 'zcash') {
          dispatch(_updateZcash(username, address, sigID))
        } else {
          dispatch(_updateBTC(username, address, sigID))
        }
        dispatch({type: Constants.updateProofState, payload: {username}})
      })
    },
    'keybase.1.identifyUi.displayUserCard': ({card}, response) => {
      response.result()
      // run this immediately
      if (isGetProfile) {
        // cache profile calls
        dispatch({
          type: Constants.cacheIdentify,
          payload: {uid: card.uid, goodTill: Date.now() + cachedIdentifyGoodUntil},
        })
      }
      dispatch(_updateUserInfo(card, username, getState))
    },
    'keybase.1.identifyUi.reportTrackToken': ({trackToken}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
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
        autoConfirmed: false,
      })
    },
    'keybase.1.identifyUi.cancel': ({sessionID}, response) => {
      response.result()

      addToIdleResponseQueue(() => {
        // Check if there were any errors in the proofs
        dispatch({type: Constants.updateProofState, payload: {username}})

        dispatch({type: Constants.identifyFinished, payload: {username}})

        if (showAllTrackers && !isGetProfile) {
          console.log('showAllTrackers is on, so showing tracker')
          dispatch({type: Constants.showTracker, payload: {username}})
        }

        dispatch({
          type: Constants.markActiveIdentifyUi,
          payload: {username, active: false},
        })

        // Doing a non-tracker so explicitly cleanup instead of using the timeout
        if (isGetProfile) {
          dispatch(pendingIdentify(username, false))
          clearTimeout(clearPendingTimeout)
        }

        onFinish && onFinish()

        // cleanup bookkeeping
        delete sessionIDToUsername[sessionID]
        engine().cancelSession(sessionID)
      })

      // if we're pending we still want to call onFinish
      if (alreadyPending) {
        onFinish && onFinish()
      }
    },
    'keybase.1.identifyUi.finish': ({sessionID}, response) => {
      // Cancel is actually the 'last' call that happens
      response.result()
    },
  }
}

function _updateProof(
  remoteProof: RPCTypes.RemoteProof,
  linkCheckResult: RPCTypes.LinkCheckResult,
  username: string
): Action {
  return {
    type: Constants.updateProof,
    payload: {remoteProof, linkCheckResult, username},
  }
}

type APIFriendshipUserInfo = {
  uid: string,
  username: string,
  fullName: string,
  thumbnail: string,
  isFollowee: boolean,
  isFollower: boolean,
}

function _parseFriendship({
  isFollowee,
  isFollower,
  username,
  uid,
  fullName,
  thumbnail,
}: APIFriendshipUserInfo): FriendshipUserInfo {
  return {
    username,
    thumbnailUrl: thumbnail,
    uid,
    fullname: fullName,
    followsYou: isFollower,
    following: isFollowee,
  }
}

function _listTrackersOrTracking(
  username: string,
  listTrackers: boolean
): Promise<Array<FriendshipUserInfo>> {
  return new Promise((resolve, reject) => {
    RPCTypes.userListTrackers2Rpc({
      param: {
        assertion: username,
        reverse: !listTrackers,
      },
      callback: (error, response) => {
        if (error) {
          console.log('err getting trackers', error)
          reject(error)
        } else {
          if (response.users) {
            resolve(response.users.map(_parseFriendship))
          } else {
            reject(new Error('invalid tracker result'))
          }
        }
      },
    })
  })
}

const listTrackers = username => _listTrackersOrTracking(username, true)
const listTracking = username => _listTrackersOrTracking(username, false)

function _fillFolders(username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    const state: TypedState = getState()
    const root = state.favorite
    const pubIg = get(root, 'public.ignored', [])
    const pubTlf = get(root, 'public.tlfs', [])
    const privIg = get(root, 'private.ignored', [])
    const privTlf = get(root, 'private.tlfs', [])

    const tlfs = []
      .concat(pubIg, pubTlf, privIg, privTlf)
      .filter(f => f.users.filter(u => u.username === username).length)
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

function updateTrackers(username: string): TrackerActionCreator {
  return (dispatch, getState) => {
    Promise.all([listTrackers(username), listTracking(username)])
      .then(([trackers, tracking]) => {
        dispatch({
          type: Constants.updateTrackers,
          payload: {username, trackers, tracking},
        })
      })
      .catch(e => {
        console.warn('Failed to get followers/followings', e)
      })
  }
}

function pendingIdentify(username: string, pending: boolean): PendingIdentify {
  return {
    type: Constants.pendingIdentify,
    payload: {username, pending},
  }
}

function openProofUrl(proof: Proof): AsyncAction {
  return dispatch => {
    openUrl(proof.humanUrl)
  }
}

export {
  getMyProfile,
  getProfile,
  onClose,
  onFollow,
  onIgnore,
  onRefollow,
  onUnfollow,
  openProofUrl,
  pendingIdentify,
  registerIdentifyUi,
  setupUserChangedHandler,
  startTimer,
  stopTimer,
  triggerIdentify,
  updateTrackers,
}
