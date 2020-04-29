import * as Tracker2Gen from './tracker2-gen'
import * as EngineGen from './engine-gen-gen'
import * as ProfileGen from './profile-gen'
import * as UsersGen from './users-gen'
import * as DeeplinksGen from './deeplinks-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as Constants from '../constants/tracker2'
import * as ProfileConstants from '../constants/profile'
import {WebOfTrustVerificationType} from '../constants/types/more'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'

const identify3Result = (action: EngineGen.Keybase1Identify3UiIdentify3ResultPayload) =>
  Tracker2Gen.createUpdateResult({
    guiID: action.payload.params.guiID,
    result: Constants.rpcResultToStatus(action.payload.params.result),
  })

const identify3ShowTracker = (action: EngineGen.Keybase1Identify3UiIdentify3ShowTrackerPayload) =>
  Tracker2Gen.createLoad({
    assertion: action.payload.params.assertion,
    forceDisplay: !!action.payload.params.forceDisplay,
    fromDaemon: true,
    guiID: action.payload.params.guiID,
    ignoreCache: false,
    inTracker: true,
    reason: action.payload.params.reason.reason || '',
  })

const connected = async () => {
  try {
    await RPCTypes.delegateUiCtlRegisterIdentify3UIRpcPromise()
    logger.info('Registered identify ui')
  } catch (error) {
    logger.warn('error in registering identify ui: ', error)
  }
}

// only refresh if we have tracked them before
const refreshChanged = (
  state: Container.TypedState,
  action: EngineGen.Keybase1NotifyTrackingTrackingChangedPayload
) =>
  !!state.tracker2.usernameToDetails.get(action.payload.params.username) &&
  Tracker2Gen.createLoad({
    assertion: action.payload.params.username,
    fromDaemon: false,
    guiID: Constants.generateGUIID(),
    ignoreCache: true,
    inTracker: false,
    reason: '',
  })

const changeFollow = async (action: Tracker2Gen.ChangeFollowPayload) => {
  try {
    await RPCTypes.identify3Identify3FollowUserRpcPromise(
      {
        follow: action.payload.follow,
        guiID: action.payload.guiID,
      },
      Constants.waitingKey
    )
    return Tracker2Gen.createUpdateResult({
      guiID: action.payload.guiID,
      reason: `Successfully ${action.payload.follow ? 'followed' : 'unfollowed'}!`,
      result: 'valid',
    })
  } catch (_) {
    return Tracker2Gen.createUpdateResult({
      guiID: action.payload.guiID,
      reason: `Failed to ${action.payload.follow ? 'follow' : 'unfollow'}`,
      result: 'error',
    })
  }
}

const ignore = async (action: Tracker2Gen.IgnorePayload) => {
  try {
    await RPCTypes.identify3Identify3IgnoreUserRpcPromise({guiID: action.payload.guiID}, Constants.waitingKey)
    return Tracker2Gen.createUpdateResult({
      guiID: action.payload.guiID,
      reason: `Successfully ignored`,
      result: 'valid',
    })
  } catch (_) {
    return Tracker2Gen.createUpdateResult({
      guiID: action.payload.guiID,
      reason: `Failed to ignore`,
      result: 'error',
    })
  }
}
function* load(state: Container.TypedState, action: Tracker2Gen.LoadPayload) {
  if (action.payload.fromDaemon) {
    return
  }
  const guiID = Constants.getDetails(state, action.payload.assertion)
  if (!guiID.guiID) {
    throw new Error('No guid on profile 2 load? ' + action.payload.assertion || '')
  }
  try {
    yield RPCTypes.identify3Identify3RpcSaga({
      incomingCallMap: {},
      params: {
        assertion: action.payload.assertion,
        guiID: action.payload.guiID,
        ignoreCache: !!action.payload.ignoreCache,
      },
      waitingKey: Constants.profileLoadWaitingKey,
    })
  } catch (err) {
    if (err.code === RPCTypes.StatusCode.scresolutionfailed) {
      yield Saga.put(Tracker2Gen.createUpdateResult({guiID: action.payload.guiID, result: 'notAUserYet'}))
    } else if (err.code === RPCTypes.StatusCode.scnotfound) {
      // we're on the profile page for a user that does not exist. Currently the only way
      // to get here is with an invalid link or deeplink.
      yield Saga.put(
        DeeplinksGen.createSetKeybaseLinkError({
          error: `You followed a profile link for a user (${action.payload.assertion}) that does not exist.`,
        })
      )
      yield Saga.put(RouteTreeGen.createNavigateUp())
      yield Saga.put(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
        })
      )
    }
    // hooked into reloadable
    logger.error(`Error loading profile: ${err.message}`)
  }
}

