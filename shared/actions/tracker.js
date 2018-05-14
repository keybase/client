// @flow
import logger from '../logger'
import * as Constants from '../constants/tracker'
import * as TrackerGen from '../actions/tracker-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import Session, {type CancelHandlerType} from '../engine/session'
import {get} from 'lodash-es'
import engine from '../engine'
import openUrl from '../util/open-url'
import {requestIdleCallback} from '../util/idle-callback'
import {isMobile} from '../constants/platform'
import {type TypedState} from '../constants/reducer'
import type {FriendshipUserInfo} from '../constants/types/profile'

// Send a heartbeat while trackers are still open
function* _trackerTimer(): Generator<any, void, any> {
  while (true) {
    yield Saga.call(Saga.delay, Constants.rpcUpdateTimerSeconds)
    const state: TypedState = yield Saga.select()
    const trackers = state.tracker.userTrackers
    if (Object.keys(trackers).some(username => !trackers[username].closed)) {
      yield Saga.call(RPCTypes.trackCheckTrackingRpcPromise)
    }
  }
}

function _getProfile(action: TrackerGen.GetProfilePayload, state: TypedState) {
  const {username, ignoreCache, forceDisplay} = action.payload
  const tracker = state.tracker

  // If we have a pending identify no point in firing off another one
  if (!ignoreCache && tracker.pendingIdentifies[username]) {
    logger.info('Bailing on simultaneous getProfile', username)
    return
  }

  const trackerState = tracker.userTrackers[username]
  const uid =
    trackerState && trackerState.type === 'tracker'
      ? trackerState.userInfo && trackerState.userInfo.uid
      : null
  const goodTill = uid && tracker.cachedIdentifies[uid + '']
  if (!ignoreCache && goodTill && goodTill >= Date.now()) {
    logger.info('Bailing on cached getProfile', username, uid)
    return
  }

  return Saga.all([
    Saga.put(TrackerGen.createUpdateUsername({username})),
    Saga.put(triggerIdentify('', username, forceDisplay)),
    Saga.put(_fillFolders(username)),
  ])
}

function _getMyProfile(action: TrackerGen.GetMyProfilePayload, state: TypedState) {
  const {ignoreCache} = action.payload
  const username = state.config.username
  if (username) {
    return Saga.put(TrackerGen.createGetProfile({ignoreCache: ignoreCache || false, username}))
  }
}

const triggerIdentify = (uid: string = '', userAssertion: string = '', forceDisplay: boolean = false) => (
  dispatch: Dispatch,
  getState: () => TypedState
) =>
  new Promise((resolve, reject) => {
    dispatch(TrackerGen.createIdentifyStarted({username: uid || userAssertion}))
    RPCTypes.identifyIdentify2RpcPromise({
      allowEmptySelfID: true,
      alwaysBlock: false,
      forceDisplay,
      forceRemoteCheck: false,
      needProofSet: true,
      noErrorOnTrackFailure: true,
      noSkipSelf: true,
      reason: {
        reason: Constants.profileFromUI,
        resource: '',
        type: RPCTypes.identifyCommonIdentifyReasonType.id,
      },
      uid,
      useDelegateUI: true,
      userAssertion,
    })
      .then(response => {
        dispatch(TrackerGen.createIdentifyFinished({username: uid || userAssertion}))
        resolve()
      })
      .catch(error => {
        dispatch(TrackerGen.createIdentifyFinishedError({error: error.desc, username: uid || userAssertion}))
      })
  })

function* _refollow(action: TrackerGen.RefollowPayload) {
  const {username} = action.payload
  const state: TypedState = yield Saga.select()
  const trackToken = _getTrackToken(state, username)

  yield Saga.put(TrackerGen.createWaiting({username, waiting: true}))
  try {
    yield Saga.call(_trackUser, trackToken, false)
    yield Saga.put(TrackerGen.createSetOnRefollow({username}))
  } catch (e) {
    logger.warn("Couldn't track user:", e)
    yield Saga.put(TrackerGen.createOnError({extraText: e.desc, username}))
  } finally {
    yield Saga.put(TrackerGen.createWaiting({username, waiting: false}))
  }
}

