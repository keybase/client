import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
import * as EngineGen from './engine-gen-gen'
import * as TeamBuildingGen from './team-building-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as CryptoGen from './crypto-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Platform from '../constants/platform'
import HiddenString from '../util/hidden-string'
import {TypedState} from '../util/container'
import commonTeamBuildingSaga, {filterForNs} from './team-building'

type OperationActionArgs = {
  operation: Types.Operations
  input: HiddenString
  inputType: Types.InputTypes
  recipients?: Array<string>
  options?: Types.EncryptOptions
  destinationDir?: HiddenString
}

type SetRecipientsSagaActions = CryptoGen.SetRecipientsPayload | CryptoGen.SetEncryptOptionsPayload
// Get list of users from crypto TeamBuilding for encrypt operation
const onSetRecipients = (state: TypedState, _: TeamBuildingGen.FinishedTeamBuildingPayload) => {
  const {username: currentUser} = state.config
  const {options} = state.crypto.encrypt

  const users = [...state.crypto.teamBuilding.finishedTeam]
  let hasSBS = false
  const usernames = users.map(user => {
    // If we're encrypting to service account that is not proven on keybase set
    // (SBS) then we *must* encrypt to ourselves
    if (user.serviceId == 'email') {
      hasSBS = true
      return `[${user.username}]@email`
    }
    if (user.serviceId !== 'keybase') {
      hasSBS = true
      return `${user.username}@${user.serviceId}`
    }
    return user.username
  })

  const actions: Array<SetRecipientsSagaActions> = []

  // User set themselves as a recipient, so don't show 'includeSelf' option
  // However we don't want to set hideIncludeSelf if we are also encrypting to an SBS user (since we must force includeSelf)
  if (usernames.includes(currentUser) && !hasSBS) {
    actions.push(CryptoGen.createSetEncryptOptions({hideIncludeSelf: true, options}))
  }
  actions.push(
    CryptoGen.createSetRecipients({
      hasSBS,
      operation: 'encrypt',
      recipients: usernames,
    })
  )
  return actions
}

const handleSaltpackOpenFile = (action: CryptoGen.OnSaltpackOpenFilePayload) => {
  const {operation} = action.payload
  const tab = Constants.CryptoSubTabs[operation]
  return RouteTreeGen.createNavigateAppend({
    path: ['cryptoRoot', tab],
  })
}

// Mobile is split into two routes (input and output). This Saga handler
// transitions to the output route on success
const handleOperationSuccessNavigation = (action: CryptoGen.OnOperationSuccessPayload) => {
  const {operation} = action.payload
  const outputRoute = Constants.outputRoute.get(operation) as Types.CryptoOutputRoute

  return RouteTreeGen.createNavigateAppend({
    path: [outputRoute],
  })
}

// more of a debounce to keep things simple
let throttleSetInputCurrentAction: CryptoGen.SetInputPayload | undefined
const throttleSetInput = async (action: CryptoGen.SetInputPayload) => {
  throttleSetInputCurrentAction = action
  await Container.timeoutPromise(100)
  return throttleSetInputCurrentAction === action
    ? CryptoGen.createSetInputThrottled({...action.payload})
    : false
}

/*
 * Handles conditions that require running or re-running Saltpack RPCs
 * 1. User changes input (text/file)
 * 2. User adds recipients to the Encrypt operation (after input is added)
 * 3. User changes options to Encrypt operation (after input is added)
 */
