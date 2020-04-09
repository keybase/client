// import * as UsersGen from './users-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as UsersGen from './users-gen'
import * as TeamBuildingGen from './team-building-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/users'
import * as TrackerConstants from '../constants/tracker2'
import * as Tracker2Gen from './tracker2-gen'
import {TypedState} from '../util/container'
import logger from '../logger'
import {RPCError} from 'util/errors'

const onIdentifyUpdate = (action: EngineGen.Keybase1NotifyUsersIdentifyUpdatePayload) =>
  UsersGen.createUpdateBrokenState({
    newlyBroken: action.payload.params.brokenUsernames || [],
    newlyFixed: action.payload.params.okUsernames || [],
  })

// shouldn't know anything about chat stuff, only username => rpc call
const getBio = async (state: TypedState, action: UsersGen.GetBioPayload) => {
  const {username} = action.payload

  const info = state.users.infoMap.get(username)
  if (info && info.bio) {
    return // don't re-fetch bio if we already have one cached
  }

  try {
    const userCard = await RPCTypes.userUserCardRpcPromise({useSession: true, username})
    if (!userCard) {
      return // don't do anything if we don't get a good response from rpc
    }

    return UsersGen.createUpdateBio({userCard, username}) // set bio in user infomap
  } catch (e) {
    const err: RPCError = e
    if (Container.isNetworkErr(err.code)) {
      logger.info('Network error getting userCard')
    } else {
      logger.info(err.message)
    }
    return
  }
}

const setUserBlocks = async (action: UsersGen.SetUserBlocksPayload) => {
  const {blocks} = action.payload
  if (blocks && blocks.length) {
    await RPCTypes.userSetUserBlocksRpcPromise({blocks}, Constants.setUserBlocksWaitingKey)
  }
}

const getBlockState = async (action: UsersGen.GetBlockStatePayload) => {
  const {usernames} = action.payload

  const blocks = await RPCTypes.userGetUserBlocksRpcPromise({usernames}, Constants.getUserBlocksWaitingKey)
  if (blocks && blocks.length) {
    return UsersGen.createUpdateBlockState({blocks})
  }
  return
}

const reportUser = async (action: UsersGen.ReportUserPayload) => {
  await RPCTypes.userReportUserRpcPromise(action.payload, Constants.reportUserWaitingKey)
}

const refreshBlockList = async (action: TeamBuildingGen.SearchResultsLoadedPayload) =>
  action.payload.namespace === 'people' &&
  UsersGen.createGetBlockState({
    usernames: action.payload.users.map(u => u.serviceMap['keybase'] || '').filter(Boolean),
  })

const submitRevokeVouch = async (_: TypedState, action: UsersGen.SubmitRevokeVouchPayload) => {
  try {
    await RPCTypes.revokeRevokeSigsRpcPromise(
      {sigIDQueries: [action.payload.proofID]},
      Constants.wotReactWaitingKey
    )
    return Tracker2Gen.createLoad({
      assertion: action.payload.voucheeName,
      forceDisplay: false,
      fromDaemon: false,
      guiID: TrackerConstants.generateGUIID(),
      ignoreCache: false,
      inTracker: false,
      reason: '',
    })
  } catch (e) {
    logger.info('error revoking vouch', e)
  }
}

const wotReact = async (action: UsersGen.WotReactPayload) => {
  await RPCTypes.wotWotReactRpcPromise(action.payload, Constants.wotReactWaitingKey)
}

function* usersSaga() {
  yield* Saga.chainAction(EngineGen.keybase1NotifyUsersIdentifyUpdate, onIdentifyUpdate)
  yield* Saga.chainAction2(UsersGen.getBio, getBio)
  yield* Saga.chainAction(UsersGen.setUserBlocks, setUserBlocks)
  yield* Saga.chainAction(UsersGen.getBlockState, getBlockState)
  yield* Saga.chainAction(UsersGen.reportUser, reportUser)
  yield* Saga.chainAction(UsersGen.wotReact, wotReact)
  yield* Saga.chainAction2(UsersGen.submitRevokeVouch, submitRevokeVouch)
  yield* Saga.chainAction(TeamBuildingGen.searchResultsLoaded, refreshBlockList)
}

export default usersSaga
