// @flow
import logger from '../logger'
import * as Constants from '../constants/tracker'
import * as TrackerGen from '../actions/tracker-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import flags from '../util/feature-flags'
import {get} from 'lodash-es'
import engine from '../engine'
import openUrl from '../util/open-url'
import {requestIdleCallback} from '../util/idle-callback'
import {isMobile} from '../constants/platform'
import {type TypedState} from '../constants/reducer'
import type {FriendshipUserInfo} from '../constants/types/profile'
import type {Dispatch} from '../util/container'

// Send a heartbeat while trackers are still open
function* _trackerTimer(): Generator<any, void, any> {
  while (true) {
    yield Saga.callUntyped(Saga.delay, Constants.rpcUpdateTimerSeconds)
    const state = yield* Saga.selectState()
    const trackers = state.tracker.userTrackers
    if (Object.keys(trackers).some(username => !trackers[username].closed)) {
      try {
        // never kill this loop on rpc errors
        yield* Saga.callPromise(RPCTypes.trackCheckTrackingRpcPromise)
      } catch (e) {}
    }
  }
}

function* _getProfile(state, action) {
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

  yield Saga.all([
    Saga.put(TrackerGen.createUpdateUsername({username})),
    Saga.callUntyped(triggerIdentify('', username, forceDisplay)),
    Saga.callUntyped(_fillFolders(username)),
  ])
}

function* _getMyProfile(state, action) {
  const {ignoreCache} = action.payload
  const username = state.config.username
  if (username) {
    yield Saga.put(TrackerGen.createGetProfile({ignoreCache: ignoreCache || false, username}))
  }
}

const triggerIdentify = (uid: string = '', userAssertion: string = '', forceDisplay: boolean = false) =>
  function*() {
    yield Saga.put(TrackerGen.createIdentifyStarted({username: uid || userAssertion}))
    const action = yield* Saga.callPromise(
      () =>
        new Promise((resolve, reject) => {
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
              resolve(TrackerGen.createIdentifyFinished({username: uid || userAssertion}))
            })
            .catch(error => {
              resolve(
                TrackerGen.createIdentifyFinishedError({error: error.desc, username: uid || userAssertion})
              )
            })
        })
    )
    yield Saga.put(action)
  }

function* _refollow(state, action) {
  const {username} = action.payload
  const trackToken = _getTrackToken(state, username)

  yield Saga.put(TrackerGen.createWaiting({username, waiting: true}))
  try {
    yield* Saga.callPromise(_trackUser, trackToken, false)
    yield Saga.put(TrackerGen.createSetOnRefollow({username}))
  } catch (e) {
    logger.warn("Couldn't track user:", e)
    yield Saga.put(TrackerGen.createOnError({extraText: e.desc, username}))
  } finally {
    yield Saga.put(TrackerGen.createWaiting({username, waiting: false}))
  }
}

