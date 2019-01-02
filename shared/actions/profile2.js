// @flow
import * as Profile2Gen from './profile2-gen'
import * as ConfigGen from './config-gen'
import * as Saga from '../util/saga'
// import * as I from 'immutable'
import * as Constants from '../constants/profile2'
// import * as Types from '../constants/types/profile2'
import flags from '../util/feature-flags'
// import * as RouteTreeGen from './route-tree-gen'
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
    'keybase.1.identify3Ui.identify3UpdateUserCard': ({guiID, card}) =>
      Saga.put(
        Profile2Gen.createUpdatedDetails({
          bio: card.bio,
          followThem: card.youFollowThem,
          followersCount: card.followers,
          followingCount: card.following,
          followsYou: card.theyFollowYou,
          fullname: card.fullName,
          guiID,
          location: card.location,
          publishedTeams: (card.teamShowcase || []).map(t => t.fqName),
        })
      ),
    'keybase.1.identify3Ui.identify3ShowTracker': ({guiID, assertion, reason, forceDisplay}) =>
      Saga.put(
        Profile2Gen.createLoad({
          assertion,
          forceDisplay: !!forceDisplay,
          fromDaemon: true,
          guiID,
          ignoreCache: false,
          reason: reason.reason || '',
        })
      ),
    'keybase.1.identify3Ui.identify3Result': ({guiID, result}) =>
      Saga.put(
        Profile2Gen.createUpdateResult({
          guiID,
          result,
        })
      ),
  })
}

function* load(state, action) {
  if (action.payload.fromDaemon) {
    return
  }
  const guiID = state.profile2.usernameToDetails.get(action.payload.assertion)
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

function* profile2Saga(): Saga.SagaGenerator<any, any> {
  if (!flags.identify3) {
    return
  }

  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
  yield* Saga.chainGenerator<Profile2Gen.LoadPayload>(Profile2Gen.load, load)
}

export default profile2Saga
