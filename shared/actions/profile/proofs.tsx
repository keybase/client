// TODO
// import * as Constants from '../../constants/profile'
// import * as ConfigConstants from '../../constants/config'
// import * as Container from '../../util/container'
// import * as LinksConstants from '../../constants/deeplinks'
// import * as More from '../../constants/types/more'
// import * as ProfileGen from '../profile-gen'
// import * as RPCTypes from '../../constants/types/rpc-gen'
// import * as RouteTreeGen from '../route-tree-gen'
// import * as Tracker2Constants from '../../constants/tracker2'
// import * as Tracker2Gen from '../tracker2-gen'
// import logger from '../../logger'
// import openURL from '../../util/open-url'
// import {RPCError} from '../../util/errors'

// const recheckProof = async (_: unknown, action: ProfileGen.RecheckProofPayload) => {
//   await RPCTypes.proveCheckProofRpcPromise({sigID: action.payload.sigID}, Constants.waitingKey)
//   return Tracker2Gen.createShowUser({
//     asTracker: false,
//     username: ConfigConstants.useCurrentUserState.getState().username,
//   })
// }

// const submitCryptoAddress = async (
//   state: Container.TypedState,
//   action: ProfileGen.SubmitBTCAddressPayload | ProfileGen.SubmitZcashAddressPayload
// ) => {
//   if (!state.profile.usernameValid) {
//     return ProfileGen.createUpdateErrorText({errorCode: 0, errorText: 'Invalid address format'})
//   }

//   const address = state.profile.username

//   let wantedFamily: 'bitcoin' | 'zcash' | undefined
//   switch (action.type) {
//     case ProfileGen.submitBTCAddress:
//       wantedFamily = 'bitcoin'
//       break
//     case ProfileGen.submitZcashAddress:
//       wantedFamily = 'zcash'
//       break
//     default:
//       throw new Error('Unknown wantedfamily')
//   }

//   try {
//     await RPCTypes.cryptocurrencyRegisterAddressRpcPromise(
//       {address, force: true, wantedFamily},
//       Constants.waitingKey
//     )
//     return [
//       ProfileGen.createUpdateProofStatus({found: true, status: RPCTypes.ProofStatus.ok}),
//       RouteTreeGen.createNavigateAppend({path: ['profileConfirmOrPending']}),
//     ]
//   } catch (error) {
//     if (error instanceof RPCError) {
//       logger.warn('Error making proof')
//       return ProfileGen.createUpdateErrorText({errorCode: error.code, errorText: error.desc})
//     }
//     return
//   }
// }

export const initProofs = () => {
  // Container.listenAction([ProfileGen.submitBTCAddress, ProfileGen.submitZcashAddress], submitCryptoAddress)
  // Container.listenAction(ProfileGen.checkProof, checkProof)
  // Container.listenAction(ProfileGen.recheckProof, recheckProof)
}