function* _unfollow(_, action) {
  const {username} = action.payload
  yield Saga.put(TrackerGen.createWaiting({username, waiting: true}))
  try {
    yield* Saga.callPromise(RPCTypes.trackUntrackRpcPromise, {
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

function* _ignore(_, action) {
  const {username} = action.payload
  yield Saga.all([
    Saga.put(TrackerGen.createFollow({localIgnore: true, username})),
    Saga.put(TrackerGen.createOnClose({username})),
  ])
}

function _getTrackToken(state, username) {
  const trackerState = state.tracker.userTrackers[username]
  return trackerState ? trackerState.trackToken : null
}

function _getUsername(state, uid): ?string {
  const trackers = state.tracker.userTrackers
  // $FlowIssue flow thinks we don't need this cause the value of tracker[name] can't be null but it can be in practice cause the type is slightly wrong
  return Object.keys(trackers).find(name => trackers[name]?.userInfo?.uid === uid)
}

function* _follow(state, action) {
  const {username, localIgnore} = action.payload
  const trackToken = _getTrackToken(state, username)

  yield Saga.put(TrackerGen.createWaiting({username, waiting: true}))
  try {
    yield* Saga.callPromise(_trackUser, trackToken, localIgnore || false)
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

function* _onClose(state, action) {
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
): Object {
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
    'keybase.1.identifyUi.confirm': (param, response) => {
      response.result({
        autoConfirmed: false,
        expiringLocal: false,
        identityConfirmed: false,
        remoteConfirmed: false,
      })
    },
    'keybase.1.identifyUi.dismiss': ({username}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createRemoteDismiss({username}))
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
    'keybase.1.identifyUi.displayStellarAccount': ({a: {accountID, federationAddress, sigID}}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createUpdateStellarAddress({accountID, federationAddress, sigID, username}))
        dispatch(TrackerGen.createUpdateProofState({username}))
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
              service: args.socialAssertion.service,
              throttled: args.throttled,
            },
            username: args.assertion,
          })
        )
      })
    },

    'keybase.1.identifyUi.displayTrackStatement': (_, response) => {
      response.result()
    },

    'keybase.1.identifyUi.displayUserCard': ({card}, response) => {
      response.result()
      // run this immediately
      if (isGetProfile) {
        // cache profile calls
        dispatch(
          TrackerGen.createCacheIdentify({
            goodTill: Date.now() + Constants.cachedIdentifyGoodUntil,
            uid: card.uid,
          })
        )
      }
      dispatch(TrackerGen.createUpdateUserInfo({userCard: card, username}))
    },
    'keybase.1.identifyUi.finish': ({sessionID}, response) => {
      // Cancel is actually the 'last' call that happens
      response.result()
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
    'keybase.1.identifyUi.reportLastTrack': ({track}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createReportLastTrack({tracking: !!track, username}))

        if (!track && !isGetProfile) {
          dispatch(TrackerGen.createShowTracker({username}))
        }
      })
    },
    'keybase.1.identifyUi.reportTrackToken': ({trackToken}, response) => {
      response.result()
      addToIdleResponseQueue(() => {
        dispatch(TrackerGen.createUpdateTrackToken({trackToken, username}))

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

const _fillFolders = (username: string) =>
  function*() {
    const state = yield* Saga.selectState()
    // $FlowIssue this no longer exists!!! cc: @song
    const root = state.favorite
    const pubIg = get(root, 'public.ignored', [])
    const pubTlf = get(root, 'public.tlfs', [])
    const privIg = get(root, 'private.ignored', [])
    const privTlf = get(root, 'private.tlfs', [])

    const tlfs = []
      .concat(pubIg, pubTlf, privIg, privTlf)
      .filter(f => f.users.filter(u => u.username === username).length)
    yield Saga.put(TrackerGen.createUpdateFolders({tlfs, username}))
  }

function* _updateTrackers(_, action) {
  const {username} = action.payload
  try {
    const [trackers, tracking] = yield Saga.all([
      Saga.callUntyped(_listTrackersOrTracking, username, true),
      Saga.callUntyped(_listTrackersOrTracking, username, false),
    ])

    yield Saga.put(TrackerGen.createSetUpdateTrackers({trackers, tracking, username}))
  } catch (e) {
    logger.warn('Failed to get followers/followings', e)
  }
}

function* _openProofUrl(_, action: TrackerGen.OpenProofUrlPayload) {
  const {proof} = action.payload
  openUrl(proof.humanUrl)
}

function* _userChanged(state, action: {payload: {uid: string}}) {
  const {uid} = action.payload
  const actions = [Saga.put(TrackerGen.createCacheIdentify({goodTill: 0, uid}))]
  const username = _getUsername(state, uid)
  if (username) {
    actions.push(Saga.put(TrackerGen.createGetProfile({username})))
  }
  yield Saga.all(actions)
}

const setupEngineListeners = () => {
  // TODO remove this
  const dispatch = engine().deprecatedGetDispatch()
  const getState = engine().deprecatedGetGetState()

  engine().actionOnConnect('registerIdentifyUi', () => {
    RPCTypes.delegateUiCtlRegisterIdentifyUIRpcPromise()
      .then(response => {
        logger.info('Registered identify ui')
      })
      .catch(error => {
        logger.warn('error in registering identify ui: ', error)
      })
  })

  engine().setCustomResponseIncomingCallMap({
    'keybase.1.identifyUi.delegateIdentifyUI': (param, response, state) => {
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

      const cancelHandler = session => {
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

      const session = engine().createSession({
        cancelHandler,
        incomingCallMap: _serverCallMap(dispatch, getState, onStart, onFinish),
      })

      response && response.result(session.getId())
    },
  })
  engine().setIncomingCallMap({
    'keybase.1.NotifyUsers.userChanged': ({uid}) =>
      // $FlowIssue remove this soon
      Saga.put({error: false, payload: {uid}, type: 'tracker:_userChanged'}),
  })
}

function* trackerSaga(): Saga.SagaGenerator<any, any> {
  if (flags.identify3) {
    return
  }
  // TODO not bothering to make these nice as its all going away next week
  yield* Saga.chainGenerator<TrackerGen.UnfollowPayload>(TrackerGen.unfollow, _unfollow)
  yield* Saga.chainGenerator<TrackerGen.FollowPayload>(TrackerGen.follow, _follow)
  yield* Saga.chainGenerator<TrackerGen.IgnorePayload>(TrackerGen.ignore, _ignore)
  yield* Saga.chainGenerator<TrackerGen.RefollowPayload>(TrackerGen.refollow, _refollow)
  yield* Saga.chainGenerator<TrackerGen.OnClosePayload>(TrackerGen.onClose, _onClose)
  yield* Saga.chainGenerator<TrackerGen.UpdateTrackersPayload>(TrackerGen.updateTrackers, _updateTrackers)
  yield* Saga.chainGenerator<TrackerGen.GetProfilePayload>(TrackerGen.getProfile, _getProfile)
  yield* Saga.chainGenerator<TrackerGen.GetMyProfilePayload>(TrackerGen.getMyProfile, _getMyProfile)
  yield* Saga.chainGenerator<TrackerGen.OpenProofUrlPayload>(TrackerGen.openProofUrl, _openProofUrl)
  yield* Saga.chainGenerator<any>('tracker:_userChanged', _userChanged)

  // We don't have open trackers in mobile
  if (!isMobile) {
    yield Saga.spawn(_trackerTimer)
  }

  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
}

export default trackerSaga
