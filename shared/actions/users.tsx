// import * as UsersGen from './users-gen'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as UsersGen from './users-gen'
import * as TeamBuildingGen from './team-building-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/users'
import * as TrackerConstants from '../constants/tracker2'
import * as Tracker2Gen from './tracker2-gen'
import * as ProfileGen from './profile-gen'
import * as RouteTreeGen from './route-tree-gen'
import logger from '../logger'
import {RPCError} from '../util/errors'

const onIdentifyUpdate = (_: unknown, action: EngineGen.Keybase1NotifyUsersIdentifyUpdatePayload) =>
  UsersGen.createUpdateBrokenState({
    newlyBroken: action.payload.params.brokenUsernames || [],
    newlyFixed: action.payload.params.okUsernames || [],
  })

// shouldn't know anything about chat stuff, only username => rpc call
const getBio = async (state: Container.TypedState, action: UsersGen.GetBioPayload) => {
  const {username} = action.payload

  const info = state.users.infoMap.get(username)
  if (info?.bio) {
    return // don't re-fetch bio if we already have one cached
  }

  try {
    const userCard = await RPCTypes.userUserCardRpcPromise({useSession: true, username})
    if (!userCard) {
      return // don't do anything if we don't get a good response from rpc
    }

    return UsersGen.createUpdateBio({userCard, username}) // set bio in user infomap
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (Container.isNetworkErr(error.code)) {
      logger.info('Network error getting userCard')
    } else {
      logger.info(error.message)
    }
  }
  return
}

const setUserBlocks = async (_: unknown, action: UsersGen.SetUserBlocksPayload) => {
  const {blocks} = action.payload
  if (blocks.length) {
    await RPCTypes.userSetUserBlocksRpcPromise({blocks}, Constants.setUserBlocksWaitingKey)
  }
}

const getBlockState = async (_: unknown, action: UsersGen.GetBlockStatePayload) => {
  const {usernames} = action.payload

  const blocks = await RPCTypes.userGetUserBlocksRpcPromise({usernames}, Constants.getUserBlocksWaitingKey)
  if (blocks?.length) {
    return UsersGen.createUpdateBlockState({blocks})
  }
  return
}

const reportUser = async (_: unknown, action: UsersGen.ReportUserPayload) => {
  await RPCTypes.userReportUserRpcPromise(action.payload, Constants.reportUserWaitingKey)
}

const refreshBlockList = (_: unknown, action: TeamBuildingGen.SearchResultsLoadedPayload) =>
  action.payload.namespace === 'people' &&
  UsersGen.createGetBlockState({
    usernames: action.payload.users.map(u => u.serviceMap['keybase'] || '').filter(Boolean),
  })

const submitRevokeVouch = async (_: Container.TypedState, action: UsersGen.SubmitRevokeVouchPayload) => {
  await RPCTypes.revokeRevokeSigsRpcPromise(
    {sigIDQueries: [action.payload.proofID]},
    Constants.wotRevokeWaitingKey
  )
  return Tracker2Gen.createLoad({
    assertion: action.payload.voucheeName,
    forceDisplay: false,
    fromDaemon: false,
    guiID: TrackerConstants.generateGUIID(),
    ignoreCache: false,
    inTracker: false,
    reason: 'wotRevokedVouch',
  })
}

const wotReact = async (_: unknown, action: UsersGen.WotReactPayload) => {
  const {fromModal, reaction, sigID, voucher} = action.payload
  if (!fromModal) {
    // This needs an error path. Happens when coming from a button directly on the profile screen.
    await RPCTypes.wotWotReactRpcPromise(
      {allowEmptySigID: false, reaction, sigID, voucher},
      Constants.wotReactWaitingKey
    )
    return []
  }
  try {
    await RPCTypes.wotWotReactRpcPromise(
      {allowEmptySigID: false, reaction, sigID, voucher},
      Constants.wotReactWaitingKey
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return ProfileGen.createWotVouchSetError({
        error: `There was an error reviewing the claim.`,
      })
    }
    logger.warn('Error from wotReact:', error)
    return ProfileGen.createWotVouchSetError({
      error: error.desc || `There was an error reviewing the claim.`,
    })
  }
  return [ProfileGen.createWotVouchSetError({error: ''}), RouteTreeGen.createClearModals()]
}

const initUsers = () => {
  Container.listenAction(EngineGen.keybase1NotifyUsersIdentifyUpdate, onIdentifyUpdate)
  Container.listenAction(UsersGen.getBio, getBio)
  Container.listenAction(UsersGen.setUserBlocks, setUserBlocks)
  Container.listenAction(UsersGen.getBlockState, getBlockState)
  Container.listenAction(UsersGen.reportUser, reportUser)
  Container.listenAction(UsersGen.wotReact, wotReact)
  Container.listenAction(UsersGen.submitRevokeVouch, submitRevokeVouch)
  Container.listenAction(TeamBuildingGen.searchResultsLoaded, refreshBlockList)
}

export default initUsers