const handleRunOperation = (
  state: TypedState,
  action:
    | CryptoGen.SetInputThrottledPayload
    | CryptoGen.SetRecipientsPayload
    | CryptoGen.SetEncryptOptionsPayload
    | CryptoGen.ClearRecipientsPayload
    | CryptoGen.RunFileOperationPayload
    | CryptoGen.RunTextOperationPayload
) => {
  switch (action.type) {
    case CryptoGen.setInputThrottled: {
      const {operation, value, type} = action.payload
      const {inProgress} = state.crypto[operation]

      // Input (text or file) was cleared or deleted
      if (!value.stringValue()) {
        return CryptoGen.createClearInput({operation})
      }

      // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
      if (Platform.isMobile) return

      // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
      if (type === 'file') return

      // Defensive: Bail if a file operation is in progress.
      if (inProgress) return

      // Handle recipients and options for Encrypt
      if (operation === Constants.Operations.Encrypt) {
        const {recipients, options} = state.crypto.encrypt
        if (state.crypto.encrypt.meta.hasRecipients && state.crypto.encrypt.recipients?.length) {
          return makeOperationAction({
            input: value,
            inputType: type,
            operation,
            options,
            recipients,
          })
        }
        // If no recipients are set and the user adds input, we should default
        // to self encryption (with state.config.username as the only recipient)
        else {
          const {username} = state.config
          return makeOperationAction({
            input: value,
            inputType: type,
            operation,
            options,
            recipients: [username],
          })
        }
      }

      return makeOperationAction({input: value, inputType: type, operation})
    }
    // User already provided input (text or file) before setting the
    // recipients. Get the input and pass it to the operation
    case CryptoGen.setRecipients: {
      const {operation, recipients} = action.payload
      const {inProgress, input, inputType, options} = state.crypto.encrypt
      const unhiddenInput = input.stringValue()

      // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
      if (Platform.isMobile) return

      // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
      if (inputType === 'file') return

      // Defensive: Bail if a file operation is in progress.
      if (inProgress) return

      if (unhiddenInput && inputType) {
        return makeOperationAction({
          input,
          inputType,
          operation,
          options,
          recipients,
        })
      }
      return
    }
    case CryptoGen.clearRecipients: {
      const {operation} = action.payload
      const {username} = state.config
      const {inProgress, input, inputType, options} = state.crypto.encrypt
      const unhiddenInput = input.stringValue()

      // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
      if (Platform.isMobile) return

      // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
      if (inputType === 'file') return

      // Defensive: Bail if a file operation is in progress.
      if (inProgress) return

      if (unhiddenInput && inputType) {
        return makeOperationAction({
          input,
          inputType,
          operation,
          options,
          recipients: [username],
        })
      }
      return
    }
    // User provided input and recipients, when options change, re-run saltpackEncrypt
    case CryptoGen.setEncryptOptions: {
      const {options} = action.payload
      const {recipients, inProgress, input, inputType} = state.crypto.encrypt
      const {username} = state.config
      const unhiddenInput = input.stringValue()

      // Do not run operations automatically on mobile. Wait for CryptoGen.runTextOperation
      if (Platform.isMobile) return

      // Bail on automatically running file operations. Wait for CryptoGen.runFileOperation
      if (inputType === 'file') return

      // Defensive: Bail if a file operation is in progress.
      if (inProgress) return

      // If no recipients are set and the user adds input, we should default
      // to self encryption (with state.config.username as the only recipient)
      if (unhiddenInput && inputType) {
        return makeOperationAction({
          input,
          inputType,
          operation: Constants.Operations.Encrypt,
          options,
          recipients: recipients?.length ? recipients : [username],
        })
      }
      return
    }
    // Mobile: Run text operation and transition to output route
    case CryptoGen.runTextOperation: {
      const {operation} = action.payload
      const {input, inputType} = state.crypto[operation]
      const {username} = state.config

      const args: OperationActionArgs = {
        input,
        inputType,
        operation,
      }

      if (operation === Constants.Operations.Encrypt) {
        const recipients = state.crypto.encrypt.recipients?.length
          ? state.crypto.encrypt.recipients
          : [username]
        args.recipients = recipients
        args.options = state.crypto.encrypt.options
      }

      return makeOperationAction(args)
    }
    // Run file RPCs after destination set
    case CryptoGen.runFileOperation: {
      const {operation, destinationDir} = action.payload
      const {input, inputType} = state.crypto[operation]
      const {username} = state.config
      const args: OperationActionArgs = {
        destinationDir,
        input,
        inputType,
        operation,
      }

      if (operation === Constants.Operations.Encrypt) {
        const recipients = state.crypto.encrypt.recipients?.length
          ? state.crypto.encrypt.recipients
          : [username]
        args.recipients = recipients
        args.options = state.crypto.encrypt.options
      }

      return makeOperationAction(args)
    }
    default:
      return
  }
}

