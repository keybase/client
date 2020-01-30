import logger from '../logger'
import * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
import * as Container from '../util/container'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as CryptoGen from '../actions/crypto-gen'
import HiddenString from '../util/hidden-string'
import {editTeambuildingDraft} from './team-building'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'

const initialState: Types.State = Constants.makeState()

type Actions = CryptoGen.Actions | TeamBuildingGen.Actions

const operationGuard = (operation: Types.Operations, action: CryptoGen.Actions) => {
  if (operation) return false

  logger.error(
    `Crypto reducer: Action (${action.type}) did not contain operation ( "encrypt", "decrypt", "verify", "sign" )`
  )
  return true
}

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [CryptoGen.clearInput]: (draftState, action) => {
    const {operation} = action.payload

    if (operationGuard(operation, action)) return

    const op = draftState[operation]
    op.bytesComplete = 0
    op.bytesTotal = 0
    op.inputType = 'text'
    op.input = new HiddenString('')
    op.output = new HiddenString('')
    op.outputStatus = undefined
    op.outputType = undefined
    op.errorMessage = new HiddenString('')
    op.warningMessage = new HiddenString('')
    op.outputMatchesInput = true
  },
  [CryptoGen.clearRecipients]: (draftState, action) => {
    const {operation} = action.payload

    if (operationGuard(operation, action)) return

    if (operation === Constants.Operations.Encrypt) {
      const encrypt = draftState.encrypt
      encrypt.bytesComplete = 0
      encrypt.bytesTotal = 0
      encrypt.recipients = initialState.encrypt.recipients
      // Reset options since they depend on the recipients
      encrypt.options = initialState.encrypt.options
      encrypt.meta = initialState.encrypt.meta
      encrypt.output = new HiddenString('')
      encrypt.outputStatus = undefined
      encrypt.outputType = undefined
      encrypt.outputMatchesInput = false
      encrypt.errorMessage = new HiddenString('')
      encrypt.warningMessage = new HiddenString('')
    }
  },
  [CryptoGen.setRecipients]: (draftState, action) => {
    const {operation, recipients, hasSBS} = action.payload

    if (operationGuard(operation, action)) return

    if (operation !== Constants.Operations.Encrypt) return

    const op = draftState.encrypt

    // Output no longer valid since recipients have changed
    op.outputMatchesInput = false

    if (!op.recipients.length && recipients.length) {
      op.meta.hasRecipients = true
      op.meta.hasSBS = hasSBS
    }
    // Force signing when user is SBS
    if (hasSBS) {
      op.options.sign = true
    }

    if (recipients) {
      op.recipients = recipients
    }
  },
  [CryptoGen.setEncryptOptions]: (draftState, action) => {
    const {options: newOptions, hideIncludeSelf} = action.payload
    const {encrypt} = draftState
    const oldOptions = encrypt.options
    encrypt.options = {
      ...oldOptions,
      ...newOptions,
    }

    // Output no longer valid since options have changed
    encrypt.outputMatchesInput = false

    // User set themselves as a recipient so don't show the 'includeSelf' option for encrypt (since they're encrypting to themselves)
    if (hideIncludeSelf) {
      encrypt.meta.hideIncludeSelf = hideIncludeSelf
      encrypt.options.includeSelf = false
    }
  },
  [CryptoGen.setInput]: (draftState, action) => {
    const {operation, type, value} = action.payload
    if (operationGuard(operation, action)) return

    const op = draftState[operation]
    const oldInput = op.input
    // Reset input to 'text' when no value given (cleared input or removed file upload)
    op.inputType = value.stringValue() ? type : 'text'
    op.input = value
    op.outputMatchesInput = oldInput.stringValue() === value.stringValue()
  },
  [CryptoGen.onOperationSuccess]: (draftState, action) => {
    const {
      input,
      operation,
      output,
      outputSigned,
      outputSender,
      outputType,
      warning,
      warningMessage,
    } = action.payload
    if (operationGuard(operation, action)) return

    let inputAction:
      | CryptoGen.SaltpackDecryptPayload
      | CryptoGen.SaltpackEncryptPayload
      | CryptoGen.SaltpackSignPayload
      | CryptoGen.SaltpackVerifyPayload
      | undefined

    switch (input?.type) {
      // fallthrough
      case CryptoGen.saltpackDecrypt:
      case CryptoGen.saltpackEncrypt:
      case CryptoGen.saltpackSign:
      case CryptoGen.saltpackVerify:
        inputAction = input
        break
      default:
        inputAction = undefined
    }

    let outputMatchesInput = false

    const op = draftState[operation]

    if (inputAction) {
      outputMatchesInput = inputAction.payload.input.stringValue() === op.input.stringValue()

      // If the store's input matches its output, then we don't need to update with the value of the returning RPC.
      if (op.outputMatchesInput) {
        return
      }

      // Otherwise show the output but don't let them interact with it because the output is stale (newer RPC coming back)
      op.outputMatchesInput = outputMatchesInput
    }

    // Reset errors and warnings
    op.errorMessage = new HiddenString('')
    op.warningMessage = new HiddenString('')

    // Warning was set alongside successful output
    if (warning && warningMessage) {
      op.warningMessage = warningMessage
    }

    op.output = output
    op.outputStatus = 'success'
    op.outputType = outputType
    op.outputSigned = outputSigned
    op.outputSender = outputSender
  },
  [CryptoGen.onOperationError]: (draftState, action) => {
    const {operation, errorMessage} = action.payload
    if (operationGuard(operation, action)) return

    const op = draftState[operation]
    // Clear output
    op.output = new HiddenString('')
    op.outputType = undefined

    // Set error
    op.outputStatus = 'error'
    op.errorMessage = errorMessage
  },
  [CryptoGen.saltpackProgress]: (draftState, action) => {
    const {bytesComplete, bytesTotal, operation} = action.payload
    if (operationGuard(operation, action)) return

    const op = draftState[operation]
    op.bytesComplete = bytesComplete
    op.bytesTotal = bytesTotal
  },

  // Encrypt: Handle team building when selecting keybase users
  ...teamBuilderReducerCreator<Types.State>(
    (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
      const val = editTeambuildingDraft('crypto', draftState.teamBuilding, action)
      if (val !== undefined) {
        draftState.teamBuilding = val
      }
    }
  ),
})
