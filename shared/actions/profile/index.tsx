// import * as Container from '../../util/container'
// import * as Constants from '../../constants/profile'
// import * as ConfigConstants from '../../constants/config'
// import * as ProfileGen from '../profile-gen'
// import * as RPCTypes from '../../constants/types/rpc-gen'
// import * as RouteTreeGen from '../route-tree-gen'
// import * as TrackerConstants from '../../constants/tracker2'
// import * as Tracker2Gen from '../tracker2-gen'
// import logger from '../../logger'
// import openURL from '../../util/open-url'
// import {RPCError} from '../../util/errors'
// import {initPgp} from './pgp'
// import {initProofs} from './proofs'

// const submitRevokeProof = async (
//   state: Container.TypedState,
//   action: ProfileGen.SubmitRevokeProofPayload
// ) => {
//   const you = TrackerConstants.getDetails(state, ConfigConstants.useCurrentUserState.getState().username)
//   if (!you || !you.assertions) return null
//   const proof = [...you.assertions.values()].find(a => a.sigID === action.payload.proofId)
//   if (!proof) return null

//   if (proof.type === 'pgp') {
//     try {
//       await RPCTypes.revokeRevokeKeyRpcPromise({keyID: proof.kid}, Constants.waitingKey)
//       return false
//     } catch (e) {
//       logger.info('error in dropping pgp key', e)
//       return ProfileGen.createRevokeFinish({error: `Error in dropping Pgp Key: ${e}`})
//     }
//   } else {
//     try {
//       await RPCTypes.revokeRevokeSigsRpcPromise(
//         {sigIDQueries: [action.payload.proofId]},
//         Constants.waitingKey
//       )
//       return ProfileGen.createFinishRevoking()
//     } catch (error) {
//       logger.warn(`Error when revoking proof ${action.payload.proofId}`, error)
//       return ProfileGen.createRevokeFinish({
//         error: 'There was an error revoking your proof. You can click the button to try again.',
//       })
//     }
//   }
// }

// const submitBlockUser = async (_: unknown, action: ProfileGen.SubmitBlockUserPayload) => {
//   try {
//     await RPCTypes.userBlockUserRpcPromise({username: action.payload.username}, Constants.blockUserWaitingKey)
//     return [
//       ProfileGen.createFinishBlockUser(),
//       Tracker2Gen.createLoad({
//         assertion: action.payload.username,
//         guiID: TrackerConstants.generateGUIID(),
//         inTracker: false,
//         reason: '',
//       }),
//     ]
//   } catch (error) {
//     if (!(error instanceof RPCError)) {
//       return
//     }
//     logger.warn(`Error blocking user ${action.payload.username}`, error)
//     return ProfileGen.createFinishBlockUser({
//       error: error.desc || `There was an error blocking ${action.payload.username}.`,
//     })
//   }
// }

// const submitUnblockUser = async (_: unknown, action: ProfileGen.SubmitUnblockUserPayload) => {
//   try {
//     await RPCTypes.userUnblockUserRpcPromise(
//       {username: action.payload.username},
//       Constants.blockUserWaitingKey
//     )
//     return Tracker2Gen.createLoad({
//       assertion: action.payload.username,
//       guiID: TrackerConstants.generateGUIID(),
//       inTracker: false,
//       reason: '',
//     })
//   } catch (error) {
//     if (!(error instanceof RPCError)) {
//       return
//     }
//     logger.warn(`Error unblocking user ${action.payload.username}`, error)
//     return Tracker2Gen.createUpdateResult({
//       guiID: action.payload.guiID,
//       reason: `Failed to unblock ${action.payload.username}: ${error.desc}`,
//       result: 'error',
//     })
//   }
// }

const initProfile = () => {
  // TODO
  // Container.listenAction(ProfileGen.submitRevokeProof, submitRevokeProof)
  // Container.listenAction(ProfileGen.submitBlockUser, submitBlockUser)
  // Container.listenAction(ProfileGen.submitUnblockUser, submitUnblockUser)
  // initPgp()
  // initProofs()
}

export default initProfile