// Dispatch action to appropriate operation
const makeOperationAction = (p: OperationActionArgs) => {
  const {operation, input, inputType, recipients, options, destinationDir} = p
  switch (operation) {
    case Constants.Operations.Encrypt: {
      return recipients && recipients.length && options
        ? CryptoGen.createSaltpackEncrypt({destinationDir, input, options, recipients, type: inputType})
        : null
    }
    case Constants.Operations.Decrypt:
      return CryptoGen.createSaltpackDecrypt({destinationDir, input, type: inputType})
    case Constants.Operations.Sign:
      return CryptoGen.createSaltpackSign({destinationDir, input, type: inputType})
    case Constants.Operations.Verify:
      return CryptoGen.createSaltpackVerify({destinationDir, input, type: inputType})
    default:
      return
  }
}

const saltpackEncrypt = async (
  state: TypedState,
  action: CryptoGen.SaltpackEncryptPayload,
  logger: Saga.SagaLogger
) => {
  const {username} = state.config
  const {destinationDir, input, recipients, type, options} = action.payload
  switch (type) {
    case 'file': {
      try {
        const fileRes = await RPCTypes.saltpackSaltpackEncryptFileRpcPromise(
          {
            destinationDir: destinationDir?.stringValue() ?? '',
            filename: input.stringValue(),
            opts: {
              includeSelf: options.includeSelf,
              recipients: recipients,
              signed: options.sign,
            },
          },
          Constants.encryptFileWaitingKey
        )

        return CryptoGen.createOnOperationSuccess({
          input: action,
          operation: Constants.Operations.Encrypt,
          output: new HiddenString(fileRes.filename),
          outputSenderUsername: options.sign ? new HiddenString(username) : undefined,
          outputSigned: options.sign,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Encrypt, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Encrypt,
        })
      }
    }
    case 'text': {
      try {
        const encryptRes = await RPCTypes.saltpackSaltpackEncryptStringRpcPromise(
          {
            opts: {
              includeSelf: options.includeSelf,
              recipients: recipients,
              signed: options.sign,
            },
            plaintext: input.stringValue(),
          },
          Constants.encryptStringWaitingKey
        )
        const warningMessage = Constants.getWarningMessageForSBS(encryptRes.unresolvedSBSAssertion)

        return CryptoGen.createOnOperationSuccess({
          input: action,
          operation: Constants.Operations.Encrypt,
          output: new HiddenString(encryptRes.ciphertext),
          outputSenderUsername: options.sign ? new HiddenString(username) : undefined,
          outputSigned: options.sign,
          outputType: type,
          warning: encryptRes.usedUnresolvedSBS,
          warningMessage: new HiddenString(warningMessage),
        })
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Encrypt, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Encrypt,
        })
      }
    }
    default: {
      logger.error(
        `Attempted to call saltpackEncrypt with invalid type ${type}. Valid saltpack encrypt types are { text, file }`
      )
      return
    }
  }
}

const saltpackDecrypt = async (action: CryptoGen.SaltpackDecryptPayload, logger: Saga.SagaLogger) => {
  const {destinationDir, input, type} = action.payload

  switch (type) {
    case 'file': {
      try {
        const result = await RPCTypes.saltpackSaltpackDecryptFileRpcPromise(
          {
            destinationDir: destinationDir?.stringValue() ?? '',
            encryptedFilename: input.stringValue(),
          },
          Constants.decryptFileWaitingKey
        )
        const {decryptedFilename, info, signed} = result
        const {sender} = info
        const {username, fullname} = sender
        const outputSigned = signed

        return [
          CryptoGen.createOnOperationSuccess({
            input: action,
            operation: Constants.Operations.Decrypt,
            output: new HiddenString(decryptedFilename),
            outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
            outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
            outputSigned,
            outputType: type,
          }),
        ]
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Decrypt, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Decrypt,
        })
      }
    }
    case 'text': {
      try {
        const result = await RPCTypes.saltpackSaltpackDecryptStringRpcPromise(
          {ciphertext: input.stringValue()},
          Constants.decryptStringWaitingKey
        )
        const {plaintext, info, signed} = result
        const {sender} = info
        const {username, fullname} = sender
        const outputSigned = signed

        return [
          CryptoGen.createOnOperationSuccess({
            input: action,
            operation: Constants.Operations.Decrypt,
            output: new HiddenString(plaintext),
            outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
            outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
            outputSigned,
            outputType: type,
          }),
        ]
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Decrypt, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Decrypt,
        })
      }
    }
    default: {
      logger.error(
        `Attempted to call saltpackEncrypt with invalid type=${type}. Valid saltpack decrypt types are { text, file }`
      )
      return
    }
  }
}

