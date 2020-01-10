import * as Saga from '../util/saga'
import * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
import * as TeamBuildingGen from './team-building-gen'
import * as CryptoGen from './crypto-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import {TypedState} from '../util/container'
import commonTeamBuildingSaga, {filterForNs} from './team-building'

// Get list of users from crypto TeamBuilding for encrypt operation
const onSetRecipients = (state: TypedState, _: TeamBuildingGen.FinishedTeamBuildingPayload) => {
  const {username: currentUser} = state.config
  const {options} = state.crypto.encrypt

  const users = [...state.crypto.teamBuilding.finishedTeam]
  let usernames = users.map(user => user.username)

  const actions: Array<TypedActions> = [TeamBuildingGen.createCancelTeamBuilding({namespace: 'crypto'})]

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

const handleInput = (
  state: TypedState,
  action: CryptoGen.SetInputPayload | CryptoGen.SetRecipientsPayload
) => {
  const {operation} = action.payload
  switch (action.type) {
    // Handle input for any operation
    case CryptoGen.setInput: {
      const {value, type} = action.payload

      // Input (text or file) was cleared or deleted
      if (!value) {
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
    case CryptoGen.setRecipients: {
      const {recipients} = action.payload
      const {input, inputType, options} = state.crypto.encrypt
      // User already provided input (text or file) before setting the
      // recipients. Get the input and pass it to the operation
      if (input && inputType) {
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
    default:
      return
  }
}

// Dispatch action to appropriate operation
const makeOperationAction = (p: {
  operation: Types.Operations
  input: string
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

/*
 * For the time being these functions will echo back the input as the Saltpack RPC output (plaintext -> plaintext)
 * Saltpack RPCs need to be updated to take input as a string and handle `inputType = 'text' | 'file'`
 */
const saltpackEncrypt = async (
  state: TypedState,
  action: CryptoGen.SaltpackEncryptPayload,
  logger: Saga.SagaLogger
) => {
  const {username} = state.config
  const {input, recipients, type, options} = action.payload
  switch (type) {
    case 'file': {
      return
    }
    case 'text': {
      try {
        const ciphertext = await RPCTypes.saltpackSaltpackEncryptStringRpcPromise({
          opts: {
            includeSelf: options.includeSelf,
            recipients: recipients,
            signed: options.sign,
          },
          plaintext: input,
        })
        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Encrypt,
          output: ciphertext,
          outputSender: options.sign ? username : undefined,
          outputSigned: options.sign,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: 'Failed to perform encryption operation',
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
      return
    }
    case 'text': {
      try {
        const result = await RPCTypes.saltpackSaltpackDecryptStringRpcPromise({
          ciphertext: input,
        })
        const {plaintext, info} = result
        const {sender} = info
        const {username, senderType} = sender

        // TODO @jacob: This is a plaeholder until the protocol is updated to included signed flag
        const isSigned = !(
          senderType === RPCTypes.SaltpackSenderType.unknown ||
          senderType === RPCTypes.SaltpackSenderType.anonymous
        )

        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Decrypt,
          output: plaintext,
          outputSender: isSigned ? username : undefined,
          outputSigned: isSigned,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: 'Failed to perform decrypt operation',
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
      return
    }
    case 'text': {
      try {
        const ciphertext = await RPCTypes.saltpackSaltpackSignStringRpcPromise({plaintext: input})
        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Sign,
          output: ciphertext,
          outputSender: username,
          outputSigned: true,
          outputType: type,
        })
      } catch (err) {
        logger.error(err)
        return CryptoGen.createOnOperationError({
          errorMessage: 'Failed to perform decrypt operation',
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

const saltpackVerify = async (action: CryptoGen.SaltpackVerifyPayload) => {
  const {input, type} = action.payload
  switch (type) {
    // TODO @jacob : Finish this
    case 'file': {
      return
    }
    case 'text': {
      return
    }
    default: {
      logger.error(
        `Attempted to call saltpackSign with invalid type=${type}. Valid saltpack sign types are { text, file }`
      )
      return
    }
  }
  return CryptoGen.createOnOperationSuccess({
    operation: Constants.Operations.Verify,
    output: action.payload.input,
    outputSigned: false,
    outputType: action.payload.type,
  })
}

function* cryptoSaga() {
  yield* Saga.chainAction2([CryptoGen.setInput, CryptoGen.setRecipients], handleInput)
  yield* Saga.chainAction2(CryptoGen.saltpackEncrypt, saltpackEncrypt)
  yield* Saga.chainAction(CryptoGen.saltpackDecrypt, saltpackDecrypt)
  yield* Saga.chainAction2(CryptoGen.saltpackSign, saltpackSign)
  yield* Saga.chainAction(CryptoGen.saltpackVerify, saltpackVerify)
  yield* teamBuildingSaga()
}

export default cryptoSaga
