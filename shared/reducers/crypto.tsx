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

    draftState[operation].bytesComplete = 0
    draftState[operation].bytesTotal = 0
    draftState[operation].inputType = 'text'
    draftState[operation].input = new HiddenString('')
    draftState[operation].output = new HiddenString('')
    draftState[operation].outputStatus = undefined
    draftState[operation].outputType = undefined
  },
  [CryptoGen.clearRecipients]: (draftState, action) => {
    const {operation} = action.payload

    if (operationGuard(operation, action)) return

    if (operation === Constants.Operations.Encrypt) {
      draftState.encrypt.bytesComplete = 0
      draftState.encrypt.bytesTotal = 0
      draftState.encrypt.recipients = initialState.encrypt.recipients
      draftState.encrypt.meta.hasRecipients = false
      draftState.encrypt.meta.noIncludeSelf = false
      // Reset options since they depend on the recipients
      draftState.encrypt.options = initialState.encrypt.options
      draftState.encrypt.output = new HiddenString('')
      draftState.encrypt.outputStatus = undefined
      draftState.encrypt.outputType = undefined
    }
  },
  [CryptoGen.setRecipients]: (draftState, action) => {
    const {operation, recipients} = action.payload

    if (operationGuard(operation, action)) return

    if (operation !== Constants.Operations.Encrypt) return
    if (!draftState.encrypt.recipients.length && recipients.length) {
      draftState.encrypt.meta.hasRecipients = true
    }
    if (recipients) draftState.encrypt.recipients = recipients
  },
  [CryptoGen.setEncryptOptions]: (draftState, action) => {
    const {options: newOptions, noIncludeSelf} = action.payload
    const oldOptions = draftState.encrypt.options
    draftState.encrypt.options = {
      ...oldOptions,
      ...newOptions,
    }
    // User set themselves as a recipient so don't show the 'includeSelf' option for encrypt (since they're encrypting to themselves)
    if (noIncludeSelf) {
      draftState.encrypt.meta.noIncludeSelf = noIncludeSelf
      draftState.encrypt.options.includeSelf = false
    }
  },
  [CryptoGen.setInput]: (draftState, action) => {
    const {operation, type, value} = action.payload
    if (operationGuard(operation, action)) return

    // Reset input to 'text' when no value given (cleared input or removed file upload)
    draftState[operation].inputType = value.stringValue() ? type : 'text'
    draftState[operation].input = value
  },
  [CryptoGen.onOperationSuccess]: (draftState, action) => {
    const {operation, output, outputSigned, outputSender, outputType} = action.payload
    if (operationGuard(operation, action)) return

    draftState[operation].output = output
    draftState[operation].outputStatus = 'success'
    draftState[operation].outputType = outputType
    draftState[operation].outputSigned = outputSigned
    draftState[operation].outputSender = outputSender
  },
  [CryptoGen.saltpackProgress]: (draftState, action) => {
    const {bytesComplete, bytesTotal, operation} = action.payload
    if (operationGuard(operation, action)) return

    draftState[operation].bytesComplete = bytesComplete
    draftState[operation].bytesTotal = bytesTotal
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
