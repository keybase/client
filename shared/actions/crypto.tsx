import * as Saga from '../util/saga'
import * as TeamBuildingGen from './team-building-gen'
import * as CryptoGen from './crypto-gen'
import * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
import {TypedState} from '../util/container'
import commonTeamBuildingSaga, {filterForNs} from './team-building'

// Get list of users from crypto TeamBuilding for encrypt operation
const onSetRecipients = (state: TypedState, _: TeamBuildingGen.FinishedTeamBuildingPayload) => {
  const users = [...state.crypto.teamBuilding.finishedTeam]
  const usernames = users.map(user => user.username)
  return [
    TeamBuildingGen.createCancelTeamBuilding({namespace: 'crypto'}),
    CryptoGen.createSetRecipients({operation: 'encrypt', recipients: usernames}),
  ]
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

      if (operation === Constants.Operations.Encrypt) {
        return state.crypto.encrypt.meta.hasRecipients && state.crypto.encrypt.recipients?.length
          ? makeOperationAction(operation, value, type, state.crypto.encrypt.recipients)
          : null
      }

      return makeOperationAction(operation, value, type)
    }
    case CryptoGen.setRecipients: {
      const {recipients} = action.payload
      const {input, inputType} = state.crypto[operation]
      // User already provided input (text or file) before setting the
      // recipients. Get the input and pass it to the operation
      if (input && inputType) {
        return makeOperationAction(operation, input, inputType, recipients)
      }
      return
    }
    default:
      return
  }
}

// Dispatch action to appropriate operation
const makeOperationAction = (
  operation: Types.Operations,
  input: string,
  inputType: Types.InputTypes,
  recipients: Array<string> = []
) => {
  switch (operation) {
    case Constants.Operations.Encrypt:
      return CryptoGen.createSaltpackEncrypt({input, recipients, type: inputType})
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
const saltpackEncrypt = async (action: CryptoGen.SaltpackEncryptPayload) => {
  return CryptoGen.createOnOperationSuccess({
    operation: Constants.Operations.Encrypt,
    output: action.payload.input,
    outputType: action.payload.type,
  })
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
