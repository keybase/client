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
          return CryptoGen.createSaltpackEncrypt({input: value, options, recipients, type})
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
    case Constants.Operations.Encrypt:
      return CryptoGen.createSaltpackEncrypt({input, recipients, type: inputType, options})
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
const saltpackEncrypt = async (action: CryptoGen.SaltpackEncryptPayload, logger: Saga.SagaLogger) => {
  const {input, recipients, type, options} = action.payload
  try {
    switch (type) {
      case 'file': {
        return
      }
      case 'text': {
        const ciphertext = await RPCTypes.saltpackSaltpackEncryptStringRpcPromise({
          opts: {
            includeSelf: options.includeSelf,
            recipients: recipients,
            signed: options.sign,
          },
          plaintext: input,
        })
        console.log('JRY saltpack encrypt success', {ciphertext})
        return CryptoGen.createOnOperationSuccess({
          operation: Constants.Operations.Encrypt,
          output: ciphertext,
          outputType: type,
        })
      }
      default: {
        logger.error(
          `Attempted to call saltpackEncrypt with invalid type ${type}. Valid saltpack encrypt types are { text, file }`
        )
      }
    }
  } catch (err) {
    console.log('JRY saltpack encrypt ERROR', err)
    logger.error(err)
  }

  // return CryptoGen.createOnOperationSuccess({
  //   operation: Constants.Operations.Encrypt,
  //   output: action.payload.input,
  //   outputType: action.payload.type,
  // })
}

const saltpackDecrypt = async (action: CryptoGen.SaltpackDecryptPayload) => {
  return CryptoGen.createOnOperationSuccess({
    operation: Constants.Operations.Decrypt,
    output: action.payload.input,
    outputType: action.payload.type,
  })
}

const saltpackSign = async (action: CryptoGen.SaltpackSignPayload) => {
  return CryptoGen.createOnOperationSuccess({
    operation: Constants.Operations.Sign,
    output: action.payload.input,
    outputType: action.payload.type,
  })
}

const saltpackVerify = async (action: CryptoGen.SaltpackVerifyPayload) => {
  return CryptoGen.createOnOperationSuccess({
    operation: Constants.Operations.Verify,
    output: action.payload.input,
    outputType: action.payload.type,
  })
}

function* cryptoSaga() {
  yield* Saga.chainAction2([CryptoGen.setInput, CryptoGen.setRecipients], handleInput)
  yield* Saga.chainAction(CryptoGen.saltpackEncrypt, saltpackEncrypt)
  yield* Saga.chainAction(CryptoGen.saltpackDecrypt, saltpackDecrypt)
  yield* Saga.chainAction(CryptoGen.saltpackSign, saltpackSign)
  yield* Saga.chainAction(CryptoGen.saltpackVerify, saltpackVerify)
  yield* teamBuildingSaga()
}

export default cryptoSaga
