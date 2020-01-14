import * as Saga from '../util/saga'
import * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
import * as TeamBuildingGen from './team-building-gen'
import * as CryptoGen from './crypto-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'
import {TypedState} from '../util/container'
import commonTeamBuildingSaga, {filterForNs} from './team-building'

type SetRecipientsSagaActions =
  | TeamBuildingGen.CancelTeamBuildingPayload
  | CryptoGen.SetRecipientsPayload
  | CryptoGen.SetEncryptOptionsPayload
// Get list of users from crypto TeamBuilding for encrypt operation
const onSetRecipients = (state: TypedState, _: TeamBuildingGen.FinishedTeamBuildingPayload) => {
  const {username: currentUser} = state.config
  const {options} = state.crypto.encrypt

  const users = [...state.crypto.teamBuilding.finishedTeam]
  const usernames = users.map(user => user.username)

  const actions: Array<SetRecipientsSagaActions> = [
    TeamBuildingGen.createCancelTeamBuilding({namespace: 'crypto'}),
  ]

  // User set themselves as a recipient, so don't show 'includeSelf' option
  if (usernames.includes(currentUser)) {
    actions.push(CryptoGen.createSetEncryptOptions({noIncludeSelf: true, options}))
  }
  actions.push(CryptoGen.createSetRecipients({operation: 'encrypt', recipients: usernames}))
  return actions
}

function* teamBuildingSaga() {
  yield* commonTeamBuildingSaga('crypto')

  // This action is used to hook into the TeamBuildingGen.finishedTeamBuilding action.
  // We want this so that we can figure out which user(s) havbe been selected and pass that result over to store.crypto.encrypt.recipients
  yield* Saga.chainAction2(TeamBuildingGen.finishedTeamBuilding, filterForNs('crypto', onSetRecipients))
}

/*
 * Handles conditions that require running or re-running Saltpack RPCs
 * 1. User changes input (text/file)
 * 2. User adds recipients to the Encrypt operation (after input is added)
 * 3. User changes options to Encrypt operation (after input is added)
 */