function* _unfollow(action: TrackerGen.UnfollowPayload) {
  const {username} = action.payload
  yield Saga.put(TrackerGen.createWaiting({username, waiting: true}))
  try {
    yield Saga.call(RPCTypes.trackUntrackRpcPromise, {
      username,
    })
    yield Saga.put(TrackerGen.createReportLastTrack({username}))
    logger.info('success in untracking')
  } catch (e) {
    logger.info('err untracking', e)
  } finally {
    yield Saga.put(TrackerGen.createWaiting({username, waiting: false}))
  }

  yield Saga.put(TrackerGen.createSetOnUnfollow({username}))
}

const _trackUser = (trackToken: ?string, localIgnore: boolean): Promise<boolean> =>
  new Promise((resolve, reject) => {
    if (trackToken != null) {
      RPCTypes.trackTrackWithTokenRpcPromise({
        options: {
          bypassConfirm: false,
          expiringLocal: localIgnore,
          forPGPPull: false,
          forceRetrack: false,
          localOnly: localIgnore,
        },
        trackToken,
      })
        .then(response => {
          logger.info('Finished tracking', response)
          resolve(true)
        })
        .catch(err => {
          logger.info('error: Track with token: ', err)
          reject(err)
        })
    } else {
      resolve(false)
    }
  })

function _ignore(action: TrackerGen.IgnorePayload) {
  const {username} = action.payload
  return Saga.all([
    Saga.put(TrackerGen.createFollow({localIgnore: true, username})),
    Saga.put(TrackerGen.createOnClose({username})),
  ])
}

function _getTrackToken(state, username) {
  const trackerState = state.tracker.userTrackers[username]
  return trackerState ? trackerState.trackToken : null
}

function _getUsername(uid: string, state: TypedState): ?string {
  const trackers = state.tracker.userTrackers
  return Object.keys(trackers).find(name => trackers[name].userInfo.uid === uid)
}

function* _follow(action: TrackerGen.FollowPayload) {
  const {username, localIgnore} = action.payload
  const state: TypedState = yield Saga.select()
  const trackToken = _getTrackToken(state, username)

  yield Saga.put(TrackerGen.createWaiting({username, waiting: true}))
  try {
    yield Saga.call(_trackUser, trackToken, localIgnore || false)
    yield Saga.put(TrackerGen.createSetOnFollow({username}))
  } catch (e) {
    logger.warn("Couldn't track user: ", e)
    yield Saga.put(TrackerGen.createOnError({extraText: e.desc, username}))
  } finally {
    yield Saga.put(TrackerGen.createWaiting({username, waiting: false}))
  }
}

function _dismissWithToken(trackToken) {
  RPCTypes.trackDismissWithTokenRpcPromise({trackToken}).catch(err => {
    logger.info('err dismissWithToken', err)
  })
}

function _onClose(action: TrackerGen.OnClosePayload, state: TypedState) {
  const {username} = action.payload
  const trackToken = _getTrackToken(state, username)

  if (trackToken) {
    _dismissWithToken(trackToken)
  } else {
    logger.info(`Missing trackToken for ${username}, waiting...`)
  }
}

