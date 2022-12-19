import logger from '../logger'
import type * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
import * as Container from '../util/container'
import type * as TeamBuildingGen from '../actions/team-building-gen'
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

const resetOutput = (op: Types.CommonState) => {
  op.output = new HiddenString('')
  op.outputStatus = undefined
  op.outputType = undefined
  op.outputSenderUsername = undefined
  op.outputSenderFullname = undefined
  op.outputValid = false
  op.errorMessage = new HiddenString('')
  op.warningMessage = new HiddenString('')
}

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [CryptoGen.resetStore]: () => {
    return initialState
  },
  [CryptoGen.resetOperation]: (draftState, action) => {
    const {operation} = action.payload

    if (operationGuard(operation, action)) return

    switch (operation) {
      case Constants.Operations.Encrypt: {
        draftState.encrypt = initialState.encrypt
        break
      }
      case Constants.Operations.Decrypt: {
        draftState.decrypt = initialState.decrypt
        break
      }
      case Constants.Operations.Sign: {
        draftState.sign = initialState.sign
        break
      }
      case Constants.Operations.Verify: {
        draftState.verify = initialState.verify
        break
      }
    }
  },
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
    op.outputSenderUsername = undefined
    op.outputSenderFullname = undefined
    op.errorMessage = new HiddenString('')
    op.warningMessage = new HiddenString('')
    op.outputValid = true
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
      encrypt.outputSenderUsername = undefined
      encrypt.outputSenderFullname = undefined
      encrypt.outputValid = false
      encrypt.errorMessage = new HiddenString('')
      encrypt.warningMessage = new HiddenString('')
    }
  },
  [CryptoGen.setRecipients]: (draftState, action) => {
    const {operation, recipients, hasSBS} = action.payload

    if (operationGuard(operation, action)) return

    if (operation !== Constants.Operations.Encrypt) return

    const op = draftState.encrypt
    const {inputType} = op

    // Reset output when file input changes
    // Prompt for destination dir
    if (inputType === 'file') {
      resetOutput(op)
    }

    // Output no longer valid since recipients have changed
    op.outputValid = false

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
    const {inputType} = encrypt
    const oldOptions = encrypt.options
    encrypt.options = {
      ...oldOptions,
      ...newOptions,
    }

    // Reset output when file input changes
    // Prompt for destination dir
    if (inputType === 'file') {
      resetOutput(encrypt)
    }

    // Output no longer valid since options have changed
    encrypt.outputValid = false

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
    const inputType = value.stringValue() ? type : 'text'
    const outputValid = oldInput.stringValue() === value.stringValue()

    op.inputType = inputType
    op.input = value
    op.outputValid = outputValid
    op.errorMessage = new HiddenString('')
    op.warningMessage = new HiddenString('')

    // Reset output when file input changes
    // Prompt for destination dir
    if (inputType === 'file') {
      resetOutput(op)
    }
  },
  [CryptoGen.runFileOperation]: (draftState, action) => {
    const {operation} = action.payload
    if (operationGuard(operation, action)) return

    const op = draftState[operation]
    op.outputValid = false
    op.errorMessage = new HiddenString('')
    op.warningMessage = new HiddenString('')
  },
  [CryptoGen.saltpackDone]: (draftState, action) => {
    const {operation} = action.payload
    const op = draftState[operation]
    // For any file operation that completes, invalidate the output since multiple decrypt/verify operations will produce filenames with unqiue
    // counters on the end (as to not overwrite any existing files in the user's FS).
    // E.g. `${plaintextFilename} (n).ext`
    op.outputValid = false
    op.bytesComplete = 0
    op.bytesTotal = 0
    op.inProgress = false
    op.outputStatus = 'pending'
  },
  [CryptoGen.onSaltpackOpenFile]: (draftState, action) => {
    const {operation, path} = action.payload
    const op = draftState[operation]
    const {inProgress} = op

    // Bail on setting operation input if another file RPC is in progress
    if (inProgress) return
    if (!path.stringValue()) return

    resetOutput(op)
    op.input = path
    op.inputType = 'file'
    op.errorMessage = new HiddenString('')
    op.warningMessage = new HiddenString('')
  },
  [CryptoGen.onOperationSuccess]: (draftState, action) => {
    const {
      input,
      operation,
      output,
      outputSigned,
      outputSenderFullname,
      outputSenderUsername,
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

    let outputValid = false

    const op = draftState[operation]

    if (inputAction) {
      outputValid = inputAction.payload.input.stringValue() === op.input.stringValue()

      // If the store's input matches its output, then we don't need to update with the value of the returning RPC.
      if (op.outputValid) {
        return
      }

      // Otherwise show the output but don't let them interact with it because the output is stale (newer RPC coming back)
      op.outputValid = outputValid
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
    op.outputSenderUsername = outputSenderUsername
    op.outputSenderFullname = outputSenderFullname
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
  [CryptoGen.saltpackStart]: (draftState, action) => {
    const {operation} = action.payload
    if (operationGuard(operation, action)) return

    // Gets the progress bar on screen sooner. This matters most when encrypting/signing a directory (since progress is slow)
    const op = draftState[operation]
    op.inProgress = true
  },
  [CryptoGen.saltpackProgress]: (draftState, action) => {
    const {bytesComplete, bytesTotal, operation} = action.payload
    if (operationGuard(operation, action)) return

    const op = draftState[operation]
    // The final progress notification might come after saltpackDone.
    // Reset progress when finsihed
    if (bytesComplete === bytesTotal) {
      op.bytesComplete = 0
      op.bytesTotal = 0
      op.inProgress = false
      op.outputStatus = 'pending'
      return
    }
    op.bytesComplete = bytesComplete
    op.bytesTotal = bytesTotal
    op.inProgress = true
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
