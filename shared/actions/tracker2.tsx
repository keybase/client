import * as Tracker2Gen from './tracker2-gen'
import * as EngineGen from './engine-gen-gen'
import * as ProfileGen from './profile-gen'
import * as Saga from '../util/saga'
import * as Constants from '../constants/tracker2'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'

const identify3Result = (_, action: EngineGen.Keybase1Identify3UiIdentify3ResultPayload) => {
  const {guiID, result} = action.payload.params
  return Tracker2Gen.createUpdateResult({guiID, reason: null, result: Constants.rpcResultToStatus(result)})
}

const identify3ShowTracker = (_, action: EngineGen.Keybase1Identify3UiIdentify3ShowTrackerPayload) => {
  const {guiID, assertion, reason, forceDisplay} = action.payload.params
  return Tracker2Gen.createLoad({
    assertion,
    forceDisplay: !!forceDisplay,
    fromDaemon: true,
    guiID,
    ignoreCache: false,
    inTracker: true,
    reason: reason.reason || '',
  })
}

const identify3UpdateRow = (_, action: EngineGen.Keybase1Identify3UiIdentify3UpdateRowPayload) =>
  Tracker2Gen.createUpdateAssertion({
    assertion: Constants.rpcAssertionToAssertion(action.payload.params.row),
    guiID: action.payload.params.row.guiID,
  })

const connected = () =>
  RPCTypes.delegateUiCtlRegisterIdentify3UIRpcPromise()
    .then(() => {
      logger.info('Registered identify ui')
    })
    .catch(error => {
      logger.warn('error in registering identify ui: ', error)
    })

// only refresh if we have tracked them before
const refreshChanged = (state, action: EngineGen.Keybase1NotifyTrackingTrackingChangedPayload) =>
  !!state.tracker2.usernameToDetails.get(action.payload.params.username) &&
  Tracker2Gen.createLoad({
    assertion: action.payload.params.username,
    fromDaemon: false,
    guiID: Constants.generateGUIID(),
    ignoreCache: true,
    inTracker: false,
    reason: '',
  })

const updateUserCard = (state, action: EngineGen.Keybase1Identify3UiIdentify3UpdateUserCardPayload) => {
  const {guiID, card} = action.payload.params
  const username = Constants.guiIDToUsername(state.tracker2, guiID)
  if (!username) {
    // an unknown or stale guiid, just ignore
    return
  }

  return Tracker2Gen.createUpdatedDetails({
    bio: card.bio,
    blocked: card.blocked,
    followThem: card.youFollowThem,
    followersCount: card.followers,
    followingCount: card.following,
    followsYou: card.theyFollowYou,
    fullname: card.fullName,
    guiID,
    location: card.location,
    registeredForAirdrop: card.registeredForAirdrop,
    teamShowcase: (card.teamShowcase || []).map(t => ({
      description: t.description,
      isOpen: t.open,
      membersCount: t.numMembers,
      name: t.fqName,
      publicAdmins: t.publicAdmins || [],
    })),
    username,
  })
}

const changeFollow = (_, action: Tracker2Gen.ChangeFollowPayload) =>
  RPCTypes.identify3Identify3FollowUserRpcPromise(
    {
      follow: action.payload.follow,
      guiID: action.payload.guiID,
    },
    Constants.waitingKey
  )
    .then(() =>
      Tracker2Gen.createUpdateResult({
        guiID: action.payload.guiID,
        reason: `Successfully ${action.payload.follow ? 'followed' : 'unfollowed'}!`,
        result: 'valid',
      })
    )
    .catch(e =>
      Tracker2Gen.createUpdateResult({
        guiID: action.payload.guiID,
        reason: `Failed to ${action.payload.follow ? 'follow' : 'unfollow'}`,
        result: 'error',
      })
    )

const ignore = (_, action: Tracker2Gen.IgnorePayload) =>
  RPCTypes.identify3Identify3IgnoreUserRpcPromise({guiID: action.payload.guiID}, Constants.waitingKey)
    .then(() =>
      Tracker2Gen.createUpdateResult({
        guiID: action.payload.guiID,
        reason: `Successfully ignored`,
        result: 'valid',
      })
    )
    .catch(e =>
      Tracker2Gen.createUpdateResult({
        guiID: action.payload.guiID,
        reason: `Failed to ignore`,
        result: 'error',
      })
    )