const sessionIDToUsername: {[key: number]: string} = {}
// TODO: if we get multiple tracker calls we should cancel one of the sessionIDs, now they'll clash
function _serverCallMap(
  dispatch: Dispatch,
  getState: () => TypedState,
  onStart: ?(username: string) => void,
  onFinish: ?() => void
): RPCTypes.IncomingCallMapType {
  // if true we already have a pending call so let's skip a ton of work
  let username
  let clearPendingTimeout
  let alreadyPending = false
  let isGetProfile = false

  const requestIdle = f => {
    if (!alreadyPending) {
      // The timeout with the requestIdleCallback says f must be run when idle or if 1 second passes whichever comes first.
      // The timeout is necessary because the callback fn f won't be called if the window is hidden.
      requestIdleCallback(f, {timeout: 1e3})
    } else {
      logger.info('skipped idle call due to already pending')
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
      username = currentUsername
      isGetProfile = reason.reason === Constants.profileFromUI
      response.result()
      sessionIDToUsername[sessionID] = username
      onStart && onStart(username)

      if (getState().tracker.pendingIdentifies[username]) {
        logger.info('Bailing on idenitifies in time window', username)
        alreadyPending = true

        // Display anyways
        if (forceDisplay) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
        return
      }

      dispatch(TrackerGen.createPendingIdentify({pending: true, username}))

      // We clear the pending timeout after a minute. Gives us some breathing room
      clearPendingTimeout = setTimeout(() => {
        dispatch(TrackerGen.createPendingIdentify({pending: false, username}))
      }, 60e3)

      dispatch(TrackerGen.createUpdateUsername({username}))
      dispatch(TrackerGen.createMarkActiveIdentifyUi({active: true, username}))

      requestIdle(() => {
        dispatch(TrackerGen.createResetProofs({username}))

        dispatch(
          TrackerGen.createUpdateReason({
            reason: reason && reason.reason !== Constants.profileFromUI ? reason.reason : null,
            username,
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
            nonUser: {
              assertion: args.assertion,
              folderName: args.folderName,
              inviteLink: args.inviteLink,
              isPrivate: args.isPrivate,
              socialAssertion: args.socialAssertion,
              throttled: args.throttled,
            },
            username: args.assertion,
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
              TrackerGen.createUpdateReason({reason: `${username} has reset their account!`, username})
            )
          } else {
            dispatch(TrackerGen.createUpdateReason({reason: `${username} has deleted a PGP key.`, username}))
          }
          dispatch(TrackerGen.createUpdateProofState({username}))
          if (!isGetProfile) {
            dispatch(TrackerGen.createShowTracker({username}))
          }
        } else if (key.pgpFingerprint) {
          dispatch(
            TrackerGen.createUpdatePGPKey({
              kid: key.KID,
              pgpFingerprint: key.pgpFingerprint,
              username,
            })
          )
          dispatch(TrackerGen.createUpdateProofState({username}))
        }
      })
    },
    'keybase.1.identifyUi.reportLastTrack': ({track}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createReportLastTrack({tracking: !!track, username}))

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

        dispatch(TrackerGen.createSetProofs({identity, username}))
        dispatch(TrackerGen.createUpdateProofState({username}))
        if (identity.breaksTracking && !isGetProfile) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },
    'keybase.1.identifyUi.displayTrackStatement': (_, response) => {
      response.result()
    },

    'keybase.1.identifyUi.dismiss': ({username}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createRemoteDismiss({username}))
      })
    },

    'keybase.1.identifyUi.finishWebProofCheck': ({rp, lcr}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createUpdateProof({linkCheckResult: lcr, remoteProof: rp, username}))
        dispatch(TrackerGen.createUpdateProofState({username}))

        if (lcr.breaksTracking && !isGetProfile) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },
    'keybase.1.identifyUi.finishSocialProofCheck': ({rp, lcr}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createUpdateProof({linkCheckResult: lcr, remoteProof: rp, username}))
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
          dispatch(TrackerGen.createUpdateZcash({address, sigID, username}))
        } else {
          dispatch(TrackerGen.createUpdateBTC({address, sigID, username}))
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
              needTrackTokenDismiss: false,
              username,
            })
          )
        }
      })
    },
    'keybase.1.identifyUi.confirm': (param, response) => {
      response.result({
        autoConfirmed: false,
        expiringLocal: false,
        identityConfirmed: false,
        remoteConfirmed: false,
      })
    },
    'keybase.1.identifyUi.cancel': ({sessionID}, response) => {
      response.result()

      addToIdleResponseQueue(() => {
        // How username is handled here is very racy and we could do a ton better
        if (!username) {
          return
        }
        // Check if there were any errors in the proofs
        dispatch(TrackerGen.createUpdateProofState({username}))
        dispatch(TrackerGen.createIdentifyFinished({username}))
        dispatch(TrackerGen.createMarkActiveIdentifyUi({active: false, username}))

        // Doing a non-tracker so explicitly cleanup instead of using the timeout
        if (isGetProfile) {
          dispatch(TrackerGen.createPendingIdentify({pending: false, username}))
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
            following: f.isFollowee,
            followsYou: f.isFollower,
            fullname: f.fullName,
            uid: f.uid,
            username: f.username,
          }))
        )
      })
      .catch(error => {
        logger.info('err getting trackers', error)
        reject(error)
      })
  })

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
      tlfs,
      username,
    })
  )
}

