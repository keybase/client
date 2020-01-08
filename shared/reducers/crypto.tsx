import logger from '../logger'
import * as Types from '../constants/types/crypto'
import * as Constants from '../constants/crypto'
import * as Container from '../util/container'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as CryptoGen from '../actions/crypto-gen'
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

    draftState[operation].inputType = 'text'
    draftState[operation].input = ''
    draftState[operation].output = ''
    draftState[operation].outputStatus = undefined
    draftState[operation].outputType = undefined
  },
  [CryptoGen.clearRecipients]: (draftState, action) => {
    const {operation} = action.payload

    if (operationGuard(operation, action)) return

    if (operation === Constants.Operations.Encrypt) {
      draftState.encrypt.recipients = initialState.encrypt.recipients
      draftState.encrypt.meta.hasRecipients = false
      // Reset options since they depend on the recipients
      draftState.encrypt.options = initialState.encrypt.options
      draftState.encrypt.output = ''
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
    draftState.encrypt.recipients = recipients
  },
  [CryptoGen.setEncryptOptions]: (draftState, action) => {
    const {options} = action.payload
    draftState.encrypt.options = options
  },
  [CryptoGen.setInput]: (draftState, action) => {
    const {operation, type, value} = action.payload
    if (operationGuard(operation, action)) return

    // Reset input to 'text' when no value given (cleared input or removed file upload)
    draftState[operation].inputType = value ? type : 'text'
    draftState[operation].input = value
  },
  [CryptoGen.onOperationSuccess]: (draftState, action) => {
    const {operation, output, outputType} = action.payload
    if (operationGuard(operation, action)) return

    draftState[operation].output = output
    draftState[operation].outputStatus = 'success'
    draftState[operation].outputType = outputType
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