const loadWebOfTrustEntries = async (
  action: Tracker2Gen.LoadPayload | EngineGen.Keybase1NotifyUsersWebOfTrustChangedPayload
) => {
  const username =
    action.type === Tracker2Gen.load ? action.payload.assertion : action.payload.params.username
  try {
    const wotVouches = await RPCTypes.wotWotFetchVouchesRpcPromise(
      {vouchee: username, voucher: ''},
      Constants.profileLoadWaitingKey
    )
    const webOfTrustEntries =
      wotVouches?.map(entry => ({
        attestation: entry.vouchText,
        attestingUser: entry.voucherUsername,
        otherText: entry.confidence.other,
        proofID: entry.vouchProof,
        proofs: entry.proofs ?? undefined,
        status: entry.status,
        verificationType: (ProfileConstants.choosableWotVerificationTypes.find(
          x => x === entry.confidence.usernameVerifiedVia
        )
          ? entry.confidence.usernameVerifiedVia
          : 'none') as WebOfTrustVerificationType,
        vouchedAt: entry.vouchedAt,
      })) || []
    return Tracker2Gen.createUpdateWotEntries({
      entries: webOfTrustEntries,
      voucheeUsername: username,
    })
  } catch (err) {
    logger.error(`Error loading web-of-trust info: ${err.message}`)
    return false
  }
}

const loadFollowers = async (action: Tracker2Gen.LoadPayload) => {
  const {assertion} = action.payload
  const convertTrackers = (fs: Saga.RPCPromiseType<typeof RPCTypes.userListTrackersUnverifiedRpcPromise>) => {
    return (fs.users || []).map(f => ({
      fullname: f.fullName,
      username: f.username,
    }))
  }

  if (action.payload.inTracker) {
    return false
  }

  try {
    const followers = await RPCTypes.userListTrackersUnverifiedRpcPromise(
      {assertion},
      Constants.profileLoadWaitingKey
    ).then(convertTrackers)
    return Tracker2Gen.createUpdateFollows({
      followers,
      following: undefined,
      username: action.payload.assertion,
    })
  } catch (err) {
    logger.error(`Error loading follower info: ${err.message}`)
    return false
  }
}

const loadFollowing = async (action: Tracker2Gen.LoadPayload) => {
  const {assertion} = action.payload
  const convertTracking = (fs: Saga.RPCPromiseType<typeof RPCTypes.userListTrackingRpcPromise>) => {
    return (fs.users || []).map(f => ({
      fullname: f.fullName,
      username: f.username,
    }))
  }

  if (action.payload.inTracker) {
    return false
  }

  try {
    const following = await RPCTypes.userListTrackingRpcPromise(
      {assertion, filter: ''},
      Constants.profileLoadWaitingKey
    ).then(convertTracking)
    return Tracker2Gen.createUpdateFollows({
      followers: undefined,
      following,
      username: action.payload.assertion,
    })
  } catch (err) {
    logger.error(`Error loading following info: ${err.message}`)
    return false
  }
}

const getProofSuggestions = async () => {
  try {
    const {suggestions} = await RPCTypes.userProofSuggestionsRpcPromise(
      undefined,
      Constants.profileLoadWaitingKey
    )
    return Tracker2Gen.createProofSuggestionsUpdated({
      suggestions: (suggestions || []).map(Constants.rpcSuggestionToAssertion),
    })
  } catch (e) {
    logger.error(`Error loading proof suggestions: ${e.message}`)
    return false
  }
}

