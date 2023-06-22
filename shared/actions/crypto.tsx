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

// more of a debounce to keep things simple
// let throttleSetInputCurrentAction: CryptoGen.SetInputPayload | undefined
// const throttleSetInput = async (_, action: CryptoGen.SetInputPayload) => {
//   throttleSetInputCurrentAction = action
//   await Container.timeoutPromise(100)
//   return throttleSetInputCurrentAction === action
//     ? CryptoGen.createSetInputThrottled({...action.payload})
//     : false
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

// Dispatch action to appropriate operation
// const makeOperationAction = (p: OperationActionArgs) => {
//   const {operation, input, inputType, recipients, options, destinationDir} = p
//   switch (operation) {
//     case Constants.Operations.Encrypt: {
//       return recipients?.length && options
//         ? CryptoGen.createSaltpackEncrypt({destinationDir, input, options, recipients, type: inputType})
//         : null
//     }
//     case Constants.Operations.Decrypt:
//       return CryptoGen.createSaltpackDecrypt({destinationDir, input, type: inputType})
//     case Constants.Operations.Sign:
//       return CryptoGen.createSaltpackSign({destinationDir, input, type: inputType})
//     case Constants.Operations.Verify:
//       return CryptoGen.createSaltpackVerify({destinationDir, input, type: inputType})
//     default:
//       return
//   }
// }

// const saltpackEncrypt = async (_: unknown, action: CryptoGen.SaltpackEncryptPayload) => {
//   const username = ConfigConstants.useCurrentUserState.getState().username
//   const {destinationDir, input, recipients, type, options} = action.payload
//   switch (type) {
//     case 'file': {
//       try {
//         const fileRes = await RPCTypes.saltpackSaltpackEncryptFileRpcPromise(
//           {
//             destinationDir: destinationDir?.stringValue() ?? '',
//             filename: input.stringValue(),
//             opts: {
//               includeSelf: options.includeSelf,
//               recipients: recipients,
//               signed: options.sign,
//             },
//           },
//           Constants.waitingKey
//         )

//         return CryptoGen.createOnOperationSuccess({
//           input: action,
//           operation: Constants.Operations.Encrypt,
//           output: new HiddenString(fileRes.filename),
//           outputSenderUsername: options.sign ? new HiddenString(username) : undefined,
//           outputSigned: options.sign,
//           outputType: type,
//         })
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Encrypt, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Encrypt,
//         })
//       }
//     }
//     case 'text': {
//       try {
//         const encryptRes = await RPCTypes.saltpackSaltpackEncryptStringRpcPromise(
//           {
//             opts: {
//               includeSelf: options.includeSelf,
//               recipients: recipients,
//               signed: options.sign,
//             },
//             plaintext: input.stringValue(),
//           },
//           Constants.waitingKey
//         )
//         const warningMessage = `Note: Encrypted for "${encryptRes.unresolvedSBSAssertion}" who is not yet a Keybase user. One of your devices will need to be online after they join Keybase in order for them to decrypt the message.`

//         return CryptoGen.createOnOperationSuccess({
//           input: action,
//           operation: Constants.Operations.Encrypt,
//           output: new HiddenString(encryptRes.ciphertext),
//           outputSenderUsername: options.sign ? new HiddenString(username) : undefined,
//           outputSigned: options.sign,
//           outputType: type,
//           warning: encryptRes.usedUnresolvedSBS,
//           warningMessage: new HiddenString(warningMessage),
//         })
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Encrypt, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Encrypt,
//         })
//       }
//     }
//     default: {
//       logger.error(
//         `Attempted to call saltpackEncrypt with invalid type ${type}. Valid saltpack encrypt types are { text, file }`
//       )
//       return
//     }
//   }
// }

// const saltpackDecrypt = async (_, action: CryptoGen.SaltpackDecryptPayload) => {
//   const {destinationDir, input, type} = action.payload