function* _updateTrackers(action: TrackerGen.UpdateTrackersPayload) {
  const {username} = action.payload
  try {
    const [trackers, tracking] = yield Saga.all([
      Saga.call(_listTrackersOrTracking, username, true),
      Saga.call(_listTrackersOrTracking, username, false),
    ])

    yield Saga.put(TrackerGen.createSetUpdateTrackers({trackers, tracking, username}))
  } catch (e) {
    logger.warn('Failed to get followers/followings', e)
  }
}

function _openProofUrl(action: TrackerGen.OpenProofUrlPayload) {
  const {proof} = action.payload
  openUrl(proof.humanUrl)
}

function _userChanged(action: {payload: {uid: string}}, state: TypedState) {
  const {uid} = action.payload
  const actions = [Saga.put(TrackerGen.createCacheIdentify({goodTill: 0, uid}))]
  const username = _getUsername(uid, state)
  if (username) {
    actions.push(Saga.put(TrackerGen.createGetProfile({username})))
  }
  return Saga.all(actions)
}

function _setupTrackerHandlers() {
  engine().setIncomingActionCreators('keybase.1.NotifyUsers.userChanged', ({uid}) => {
    return [{payload: {uid}, type: 'tracker:_userChanged'}]
  })

  engine().listenOnConnect('registerIdentifyUi', () => {
    RPCTypes.delegateUiCtlRegisterIdentifyUIRpcPromise()
      .then(response => {
        logger.info('Registered identify ui')
      })
      .catch(error => {
        logger.warn('error in registering identify ui: ', error)
      })
  })

  // TODO get rid of getState here
  engine().setIncomingActionCreators(
    'keybase.1.identifyUi.delegateIdentifyUI',
    (param: any, response: ?Object, dispatch: Dispatch, getState: () => TypedState) => {
      // If we don't finish the session by our timeout, we'll display an error
      const trackerTimeout = 1e3 * 60 * 5
      let trackerTimeoutError = null

      const onStart = username => {
        // Don't do this on mobile
        if (isMobile) {
          return
        }
        trackerTimeoutError = setTimeout(() => {
          dispatch(TrackerGen.createIdentifyFinishedError({error: 'Identify timed out', username}))
        }, trackerTimeout)
      }

      const onFinish = () => {
        session.end()
        trackerTimeoutError && clearTimeout(trackerTimeoutError)
      }

      const cancelHandler: CancelHandlerType = session => {
        const username = sessionIDToUsername[session.getId()]

        if (username) {
          dispatch(
            TrackerGen.createIdentifyFinishedError({
              error: 'Identify timed out',
              username,
            })
          )
        }
      }

      const session: Session = engine().createSession(
        _serverCallMap(dispatch, getState, onStart, onFinish),
        null,
        cancelHandler
      )

      response && response.result(session.getId())
    }
  )
}

function* trackerSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(TrackerGen.unfollow, _unfollow)
  yield Saga.safeTakeEvery(TrackerGen.follow, _follow)
  yield Saga.safeTakeEveryPure(TrackerGen.ignore, _ignore)
  yield Saga.safeTakeEvery(TrackerGen.refollow, _refollow)
  yield Saga.safeTakeEveryPure(TrackerGen.onClose, _onClose)
  yield Saga.safeTakeEvery(TrackerGen.updateTrackers, _updateTrackers)
  yield Saga.safeTakeEveryPure(TrackerGen.getProfile, _getProfile)
  yield Saga.safeTakeEveryPure(TrackerGen.getMyProfile, _getMyProfile)
  yield Saga.safeTakeEveryPure(TrackerGen.openProofUrl, _openProofUrl)
  yield Saga.safeTakeEveryPure(TrackerGen.openProofUrl, _openProofUrl)
  yield Saga.safeTakeEveryPure(TrackerGen.setupTrackerHandlers, _setupTrackerHandlers)
  yield Saga.safeTakeEveryPure('tracker:_userChanged', _userChanged)

  // We don't have open trackers in mobile
  if (!isMobile) {
    yield Saga.fork(_trackerTimer)
  }
}

export default trackerSaga