const showUser = (action: Tracker2Gen.ShowUserPayload) => {
  const load = Tracker2Gen.createLoad({
    assertion: action.payload.username,
    // with new nav we never show trackers from inside the app
    forceDisplay: false,
    fromDaemon: false,
    guiID: Constants.generateGUIID(),
    ignoreCache: true,
    inTracker: action.payload.asTracker,
    reason: '',
  })
  if (!action.payload.skipNav) {
    // go to profile page
    return [load, ProfileGen.createShowUserProfile({username: action.payload.username})]
  } else {
    return load
  }
}

// if we mutated somehow reload ourselves and reget the suggestions
const refreshSelf = (state: Container.TypedState, action: EngineGen.Keybase1NotifyUsersUserChangedPayload) =>
  state.config.uid === action.payload.params.uid && [
    Tracker2Gen.createLoad({
      assertion: state.config.username,
      forceDisplay: false,
      fromDaemon: false,
      guiID: Constants.generateGUIID(),
      ignoreCache: false,
      inTracker: false,
      reason: '',
    }),
    Tracker2Gen.createGetProofSuggestions(),
  ]

const loadNonUserProfile = async (action: Tracker2Gen.LoadNonUserProfilePayload) => {
  const {assertion} = action.payload
  try {
    const res = await RPCTypes.userSearchGetNonUserDetailsRpcPromise(
      {assertion},
      Constants.nonUserProfileLoadWaitingKey
    )
    if (res.isNonUser) {
      const common = {
        assertion,
        assertionKey: res.assertionKey,
        assertionValue: res.assertionValue,
        description: res.description,
        siteIcon: res.siteIcon || [],
        siteIconDarkmode: res.siteIconDarkmode || [],
        siteIconFull: res.siteIconFull || [],
        siteIconFullDarkmode: res.siteIconFullDarkmode || [],
      }
      if (res.service) {
        return Tracker2Gen.createLoadedNonUserProfile({
          ...common,
          ...res.service,
        })
      } else {
        const {formatPhoneNumberInternational} = require('../util/phone-numbers')
        const formattedName =
          res.assertionKey === 'phone' ? formatPhoneNumberInternational('+' + res.assertionValue) : undefined
        const fullName = res.contact ? res.contact.contactName : ''
        return Tracker2Gen.createLoadedNonUserProfile({
          ...common,
          formattedName,
          fullName,
        })
      }
    }
    return false
  } catch (e) {
    logger.warn(`Error loading non user profile: ${e.message}`)
    return false
  }
}

const refreshTrackerBlock = async (action: Tracker2Gen.UpdatedDetailsPayload) =>
  UsersGen.createGetBlockState({
    usernames: [action.payload.username],
  })

function* tracker2Saga() {
  yield* Saga.chainAction(Tracker2Gen.changeFollow, changeFollow)
  yield* Saga.chainAction(Tracker2Gen.ignore, ignore)
  yield* Saga.chainGenerator<Tracker2Gen.LoadPayload>(Tracker2Gen.load, load)
  yield* Saga.chainAction(Tracker2Gen.load, loadFollowers)
  yield* Saga.chainAction(Tracker2Gen.load, loadFollowing)
  yield* Saga.chainAction(Tracker2Gen.load, loadWebOfTrustEntries)
  yield* Saga.chainAction(EngineGen.keybase1NotifyUsersWebOfTrustChanged, loadWebOfTrustEntries)
  yield* Saga.chainAction2(Tracker2Gen.getProofSuggestions, getProofSuggestions)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyTrackingTrackingChanged, refreshChanged)
  yield* Saga.chainAction(EngineGen.keybase1Identify3UiIdentify3Result, identify3Result)
  yield* Saga.chainAction(EngineGen.keybase1Identify3UiIdentify3ShowTracker, identify3ShowTracker)
  yield* Saga.chainAction2(EngineGen.connected, connected)
  yield* Saga.chainAction(Tracker2Gen.showUser, showUser)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyUsersUserChanged, refreshSelf)
  yield* Saga.chainAction(Tracker2Gen.loadNonUserProfile, loadNonUserProfile)
  yield* Saga.chainAction(Tracker2Gen.updatedDetails, refreshTrackerBlock)
}

export default tracker2Saga