//   switch (type) {
//     case 'file': {
//       try {
//         const result = await RPCTypes.saltpackSaltpackDecryptFileRpcPromise(
//           {
//             destinationDir: destinationDir?.stringValue() ?? '',
//             encryptedFilename: input.stringValue(),
//           },
//           Constants.waitingKey
//         )
//         const {decryptedFilename, info, signed} = result
//         const {sender} = info
//         const {username, fullname} = sender
//         const outputSigned = signed

//         return [
//           CryptoGen.createOnOperationSuccess({
//             input: action,
//             operation: Constants.Operations.Decrypt,
//             output: new HiddenString(decryptedFilename),
//             outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
//             outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
//             outputSigned,
//             outputType: type,
//           }),
//         ]
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Decrypt, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Decrypt,
//         })
//       }
//     }
//     case 'text': {
//       try {
//         const result = await RPCTypes.saltpackSaltpackDecryptStringRpcPromise(
//           {ciphertext: input.stringValue()},
//           Constants.waitingKey
//         )
//         const {plaintext, info, signed} = result
//         const {sender} = info
//         const {username, fullname} = sender
//         const outputSigned = signed

//         return [
//           CryptoGen.createOnOperationSuccess({
//             input: action,
//             operation: Constants.Operations.Decrypt,
//             output: new HiddenString(plaintext),
//             outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
//             outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
//             outputSigned,
//             outputType: type,
//           }),
//         ]
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Decrypt, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Decrypt,
//         })
//       }
//     }
//     default: {
//       logger.error(
//         `Attempted to call saltpackEncrypt with invalid type=${type}. Valid saltpack decrypt types are { text, file }`
//       )
//       return
//     }
//   }
// }

// const saltpackSign = async (_: unknown, action: CryptoGen.SaltpackSignPayload) => {
//   const username = ConfigConstants.useCurrentUserState.getState().username
//   const {destinationDir, input, type} = action.payload
//   switch (type) {
//     case 'file': {
//       try {
//         const signedFilename = await RPCTypes.saltpackSaltpackSignFileRpcPromise(
//           {
//             destinationDir: destinationDir?.stringValue() ?? '',
//             filename: input.stringValue(),
//           },
//           Constants.waitingKey
//         )
//         return CryptoGen.createOnOperationSuccess({
//           input: action,
//           operation: Constants.Operations.Sign,
//           output: new HiddenString(signedFilename),
//           outputSenderUsername: new HiddenString(username),
//           outputSigned: true,
//           outputType: type,
//         })
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Sign, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Sign,
//         })
//       }
//     }
//     case 'text': {
//       try {
//         const ciphertext = await RPCTypes.saltpackSaltpackSignStringRpcPromise(
//           {plaintext: input.stringValue()},
//           Constants.waitingKey
//         )
//         return CryptoGen.createOnOperationSuccess({
//           input: action,
//           operation: Constants.Operations.Sign,
//           output: new HiddenString(ciphertext),
//           outputSenderUsername: new HiddenString(username),
//           outputSigned: true,
//           outputType: type,
//         })
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Sign, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Sign,
//         })
//       }
//     }
//     default: {
//       logger.error(
//         `Attempted to call saltpackSign with invalid type=${type}. Valid saltpack sign types are { text, file }`
//       )
//       return
//     }
//   }
// }

// const saltpackVerify = async (_, action: CryptoGen.SaltpackVerifyPayload) => {
//   const {destinationDir, input, type} = action.payload
//   switch (type) {
//     case 'file': {
//       try {
//         const result = await RPCTypes.saltpackSaltpackVerifyFileRpcPromise(
//           {
//             destinationDir: destinationDir?.stringValue() ?? '',
//             signedFilename: input.stringValue(),
//           },
//           Constants.waitingKey
//         )
//         const {verifiedFilename, sender, verified} = result
//         const {username, fullname} = sender
//         const outputSigned = verified

//         return [
//           CryptoGen.createOnOperationSuccess({
//             input: action,
//             operation: Constants.Operations.Verify,
//             output: new HiddenString(verifiedFilename),
//             outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
//             outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
//             outputSigned,
//             outputType: type,
//           }),
//         ]
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Verify, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Verify,
//         })
//       }
//     }
//     case 'text': {
//       try {
//         const result = await RPCTypes.saltpackSaltpackVerifyStringRpcPromise(
//           {signedMsg: input.stringValue()},
//           Constants.waitingKey
//         )
//         const {plaintext, sender, verified} = result
//         const {username, fullname} = sender
//         const outputSigned = verified

