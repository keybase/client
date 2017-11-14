// @flow
import * as Constants from '../constants/tracker'
import * as Types from '../constants/types/tracker'
import * as TrackerGen from '../actions/tracker-gen'
import * as RPCTypes from '../constants/types/flow-types'
import Session, {type CancelHandlerType} from '../engine/session'
import get from 'lodash/get'
import engine from '../engine'
import openUrl from '../util/open-url'
import {requestIdleCallback} from '../util/idle-callback'
import {isMobile} from '../constants/platform'
import {type TypedState} from '../constants/reducer'
import {type FriendshipUserInfo} from '../profile/friendships'

// TODO sagaize this
// Currently most things will call these thunks but they also tend to dispatch a generated action with the same name

const startTimer = () => (dispatch: Dispatch, getState: () => TypedState) => {
  // Increments timerActive as a count of open tracker popups.
  dispatch(TrackerGen.createSetStartTimer())
  const timerActive = getState().tracker.timerActive
  if (timerActive === 1) {
    // We're transitioning from 0->1, no tracker popups to one, start timer.
    const intervalId = setInterval(() => {
      const timerActive = getState().tracker.timerActive
      if (timerActive <= 0) {
        // All popups are closed now.
        clearInterval(intervalId)
      }

      RPCTypes.trackCheckTrackingRpcPromise()
    }, Constants.rpcUpdateTimerSeconds)
  }
}

function setupUserChangedHandler() {
  const setupUserChangedHandlerHelper = (dispatch: Dispatch, getState: () => TypedState) => {
    engine().setIncomingHandler('keybase.1.NotifyUsers.userChanged', ({uid}) => {
      dispatch(TrackerGen.createCacheIdentify({uid, goodTill: 0}))
      const username = _getUsername(uid, getState())
      if (username) {
        dispatch(getProfile(username))
      }
    })
  }
  return setupUserChangedHandlerHelper
}

const getProfile = (username: string, ignoreCache: boolean = false, forceDisplay: boolean = false) => (
  dispatch: Dispatch,
  getState: () => TypedState
) => {
  const tracker = getState().tracker

  // If we have a pending identify no point in firing off another one
  if (!ignoreCache && tracker.pendingIdentifies[username]) {
    console.log('Bailing on simultaneous getProfile', username)
    return
  }

  const trackerState = tracker.userTrackers[username]
  const uid = trackerState && trackerState.type === 'tracker'
    ? trackerState.userInfo && trackerState.userInfo.uid
    : null
  const goodTill = uid && tracker.cachedIdentifies[uid + '']
  if (!ignoreCache && goodTill && goodTill >= Date.now()) {
    console.log('Bailing on cached getProfile', username, uid)
    return
  }

  dispatch(TrackerGen.createUpdateUsername({username}))
  dispatch(triggerIdentify('', username, forceDisplay))
  dispatch(_fillFolders(username))
}

const getMyProfile = (ignoreCache?: boolean) => (dispatch: Dispatch, getState: () => TypedState) => {
  const username = getState().config.username
  if (username) {
    dispatch(getProfile(username, ignoreCache || false))
  }
}

const triggerIdentify = (uid: string = '', userAssertion: string = '', forceDisplay: boolean = false) => (
  dispatch: Dispatch,
  getState: () => TypedState
): Promise<*> =>
  new Promise((resolve, reject) => {
    dispatch(TrackerGen.createIdentifyStarted({username: uid || userAssertion}))
    RPCTypes.identifyIdentify2RpcPromise({
      uid,
      userAssertion,
      alwaysBlock: false,
      noErrorOnTrackFailure: true,
      forceRemoteCheck: false,
      forceDisplay,
      useDelegateUI: true,
      needProofSet: true,
      reason: {
        type: RPCTypes.identifyCommonIdentifyReasonType.id,
        reason: Constants.profileFromUI,
        resource: '',
      },
      allowEmptySelfID: true,
      noSkipSelf: true,
    })
      .then(response => {
        dispatch(TrackerGen.createIdentifyFinished({username: uid || userAssertion}))
        resolve()
      })
      .catch(error => {
        dispatch(TrackerGen.createIdentifyFinishedError({username: uid || userAssertion, error: error.desc}))
      })
  })