function* load(state, action: Tracker2Gen.LoadPayload) {
  if (action.payload.fromDaemon) {
    return
  }
  const guiID = Constants.getDetails(state, action.payload.assertion)
  if (!guiID.guiID) {
    throw new Error('No guid on profile 2 load? ' + action.payload.assertion || '')
  }
  try {
    yield* Saga.callRPCs(
      RPCTypes.identify3Identify3RpcSaga({
        incomingCallMap: {},
        params: {
          assertion: action.payload.assertion,
          guiID: action.payload.guiID,
          ignoreCache: !!action.payload.ignoreCache,
        },
        waitingKey: Constants.profileLoadWaitingKey,
      })
    )
  } catch (err) {
    if (err.code === RPCTypes.StatusCode.scresolutionfailed) {
      yield Saga.put(
        Tracker2Gen.createUpdateResult({guiID: action.payload.guiID, reason: null, result: 'notAUserYet'})
      )
    }
    // hooked into reloadable
    logger.error(`Error loading profile: ${err.message}`)
  }
}

const loadFollow = (_, action: Tracker2Gen.LoadPayload) => {
  const {assertion} = action.payload
  const convert = fs =>
    (fs.users || []).map(f => ({
      following: f.isFollowee,
      followsYou: f.isFollower,
      fullname: f.fullName,
      username: f.username,
    }))
  return (
    !action.payload.inTracker &&
    Promise.all([
      RPCTypes.userListTrackers2RpcPromise({assertion, reverse: false}, Constants.profileLoadWaitingKey).then(
        convert
      ),
      RPCTypes.userListTrackers2RpcPromise({assertion, reverse: true}, Constants.profileLoadWaitingKey).then(
        convert
      ),
    ])
      .then(([followers, following]) =>
        Tracker2Gen.createUpdateFollowers({followers, following, username: action.payload.assertion})
      )
      .catch(err => logger.error(`Error loading follow info: ${err.message}`))
  )
}

const getProofSuggestions = () =>
  RPCTypes.userProofSuggestionsRpcPromise(undefined, Constants.profileLoadWaitingKey)
    .then(({suggestions, showMore}) =>
      Tracker2Gen.createProofSuggestionsUpdated({
        suggestions: (suggestions || []).map(Constants.rpcSuggestionToAssertion),
      })
    )
    .catch(e => logger.error(`Error loading proof suggestions: ${e.message}`))

const showUser = (_, action: Tracker2Gen.ShowUserPayload) => {
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
const refreshSelf = (state, action: EngineGen.Keybase1NotifyUsersUserChangedPayload) =>
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

function* tracker2Saga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<EngineGen.Keybase1Identify3UiIdentify3UpdateUserCardPayload>(
    EngineGen.keybase1Identify3UiIdentify3UpdateUserCard,
    updateUserCard
  )
  yield* Saga.chainAction<Tracker2Gen.ChangeFollowPayload>(Tracker2Gen.changeFollow, changeFollow)
  yield* Saga.chainAction<Tracker2Gen.IgnorePayload>(Tracker2Gen.ignore, ignore)
  yield* Saga.chainGenerator<Tracker2Gen.LoadPayload>(Tracker2Gen.load, load)
  yield* Saga.chainAction<Tracker2Gen.LoadPayload>(Tracker2Gen.load, loadFollow)

  yield* Saga.chainAction<Tracker2Gen.GetProofSuggestionsPayload>(
    Tracker2Gen.getProofSuggestions,
    getProofSuggestions
  )

  yield* Saga.chainAction<EngineGen.Keybase1NotifyTrackingTrackingChangedPayload>(
    EngineGen.keybase1NotifyTrackingTrackingChanged,
    refreshChanged
  )
  // TEMP until actions/tracker is deprecated
  // yield* Saga.chainAction<GetProfilePayloadOLD>(getProfileOLD, _getProfileOLD) // TEMP
  // end TEMP until actions/tracker is deprecated
  //
  yield* Saga.chainAction<EngineGen.Keybase1Identify3UiIdentify3ResultPayload>(
    EngineGen.keybase1Identify3UiIdentify3Result,
    identify3Result
  )
  yield* Saga.chainAction<EngineGen.Keybase1Identify3UiIdentify3ShowTrackerPayload>(
    EngineGen.keybase1Identify3UiIdentify3ShowTracker,
    identify3ShowTracker
  )
  yield* Saga.chainAction<EngineGen.Keybase1Identify3UiIdentify3UpdateRowPayload>(
    EngineGen.keybase1Identify3UiIdentify3UpdateRow,
    identify3UpdateRow
  )
  yield* Saga.chainAction<EngineGen.ConnectedPayload>(EngineGen.connected, connected)
  yield* Saga.chainAction<Tracker2Gen.ShowUserPayload>(Tracker2Gen.showUser, showUser)
  yield* Saga.chainAction<EngineGen.Keybase1NotifyUsersUserChangedPayload>(
    EngineGen.keybase1NotifyUsersUserChanged,
    refreshSelf
  )
}

export default tracker2Saga