//         return [
//           CryptoGen.createOnOperationSuccess({
//             input: action,
//             operation: Constants.Operations.Verify,
//             output: new HiddenString(plaintext),
//             outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
//             outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
//             outputSigned,
//             outputType: type,
//           }),
//         ]
//       } catch (error) {
//         if (!(error instanceof RPCError)) {
//           return
//         }
//         logger.error(error)
//         const message = getStatusCodeMessage(error, Constants.Operations.Verify, type)
//         return CryptoGen.createOnOperationError({
//           errorMessage: new HiddenString(message),
//           operation: Constants.Operations.Verify,
//         })
//       }
//     }
//     default: {
//       logger.error(
//         `Attempted to call saltpackSign with invalid type=${type}. Valid saltpack sign types are { text, file }`
//       )
//       return
//     }
//   }
// }

// const enumToOp = (e: RPCTypes.SaltpackOperationType): Types.Operations => {
//   switch (e) {
//     case RPCTypes.SaltpackOperationType.encrypt:
//       return 'encrypt'
//     case RPCTypes.SaltpackOperationType.decrypt:
//       return 'decrypt'
//     case RPCTypes.SaltpackOperationType.sign:
//       return 'sign'
//     case RPCTypes.SaltpackOperationType.verify:
//       return 'verify'
//   }
//   throw new Error('Invalid enumToOp')
// }

const initCrypto = () => {
  Container.listenAction(ConfigGen.resetStore, () => {
    Constants.useState.getState().dispatch.reset()
  })

  // Container.listenAction(
  //   [
  //     CryptoGen.setInputThrottled,
  //     CryptoGen.setRecipients,
  //     CryptoGen.setEncryptOptions,
  //     CryptoGen.clearRecipients,
  //     CryptoGen.runTextOperation,
  //     CryptoGen.runFileOperation,
  //   ],
  //   handleRunOperation
  // )
  // Container.listenAction(CryptoGen.saltpackEncrypt, saltpackEncrypt)
  // Container.listenAction(CryptoGen.saltpackSign, saltpackSign)
  // Container.listenAction(CryptoGen.saltpackDecrypt, saltpackDecrypt)
  // Container.listenAction(CryptoGen.saltpackVerify, saltpackVerify)
  // Container.listenAction(CryptoGen.onSaltpackOpenFile, handleSaltpackOpenFile)

  // Container.listenAction(EngineGen.keybase1NotifySaltpackSaltpackOperationStart, (_, action) => {
  //   Constants.useState.getState().dispatch.onSaltpackStart(enumToOp(action.payload.params.opType))
  // })
  // Container.listenAction(EngineGen.keybase1NotifySaltpackSaltpackOperationProgress, (_, action) => {
  //   Constants.useState
  //     .getState()
  //     .dispatch.onSaltpackProgress(
  //       enumToOp(action.payload.params.opType),
  //       action.payload.params.bytesComplete,
  //       action.payload.params.bytesTotal
  //     )
  // })
  // Container.listenAction(EngineGen.keybase1NotifySaltpackSaltpackOperationDone, (_, action) => {
  //   Constants.useState.getState().dispatch.onSaltpackDone(enumToOp(action.payload.params.opType))
  // })

  // if (Platform.isMobile) {
  //   Container.listenAction(CryptoGen.onOperationSuccess, handleOperationSuccessNavigation)
  // }
  // commonListenActions('crypto')
  // // This action is used to hook into the TeamBuildingGen.finishedTeamBuilding action.
  // // We want this so that we can figure out which user(s) havbe been selected and pass that result over to store.crypto.encrypt.recipients
  // Container.listenAction(TeamBuildingGen.finishedTeamBuilding, filterForNs('crypto', onSetRecipients))
}

export default initCrypto
