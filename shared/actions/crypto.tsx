import * as Container from '../util/container'
// import type * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
// import * as ConfigConstants from '../constants/config'
// import * as EngineGen from './engine-gen-gen'
// import * as TeamBuildingGen from './team-building-gen'
// import * as RouteTreeGen from './route-tree-gen'
import * as ConfigGen from './config-gen'
// import * as RPCTypes from '../constants/types/rpc-gen'
// import * as Platform from '../constants/platform'
// import HiddenString from '../util/hidden-string'
// import {RPCError} from '../util/errors'
// import {commonListenActions, filterForNs} from './team-building'
// import logger from '../logger'

// type OperationActionArgs = {
//   operation: Types.Operations
//   input: HiddenString
//   inputType: Types.InputTypes
//   recipients?: Array<string>
//   options?: Types.EncryptOptions
//   destinationDir?: HiddenString
// }

// type SetRecipientsSagaActions = CryptoGen.SetRecipientsPayload | CryptoGen.SetEncryptOptionsPayload
// // Get list of users from crypto TeamBuilding for encrypt operation
// const onSetRecipients = (state: Container.TypedState) => {
//   const currentUser = ConfigConstants.useCurrentUserState.getState().username
//   const {options} = state.crypto.encrypt

//   const users = [...state.crypto.teamBuilding.finishedTeam]
//   let hasSBS = false
//   const usernames = users.map(user => {
//     // If we're encrypting to service account that is not proven on keybase set
//     // (SBS) then we *must* encrypt to ourselves
//     if (user.serviceId == 'email') {
//       hasSBS = true
//       return `[${user.username}]@email`
//     }
//     if (user.serviceId !== 'keybase') {
//       hasSBS = true
//       return `${user.username}@${user.serviceId}`
//     }
//     return user.username
//   })

//   const actions: Array<SetRecipientsSagaActions> = []

//   // User set themselves as a recipient, so don't show 'includeSelf' option
//   // However we don't want to set hideIncludeSelf if we are also encrypting to an SBS user (since we must force includeSelf)
//   if (usernames.includes(currentUser) && !hasSBS) {
//     actions.push(CryptoGen.createSetEncryptOptions({hideIncludeSelf: true, options}))
//   }
//   actions.push(
//     CryptoGen.createSetRecipients({
//       hasSBS,
//       operation: 'encrypt',
//       recipients: usernames,
//     })
//   )
//   return actions
// }

// const CryptoSubTabs = {
//   decrypt: Constants.decryptTab,
//   encrypt: Constants.encryptTab,
//   sign: Constants.signTab,
//   verify: Constants.verifyTab,
// } as const

// const handleSaltpackOpenFile = (_, action: CryptoGen.OnSaltpackOpenFilePayload) => {
//   const {operation} = action.payload
//   const tab = CryptoSubTabs[operation]
//   return RouteTreeGen.createNavigateAppend({
//     path: ['cryptoRoot', tab],
//   })
// }

// Mobile is split into two routes (input and output). This Saga handler
// transitions to the output route on success
// const coutputRoute = new Map([
//   ['decrypt', Constants.decryptOutput],
//   ['encrypt', Constants.encryptOutput],
//   ['sign', Constants.signOutput],
//   ['verify', Constants.verifyOutput],
// ] as const)
// const handleOperationSuccessNavigation = (_, action: CryptoGen.OnOperationSuccessPayload) => {
//   const {operation} = action.payload
//   const outputRoute = coutputRoute.get(operation)
//   return (
//     outputRoute &&
//     RouteTreeGen.createNavigateAppend({
//       path: [outputRoute],
//     })
//   )
// }

/*
 * Handles conditions that require running or re-running Saltpack RPCs
 * 1. User changes input (text/file)
 * 2. User adds recipients to the Encrypt operation (after input is added)
 * 3. User changes options to Encrypt operation (after input is added)
 */