const saltpackSign = async (
  state: TypedState,
  action: CryptoGen.SaltpackSignPayload,
  logger: Saga.SagaLogger
) => {
  const {username} = state.config
  const {destinationDir, input, type} = action.payload
  switch (type) {
    case 'file': {
      try {
        const signedFilename = await RPCTypes.saltpackSaltpackSignFileRpcPromise(
          {
            destinationDir: destinationDir?.stringValue() ?? '',
            filename: input.stringValue(),
          },
          Constants.signFileWaitingKey
        )
        return CryptoGen.createOnOperationSuccess({
          input: action,
          operation: Constants.Operations.Sign,
          output: new HiddenString(signedFilename),
          outputSenderUsername: new HiddenString(username),
          outputSigned: true,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Sign, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Sign,
        })
      }
    }
    case 'text': {
      try {
        const ciphertext = await RPCTypes.saltpackSaltpackSignStringRpcPromise(
          {plaintext: input.stringValue()},
          Constants.signStringWaitingKey
        )
        return CryptoGen.createOnOperationSuccess({
          input: action,
          operation: Constants.Operations.Sign,
          output: new HiddenString(ciphertext),
          outputSenderUsername: new HiddenString(username),
          outputSigned: true,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Sign, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Sign,
        })
      }
    }
    default: {
      logger.error(
        `Attempted to call saltpackSign with invalid type=${type}. Valid saltpack sign types are { text, file }`
      )
      return
    }
  }
}

const saltpackVerify = async (action: CryptoGen.SaltpackVerifyPayload, logger: Saga.SagaLogger) => {
  const {destinationDir, input, type} = action.payload
  switch (type) {
    case 'file': {
      try {
        const result = await RPCTypes.saltpackSaltpackVerifyFileRpcPromise(
          {
            destinationDir: destinationDir?.stringValue() ?? '',
            signedFilename: input.stringValue(),
          },
          Constants.verifyFileWaitingKey
        )
        const {verifiedFilename, sender, verified} = result
        const {username, fullname} = sender
        const outputSigned = verified

        return [
          CryptoGen.createOnOperationSuccess({
            input: action,
            operation: Constants.Operations.Verify,
            output: new HiddenString(verifiedFilename),
            outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
            outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
            outputSigned,
            outputType: type,
          }),
        ]
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Verify, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Verify,
        })
      }
    }
    case 'text': {
      try {
        const result = await RPCTypes.saltpackSaltpackVerifyStringRpcPromise(
          {signedMsg: input.stringValue()},
          Constants.verifyStringWaitingKey
        )
        const {plaintext, sender, verified} = result
        const {username, fullname} = sender
        const outputSigned = verified

        return [
          CryptoGen.createOnOperationSuccess({
            input: action,
            operation: Constants.Operations.Verify,
            output: new HiddenString(plaintext),
            outputSenderFullname: outputSigned ? new HiddenString(fullname) : undefined,
            outputSenderUsername: outputSigned ? new HiddenString(username) : undefined,
            outputSigned,
            outputType: type,
          }),
        ]
      } catch (err) {
        logger.error(err)
        const message = Constants.getStatusCodeMessage(err, Constants.Operations.Verify, type)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString(message),
          operation: Constants.Operations.Verify,
        })
      }
    }
    default: {
      logger.error(
        `Attempted to call saltpackSign with invalid type=${type}. Valid saltpack sign types are { text, file }`
      )
      return
    }
  }
}

const saltpackStart = (action: EngineGen.Keybase1NotifySaltpackSaltpackOperationStartPayload) =>
  CryptoGen.createSaltpackStart({
    filename: new HiddenString(action.payload.params.filename),
    operation: RPCTypes.SaltpackOperationType[action.payload.params.opType] as Types.Operations,
  })