function registerIdentifyUi() {
  const registerIdentifyUiHelper = (dispatch: Dispatch, getState: () => TypedState) => {
    engine().listenOnConnect('registerIdentifyUi', () => {
      RPCTypes.delegateUiCtlRegisterIdentifyUIRpcPromise()
        .then(response => {
          console.log('Registered identify ui')
        })
        .catch(error => {
          console.warn('error in registering identify ui: ', error)
        })
    })

    const cancelHandler: CancelHandlerType = session => {
      const username = sessionIDToUsername[session.id]

      if (username) {
        dispatch(
          TrackerGen.createIdentifyFinishedError({
            username,
            error: 'Identify timed out',
          })
        )
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
            dispatch(TrackerGen.createIdentifyFinishedError({username, error: 'Identify timed out'}))
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

    dispatch(TrackerGen.createSetRegisterIdentifyUi({started: true}))
  }

  return registerIdentifyUiHelper
}

const onRefollow = (username: string) => (dispatch: Dispatch, getState: () => TypedState) => {
  const trackToken = _getTrackToken(getState(), username)

  const dispatchRefollowAction = () => {
    dispatch(TrackerGen.createWaiting({username, waiting: false}))
    dispatch(TrackerGen.createSetOnRefollow({username}))
  }
  const dispatchErrorAction = errText => {
    dispatch(TrackerGen.createWaiting({username, waiting: false}))
    dispatch(TrackerGen.createOnError({username, extraText: errText}))
  }

  dispatch(TrackerGen.createWaiting({username, waiting: true}))
  _trackUser(trackToken, false).then(dispatchRefollowAction).catch(err => {
    console.warn("Couldn't track user:", err)
    dispatchErrorAction(err.desc)
  })
}

const onUnfollow = (username: string) => (dispatch: Dispatch, getState: () => TypedState) => {
  dispatch(TrackerGen.createWaiting({username, waiting: true}))

  RPCTypes.trackUntrackRpcPromise({
    username,
  })
    .then(response => {
      dispatch(TrackerGen.createWaiting({username, waiting: false}))
      dispatch(TrackerGen.createReportLastTrack({username}))
      console.log('success in untracking')
    })
    .catch(err => {
      dispatch(TrackerGen.createWaiting({username, waiting: false}))
      console.log('err untracking', err)
    })

  dispatch(TrackerGen.createSetOnUnfollow({username}))
}

const _trackUser = (trackToken: ?string, localIgnore: boolean): Promise<boolean> =>
  new Promise((resolve, reject) => {
    if (trackToken != null) {
      RPCTypes.trackTrackWithTokenRpcPromise({
        trackToken,
        options: {
          localOnly: localIgnore,
          expiringLocal: localIgnore,
          bypassConfirm: false,
          forceRetrack: false,
          forPGPPull: false,
        },
      })
        .then(response => {
          console.log('Finished tracking', response)
          resolve(true)
        })
        .catch(err => {
          console.log('error: Track with token: ', err)
          reject(err)
        })
    } else {
      resolve(false)
    }
  })

const onIgnore = (username: string): ((dispatch: Dispatch) => void) => dispatch => {
  dispatch(onFollow(username, true))
  dispatch(onClose(username))
}

function _getTrackToken(state, username) {
  const trackerState = state.tracker.userTrackers[username]
  return trackerState ? trackerState.trackToken : null
}

function _getUsername(uid: string, state: TypedState): ?string {
  const trackers = state.tracker.userTrackers
  return Object.keys(trackers).find(name => trackers[name].userInfo.uid === uid)
}

const onFollow = (username: string, localIgnore?: boolean) => (
  dispatch: Dispatch,
  getState: () => TypedState
) => {
  const trackToken = _getTrackToken(getState(), username)

  const dispatchFollowedAction = () => {
    dispatch(TrackerGen.createSetOnFollow({username}))
    dispatch(TrackerGen.createWaiting({username, waiting: false}))
  }
  const dispatchErrorAction = errText => {
    dispatch(TrackerGen.createOnError({username, extraText: errText}))
    dispatch(TrackerGen.createWaiting({username, waiting: false}))
  }

  dispatch(TrackerGen.createWaiting({username, waiting: true}))
  _trackUser(trackToken, localIgnore || false).then(dispatchFollowedAction).catch(err => {
    console.warn("Couldn't track user: ", err)
    dispatchErrorAction(err.desc)
  })
}

function _dismissWithToken(trackToken) {
  RPCTypes.trackDismissWithTokenRpcPromise({trackToken}).catch(err => {
    console.log('err dismissWithToken', err)
  })
}

const onClose = (username: string) => (dispatch: Dispatch, getState: () => TypedState) => {
  const trackToken = _getTrackToken(getState(), username)

  if (trackToken) {
    _dismissWithToken(trackToken)
  } else {
    console.log(`Missing trackToken for ${username}, waiting...`)
  }

  dispatch(TrackerGen.createSetOnClose({username}))
}

const sessionIDToUsername: {[key: number]: string} = {}
// TODO: if we get multiple tracker calls we should cancel one of the sessionIDs, now they'll clash
function _serverCallMap(
  dispatch: Dispatch,
  getState: () => TypedState,
  onStart: ?(username: string) => void,
  onFinish: ?() => void
): RPCTypes.IncomingCallMapType {
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
      isGetProfile = reason.reason === Constants.profileFromUI
      response.result()
      username = currentUsername
      sessionIDToUsername[sessionID] = username
      onStart && onStart(username)

      if (getState().tracker.pendingIdentifies[username]) {
        console.log('Bailing on idenitifies in time window', username)
        alreadyPending = true

        // Display anyways
        if (forceDisplay) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
        return
      }

      dispatch(TrackerGen.createPendingIdentify({username, pending: true}))

      // We clear the pending timeout after a minute. Gives us some breathing room
      clearPendingTimeout = setTimeout(() => {
        dispatch(TrackerGen.createPendingIdentify({username, pending: false}))
      }, 60e3)

      dispatch(TrackerGen.createUpdateUsername({username}))
      dispatch(TrackerGen.createMarkActiveIdentifyUi({username, active: true}))

      requestIdle(() => {
        dispatch(TrackerGen.createResetProofs({username}))

        dispatch(
          TrackerGen.createUpdateReason({
            username,
            reason: reason && reason.reason !== Constants.profileFromUI ? reason.reason : null,
          })
        )

        dispatch(TrackerGen.createReportLastTrack({username}))

        if (forceDisplay) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },

    'keybase.1.identifyUi.displayTLFCreateWithInvite': (args, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(
          TrackerGen.createShowNonUser({
            username: args.assertion,
            nonUser: {
              folderName: args.folderName,
              isPrivate: args.isPrivate,
              assertion: args.assertion,
              socialAssertion: args.socialAssertion,
              inviteLink: args.inviteLink,
              throttled: args.throttled,
            },
          })
        )
      })
    },
    'keybase.1.identifyUi.displayKey': ({key}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        if (key.breaksTracking) {
          dispatch(TrackerGen.createUpdateEldestKidChanged({username}))
          if (key.trackDiff && key.trackDiff.type === RPCTypes.identifyCommonTrackDiffType.newEldest) {
            dispatch(
              TrackerGen.createUpdateReason({username, reason: `${username} has reset their account!`})
            )
          } else {
            dispatch(TrackerGen.createUpdateReason({username, reason: `${username} has deleted a PGP key.`}))
          }
          dispatch(TrackerGen.createUpdateProofState({username}))
          if (!isGetProfile) {
            dispatch(TrackerGen.createShowTracker({username}))
          }
        } else if (key.pgpFingerprint) {
          dispatch(
            TrackerGen.createUpdatePGPKey({username, pgpFingerprint: key.pgpFingerprint, kid: key.KID})
          )
          dispatch(TrackerGen.createUpdateProofState({username}))
        }
      })
    },
    'keybase.1.identifyUi.reportLastTrack': ({track}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createReportLastTrack({username, tracking: !!track}))

        if (!track && !isGetProfile) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },
    'keybase.1.identifyUi.launchNetworkChecks': ({identity}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        // This is the first spot that we have access to the user, so let's use that to get
        // The user information

        dispatch(TrackerGen.createSetProofs({username, identity}))
        dispatch(TrackerGen.createUpdateProofState({username}))
        if (identity.breaksTracking && !isGetProfile) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },
    'keybase.1.identifyUi.displayTrackStatement': (_, response) => {
      response.result()
    },

    'keybase.1.identifyUi.dismiss': (_, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createRemoteDismiss({username}))
      })
    },

    'keybase.1.identifyUi.finishWebProofCheck': ({rp, lcr}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createUpdateProof({remoteProof: rp, linkCheckResult: lcr, username}))
        dispatch(TrackerGen.createUpdateProofState({username}))

        if (lcr.breaksTracking && !isGetProfile) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },
    'keybase.1.identifyUi.finishSocialProofCheck': ({rp, lcr}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createUpdateProof({remoteProof: rp, linkCheckResult: lcr, username}))
        dispatch(TrackerGen.createUpdateProofState({username}))

        if (lcr.breaksTracking && !isGetProfile) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },
    'keybase.1.identifyUi.displayCryptocurrency': ({c: {address, sigID, type, family}}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        if (family === 'zcash') {
          dispatch(TrackerGen.createUpdateZcash({username, address, sigID}))
        } else {
          dispatch(TrackerGen.createUpdateBTC({username, address, sigID}))
        }
        dispatch(TrackerGen.createUpdateProofState({username}))
      })
    },
    'keybase.1.identifyUi.displayUserCard': ({card}, response) => {
      response.result()
      // run this immediately
      if (isGetProfile) {
        // cache profile calls
        dispatch(
          TrackerGen.createCacheIdentify({
            uid: card.uid,
            goodTill: Date.now() + Constants.cachedIdentifyGoodUntil,
          })
        )
      }
      dispatch(TrackerGen.createUpdateUserInfo({userCard: card, username}))
    },
    'keybase.1.identifyUi.reportTrackToken': ({trackToken}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createUpdateTrackToken({username, trackToken}))

        const userState = getState().tracker.userTrackers[username]
        if (userState && userState.needTrackTokenDismiss) {
          _dismissWithToken(trackToken)

          dispatch(
            TrackerGen.createSetNeedTrackTokenDismiss({
              username,
              needTrackTokenDismiss: false,
            })
          )
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
        dispatch(TrackerGen.createUpdateProofState({username}))
        dispatch(TrackerGen.createIdentifyFinished({username}))
        dispatch(TrackerGen.createMarkActiveIdentifyUi({username, active: false}))

        // Doing a non-tracker so explicitly cleanup instead of using the timeout
        if (isGetProfile) {
          dispatch(TrackerGen.createPendingIdentify({username, pending: false}))
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

const _listTrackersOrTracking = (
  username: string,
  listTrackers: boolean
): Promise<Array<FriendshipUserInfo>> =>
  new Promise((resolve, reject) => {
    RPCTypes.userListTrackers2RpcPromise({
      assertion: username,
      reverse: !listTrackers,
    })
      .then(response => {
        resolve(
          (response.users || []).map(f => ({
            username: f.username,
            thumbnailUrl: f.thumbnail,
            uid: f.uid,
            fullname: f.fullName,
            followsYou: f.isFollower,
            following: f.isFollowee,
          }))
        )
      })
      .catch(error => {
        console.log('err getting trackers', error)
        reject(error)
      })
  })

const listTrackers = username => _listTrackersOrTracking(username, true)
const listTracking = username => _listTrackersOrTracking(username, false)

const _fillFolders = (username: string) => (dispatch: Dispatch, getState: () => TypedState) => {
  const state = getState()
  const root = state.favorite
  const pubIg = get(root, 'public.ignored', [])
  const pubTlf = get(root, 'public.tlfs', [])
  const privIg = get(root, 'private.ignored', [])
  const privTlf = get(root, 'private.tlfs', [])

  const tlfs = []
    .concat(pubIg, pubTlf, privIg, privTlf)
    .filter(f => f.users.filter(u => u.username === username).length)
  dispatch(
    TrackerGen.createUpdateFolders({
      username,
      tlfs,
    })
  )
}

const updateTrackers = (username: string) => (dispatch: Dispatch, getState: () => TypedState) =>
  Promise.all([listTrackers(username), listTracking(username)])
    .then(([trackers, tracking]) => {
      dispatch(TrackerGen.createSetUpdateTrackers({username, trackers, tracking}))
    })
    .catch(e => {
      console.warn('Failed to get followers/followings', e)
    })

const openProofUrl = (proof: Types.Proof) => (dispatch: Dispatch) => {
  openUrl(proof.humanUrl)
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
  registerIdentifyUi,
  setupUserChangedHandler,
  startTimer,
  triggerIdentify,
  updateTrackers,
}
