// @flow
import * as I from 'immutable'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import * as Constants from '../constants/unlock-folders'
import * as Types from '../constants/types/unlock-folders'
import * as DeviceTypes from '../constants/types/devices'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: UnlockFoldersGen.Actions): Types.State {
  switch (action.type) {
    case UnlockFoldersGen.resetStore:
      return initialState
    case UnlockFoldersGen.closeDone:
      return state.set('popupOpen', false)
    case UnlockFoldersGen.waiting: {
      const {waiting} = action.payload
      return state.set('waiting', waiting)
    }
    case UnlockFoldersGen.onBackFromPaperKey:
      return state.set('paperkeyError', '').set('phase', 'promptOtherDevice')
    case UnlockFoldersGen.toPaperKeyInput:
      return state.set('phase', 'paperKeyInput')
    case UnlockFoldersGen.checkPaperKeyDone:
      if (action.error) {
        return state.set('paperkeyError', action.payload.error)
      }
      return state.set('phase', 'success')
    case UnlockFoldersGen.finish:
      return state.set('popupOpen', false).set('phase', 'dead')
    case UnlockFoldersGen.newRekeyPopup: {
      const devices = I.List(
        action.payload.devices.map(({name, type, deviceID}) =>
          Constants.makeDevice({
            deviceID,
            name,
            type: DeviceTypes.stringToDeviceType(type),
          })
        )
      )
      return state.merge({
        devices: devices,
        popupOpen: !!devices.count(),
        sessionID: action.payload.sessionID,
      })
    }
    // Saga only actions
    case UnlockFoldersGen.checkPaperKey:
    case UnlockFoldersGen.closePopup:
    case UnlockFoldersGen.openPopup:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