// const handleRunOperation = (
//   state: Container.TypedState,
//   action:
//     | CryptoGen.SetInputThrottledPayload
//     | CryptoGen.SetRecipientsPayload
//     | CryptoGen.SetEncryptOptionsPayload
//     | CryptoGen.ClearRecipientsPayload
//     | CryptoGen.RunFileOperationPayload
//     | CryptoGen.RunTextOperationPayload
// ) => {
//   switch (action.type) {
//     case CryptoGen.setInputThrottled: {
//       // const {operation, value, type} = action.payload
//       // const {inProgress} = state.crypto[operation]
//       // Input (text or file) was cleared or deleted
//       // if (!value.stringValue()) {
//       //   return CryptoGen.createClearInput({operation})
//       // }
//       // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
//       // if (Platform.isMobile) return
//       // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
//       // if (type === 'file') return
//       // // Defensive: Bail if a file operation is in progress.
//       // if (inProgress) return
//       // Handle recipients and options for Encrypt
//       // if (operation === Constants.Operations.Encrypt) {
//       //   const {recipients, options} = state.crypto.encrypt
//       //   if (state.crypto.encrypt.meta.hasRecipients && state.crypto.encrypt.recipients?.length) {
//       //     return makeOperationAction({
//       //       input: value,
//       //       inputType: type,
//       //       operation,
//       //       options,
//       //       recipients,
//       //     })
//       //   }
//       //   // If no recipients are set and the user adds input, we should default
//       //   // to self encryption (with state.config.username as the only recipient)
//       //   else {
//       //     const username = ConfigConstants.useCurrentUserState.getState().username
//       //     return makeOperationAction({
//       //       input: value,
//       //       inputType: type,
//       //       operation,
//       //       options,
//       //       recipients: [username],
//       //     })
//       //   }
//       // }
//       // return makeOperationAction({input: value, inputType: type, operation})
//     }
//     // User already provided input (text or file) before setting the
//     // recipients. Get the input and pass it to the operation
//     case CryptoGen.setRecipients: {
//       const {operation, recipients} = action.payload
//       const {inProgress, input, inputType, options} = state.crypto.encrypt
//       const unhiddenInput = input.stringValue()

//       // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
//       if (Platform.isMobile) return

//       // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
//       if (inputType === 'file') return

//       // Defensive: Bail if a file operation is in progress.
//       if (inProgress) return

//       if (unhiddenInput && inputType) {
//         return makeOperationAction({
//           input,
//           inputType,
//           operation,
//           options,
//           recipients,
//         })
//       }
//       return
//     }
//     case CryptoGen.clearRecipients: {
//       const {operation} = action.payload
//       const username = ConfigConstants.useCurrentUserState.getState().username
//       const {inProgress, input, inputType, options} = state.crypto.encrypt
//       const unhiddenInput = input.stringValue()

//       // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
//       if (Platform.isMobile) return

//       // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
//       if (inputType === 'file') return

//       // Defensive: Bail if a file operation is in progress.
//       if (inProgress) return

//       if (unhiddenInput && inputType) {
//         return makeOperationAction({
//           input,
//           inputType,
//           operation,
//           options,
//           recipients: [username],
//         })
//       }
//       return
//     }
//     // User provided input and recipients, when options change, re-run saltpackEncrypt
//     case CryptoGen.setEncryptOptions: {
//       const {options} = action.payload
//       const {recipients, inProgress, input, inputType} = state.crypto.encrypt
//       const username = ConfigConstants.useCurrentUserState.getState().username
//       const unhiddenInput = input.stringValue()

//       // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
//       if (Platform.isMobile) return

//       // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
//       if (inputType === 'file') return

//       // Defensive: Bail if a file operation is in progress.
//       if (inProgress) return

//       // If no recipients are set and the user adds input, we should default
//       // to self encryption (with state.config.username as the only recipient)
//       if (unhiddenInput && inputType) {
//         return makeOperationAction({
//           input,
//           inputType,
//           operation: Constants.Operations.Encrypt,
//           options,
//           recipients: recipients?.length ? recipients : [username],
//         })
//       }
//       return
//     }
//     // Mobile: Run text operation and transition to output route
//     case CryptoGen.runTextOperation: {
//       const {operation} = action.payload
//       const {input, inputType} = state.crypto[operation]
//       const username = ConfigConstants.useCurrentUserState.getState().username

//       const args: OperationActionArgs = {
//         input,
//         inputType,
//         operation,
//       }

//       if (operation === Constants.Operations.Encrypt) {
//         const recipients = state.crypto.encrypt.recipients?.length
//           ? state.crypto.encrypt.recipients
//           : [username]
//         args.recipients = recipients
//         args.options = state.crypto.encrypt.options
//       }

//       return makeOperationAction(args)
//     }
//     // Run file RPCs after destination set
//     case CryptoGen.runFileOperation: {
//       const {operation, destinationDir} = action.payload
//       const {input, inputType} = state.crypto[operation]
//       const username = ConfigConstants.useCurrentUserState.getState().username
//       const args: OperationActionArgs = {
//         destinationDir,
//         input,
//         inputType,
//         operation,
//       }

//       if (operation === Constants.Operations.Encrypt) {
//         const recipients = state.crypto.encrypt.recipients?.length
//           ? state.crypto.encrypt.recipients
//           : [username]
//         args.recipients = recipients
//         args.options = state.crypto.encrypt.options
//       }

//       return makeOperationAction(args)
//     }
//     default:
//       return
//   }
// }

const initCrypto = () => {
  Container.listenAction(ConfigGen.resetStore, () => {
    Constants.useState.getState().dispatch.reset()
  })

  // commonListenActions('crypto')
  // // This action is used to hook into the TeamBuildingGen.finishedTeamBuilding action.
  // // We want this so that we can figure out which user(s) havbe been selected and pass that result over to store.crypto.encrypt.recipients
  // Container.listenAction(TeamBuildingGen.finishedTeamBuilding, filterForNs('crypto', onSetRecipients))
}

export default initCrypto
