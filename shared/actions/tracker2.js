// @flow
import * as Tracker2Gen from './tracker2-gen'
import * as ConfigGen from './config-gen'
import * as Saga from '../util/saga'
import * as Constants from '../constants/tracker2'
import flags from '../util/feature-flags'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'
import engine from '../engine'

const setupEngineListeners = () => {
  engine().actionOnConnect('registerIdentify3UI', () => {
    RPCTypes.delegateUiCtlRegisterIdentify3UIRpcPromise()
      .then(() => {
        logger.info('Registered identify ui')
      })
      .catch(error => {
        logger.warn('error in registering identify ui: ', error)
      })
  })
  engine().setIncomingCallMap({
    'keybase.1.NotifyUsers.userChanged': ({uid}) => null, // we ignore this
    'keybase.1.identify3Ui.identify3Result': ({guiID, result}) =>
      Saga.put(
        Tracker2Gen.createUpdateResult({guiID, reason: null, result: Constants.rpcResultToStatus(result)})
      ),
    'keybase.1.identify3Ui.identify3ShowTracker': ({guiID, assertion, reason, forceDisplay}) =>
      Saga.put(
        Tracker2Gen.createLoad({
          assertion,
          forceDisplay: !!forceDisplay,
          fromDaemon: true,
          guiID,
          ignoreCache: false,
          inTracker: true,
          reason: reason.reason || '',
        })
      ),
    'keybase.1.identify3Ui.identify3UpdateRow': row =>
      Saga.put(
        Tracker2Gen.createUpdateAssertion({
          color: Constants.rpcRowColorToColor(row.color),
          guiID: row.guiID,
          metas: (row.metas || []).map(m => ({color: Constants.rpcRowColorToColor(m.color), label: m.label})),
          proofURL: row.proofURL,
          siteIcon: row.siteIcon,
          siteURL: row.siteURL,
          state: Constants.rpcRowStateToAssertionState(row.state),
          type: row.key,
          value: row.value,
        })
      ),
    'keybase.1.identify3Ui.identify3UpdateUserCard': ({guiID, card}) =>
      Saga.put(
        Tracker2Gen.createUpdatedDetails({
          bio: card.bio,
          followThem: card.youFollowThem,
          followersCount: card.followers,
          followingCount: card.following,
          followsYou: card.theyFollowYou,
          fullname: card.fullName,
          guiID,
          location: card.location,
          teamShowcase: (card.teamShowcase || []).map(t => ({
            description: t.description,
            isOpen: t.open,
            membersCount: t.numMembers,
            name: t.fqName,
            publicAdmins: t.publicAdmins || [],
          })),
        })
      ),
  })
}

const changeFollow = (_, action) =>
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

const ignore = (_, action) =>
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

function* load(state, action) {
  if (action.payload.fromDaemon) {
    return
  }
  const guiID = state.tracker2.usernameToDetails.get(action.payload.assertion)
  if (!guiID) {
    throw new Error('No guid on profile 2 load? ' + action.payload.assertion || '')
  }
  yield* Saga.callRPCs(
    RPCTypes.identify3Identify3RpcSaga({
      incomingCallMap: {},
      params: {
        assertion: action.payload.assertion,
        guiID: action.payload.guiID,
        ignoreCache: !!action.payload.ignoreCache,
      },
      waitingKey: Constants.waitingKey,
    })
  )
}

const loadFollow = (_, action) => {
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
      RPCTypes.userListTrackers2RpcPromise({assertion, reverse: false}).then(convert),
      RPCTypes.userListTrackers2RpcPromise({assertion, reverse: true}).then(convert),
    ]).then(([followers, following]) => {
      return Tracker2Gen.createUpdateFollowers({followers, following, username: action.payload.assertion})
    })
  )
}

function* tracker2Saga(): Saga.SagaGenerator<any, any> {
  if (!flags.identify3) {
    return
  }

  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
  yield* Saga.chainAction<Tracker2Gen.ChangeFollowPayload>(Tracker2Gen.changeFollow, changeFollow)
  yield* Saga.chainAction<Tracker2Gen.IgnorePayload>(Tracker2Gen.ignore, ignore)
  yield* Saga.chainGenerator<Tracker2Gen.LoadPayload>(Tracker2Gen.load, load)
  yield* Saga.chainAction<Tracker2Gen.LoadPayload>(Tracker2Gen.load, loadFollow)
}

export default tracker2Saga