const saltpackProgress = (action: EngineGen.Keybase1NotifySaltpackSaltpackOperationProgressPayload) =>
  CryptoGen.createSaltpackProgress({
    bytesComplete: action.payload.params.bytesComplete,
    bytesTotal: action.payload.params.bytesTotal,
    filename: new HiddenString(action.payload.params.filename),
    operation: RPCTypes.SaltpackOperationType[action.payload.params.opType] as Types.Operations,
  })

const saltpackDone = (action: EngineGen.Keybase1NotifySaltpackSaltpackOperationDonePayload) =>
  CryptoGen.createSaltpackDone({
    filename: new HiddenString(action.payload.params.filename),
    operation: RPCTypes.SaltpackOperationType[action.payload.params.opType] as Types.Operations,
  })

const downloadEncryptedText = async (state: TypedState) => {
  const {output, outputSenderUsername, outputSenderFullname, outputSigned} = state.crypto.encrypt
  const result = await RPCTypes.saltpackSaltpackSaveCiphertextToFileRpcPromise({
    ciphertext: output.stringValue(),
  })
  return CryptoGen.createOnOperationSuccess({
    input: undefined,
    operation: Constants.Operations.Encrypt,
    output: new HiddenString(result),
    outputSenderFullname,
    outputSenderUsername,
    outputSigned: !!outputSigned,
    outputType: 'file',
  })
}

const downloadSignedText = async (state: TypedState) => {
  const {output, outputSenderUsername, outputSenderFullname, outputSigned} = state.crypto.sign
  const result = await RPCTypes.saltpackSaltpackSaveSignedMsgToFileRpcPromise({
    signedMsg: output.stringValue(),
  })
  return CryptoGen.createOnOperationSuccess({
    input: undefined,
    operation: Constants.Operations.Sign,
    output: new HiddenString(result),
    outputSenderFullname,
    outputSenderUsername,
    outputSigned: !!outputSigned,
    outputType: 'file',
  })
}

function* teamBuildingSaga() {
  yield* commonTeamBuildingSaga('crypto')

  // This action is used to hook into the TeamBuildingGen.finishedTeamBuilding action.
  // We want this so that we can figure out which user(s) havbe been selected and pass that result over to store.crypto.encrypt.recipients
  yield* Saga.chainAction2(TeamBuildingGen.finishedTeamBuilding, filterForNs('crypto', onSetRecipients))
}

function* cryptoSaga() {
  yield* Saga.chainAction2(CryptoGen.downloadEncryptedText, downloadEncryptedText)
  yield* Saga.chainAction2(CryptoGen.downloadSignedText, downloadSignedText)
  yield* Saga.chainAction(CryptoGen.setInput, throttleSetInput)
  yield* Saga.chainAction2(
    [
      CryptoGen.setInputThrottled,
      CryptoGen.setRecipients,
      CryptoGen.setEncryptOptions,
      CryptoGen.clearRecipients,
      CryptoGen.runTextOperation,
      CryptoGen.runFileOperation,
    ],
    handleRunOperation
  )
  yield* Saga.chainAction2(CryptoGen.saltpackEncrypt, saltpackEncrypt)
  yield* Saga.chainAction(CryptoGen.saltpackDecrypt, saltpackDecrypt)
  yield* Saga.chainAction2(CryptoGen.saltpackSign, saltpackSign)
  yield* Saga.chainAction(CryptoGen.saltpackVerify, saltpackVerify)
  yield* Saga.chainAction(CryptoGen.onSaltpackOpenFile, handleSaltpackOpenFile)
  yield* Saga.chainAction(EngineGen.keybase1NotifySaltpackSaltpackOperationStart, saltpackStart)
  yield* Saga.chainAction(EngineGen.keybase1NotifySaltpackSaltpackOperationProgress, saltpackProgress)
  yield* Saga.chainAction(EngineGen.keybase1NotifySaltpackSaltpackOperationDone, saltpackDone)
  if (Platform.isMobile) {
    yield* Saga.chainAction(CryptoGen.onOperationSuccess, handleOperationSuccessNavigation)
  }
  yield* teamBuildingSaga()
}

export default cryptoSaga