const handleRunOperation = (
  state: TypedState,
  action: CryptoGen.SetInputPayload | CryptoGen.SetRecipientsPayload | CryptoGen.SetEncryptOptionsPayload
) => {
  switch (action.type) {
    case CryptoGen.setInput: {
      const {operation, value, type} = action.payload

      // Input (text or file) was cleared or deleted
      if (!value.stringValue()) {
        return CryptoGen.createClearInput({operation})
      }

      // Handle recipients and options for Encrypt
      if (operation === Constants.Operations.Encrypt) {
        if (state.crypto.encrypt.meta.hasRecipients && state.crypto.encrypt.recipients?.length) {
          const {recipients, options} = state.crypto.encrypt
          return makeOperationAction({
            input: value,
            inputType: type,
            operation,
            options,
            recipients,
          })
        } else {
          return
        }
      }

      return makeOperationAction({input: value, inputType: type, operation})
    }
    // User already provided input (text or file) before setting the
    // recipients. Get the input and pass it to the operation
    case CryptoGen.setRecipients: {
      const {operation, recipients} = action.payload
      const {input, inputType, options} = state.crypto.encrypt
      const unhiddenInput = input.stringValue()
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
    // User provided input and recipients, when options change, re-run saltpackEncrypt
    case CryptoGen.setEncryptOptions: {
      const {options} = action.payload
      const {recipients, input, inputType} = state.crypto.encrypt
      const unhiddenInput = input.stringValue()
      if (recipients && recipients.length && unhiddenInput && inputType) {
        return makeOperationAction({
          input,
          inputType,
          operation: Constants.Operations.Encrypt,
          options,
          recipients,
        })
      }
      return
    }
    default:
      return
  }
}

// Dispatch action to appropriate operation
const makeOperationAction = (p: {
  operation: Types.Operations
  input: HiddenString
  inputType: Types.InputTypes
  recipients?: Array<string>
  options?: Types.EncryptOptions
}) => {
  const {operation, input, inputType, recipients, options} = p
  switch (operation) {
    case Constants.Operations.Encrypt: {
      return recipients && recipients.length && options
        ? CryptoGen.createSaltpackEncrypt({input, options, recipients, type: inputType})
        : null
    }
    case Constants.Operations.Decrypt:
      return CryptoGen.createSaltpackDecrypt({input, type: inputType})
    case Constants.Operations.Sign:
      return CryptoGen.createSaltpackSign({input, type: inputType})
    case Constants.Operations.Verify:
      return CryptoGen.createSaltpackVerify({input, type: inputType})
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
  const {input, recipients, type, options} = action.payload
  switch (type) {
    case 'file': {
      try {
        const file = await RPCTypes.saltpackSaltpackEncryptFileRpcPromise({
          filename: input.stringValue(),
          opts: {
            includeSelf: options.includeSelf,
            recipients: recipients,
            signed: options.sign,
          },
        })
        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Encrypt,
          output: new HiddenString(file),
          outputSender: options.sign ? new HiddenString(username) : undefined,
          outputSigned: options.sign,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform encryption operation'),
          errorType: '',
          operation: Constants.Operations.Encrypt,
        })
      }
    }
    case 'text': {
      try {
        const ciphertext = await RPCTypes.saltpackSaltpackEncryptStringRpcPromise({
          opts: {
            includeSelf: options.includeSelf,
            recipients: recipients,
            signed: options.sign,
          },
          plaintext: input.stringValue(),
        })
        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Encrypt,
          output: new HiddenString(ciphertext),
          outputSender: options.sign ? new HiddenString(username) : undefined,
          outputSigned: options.sign,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform encryption operation'),
          errorType: '',
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
  const {input, type} = action.payload

  switch (type) {
    case 'file': {
      try {
        const result = await RPCTypes.saltpackSaltpackDecryptFileRpcPromise({
          encryptedFilename: input.stringValue(),
        })
        const {decryptedFilename, info, signed} = result
        const {sender} = info
        const {username} = sender

        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Decrypt,
          output: new HiddenString(decryptedFilename),
          outputSender: signed ? new HiddenString(username) : undefined,
          outputSigned: signed,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform decrypt operation'),
          errorType: '',
          operation: Constants.Operations.Decrypt,
        })
      }
    }
    case 'text': {
      try {
        const result = await RPCTypes.saltpackSaltpackDecryptStringRpcPromise({
          ciphertext: input.stringValue(),
        })
        const {plaintext, info, signed} = result
        const {sender} = info
        const {username} = sender
        const outputSigned = signed

        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Decrypt,
          output: new HiddenString(plaintext),
          outputSender: outputSigned ? new HiddenString(username) : undefined,
          outputSigned,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform decrypt operation'),
          errorType: '',
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
  const {input, type} = action.payload
  switch (type) {
    case 'file': {
      try {
        const signedFilename = await RPCTypes.saltpackSaltpackSignFileRpcPromise({
          filename: input.stringValue(),
        })
        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Sign,
          output: new HiddenString(signedFilename),
          outputSender: new HiddenString(username),
          outputSigned: true,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform decrypt operation'),
          errorType: '',
          operation: Constants.Operations.Decrypt,
        })
      }
    }
    case 'text': {
      try {
        const ciphertext = await RPCTypes.saltpackSaltpackSignStringRpcPromise({
          plaintext: input.stringValue(),
        })
        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Sign,
          output: new HiddenString(ciphertext),
          outputSender: new HiddenString(username),
          outputSigned: true,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform decrypt operation'),
          errorType: '',
          operation: Constants.Operations.Decrypt,
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
  const {input, type} = action.payload
  switch (type) {
    case 'file': {
      try {
        const result = await RPCTypes.saltpackSaltpackVerifyFileRpcPromise({
          signedFilename: input.stringValue(),
        })
        const {verifiedFilename, sender, verified} = result
        const {username} = sender
        const outputSigned = verified

        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Verify,
          output: new HiddenString(verifiedFilename),
          outputSender: outputSigned ? new HiddenString(username) : undefined,
          outputSigned,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform verify operation'),
          errorType: '',
          operation: Constants.Operations.Decrypt,
        })
      }
    }
    case 'text': {
      try {
        const result = await RPCTypes.saltpackSaltpackVerifyStringRpcPromise({signedMsg: input.stringValue()})
        const {plaintext, sender, verified} = result
        const {username} = sender
        const outputSigned = verified

        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Verify,
          output: new HiddenString(plaintext),
          outputSender: outputSigned ? new HiddenString(username) : undefined,
          outputSigned,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: new HiddenString('Failed to perform verify operation'),
          errorType: '',
          operation: Constants.Operations.Decrypt,
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

function* cryptoSaga() {
  yield* Saga.chainAction2(
    [CryptoGen.setInput, CryptoGen.setRecipients, CryptoGen.setEncryptOptions],
    handleRunOperation
  )
  yield* Saga.chainAction2(CryptoGen.saltpackEncrypt, saltpackEncrypt)
  yield* Saga.chainAction(CryptoGen.saltpackDecrypt, saltpackDecrypt)
  yield* Saga.chainAction2(CryptoGen.saltpackSign, saltpackSign)
  yield* Saga.chainAction(CryptoGen.saltpackVerify, saltpackVerify)
  yield* teamBuildingSaga()
}

export default cryptoSaga
