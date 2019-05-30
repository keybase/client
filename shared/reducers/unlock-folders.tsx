import * as I from 'immutable'
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import * as Constants from '../constants/unlock-folders'
import * as Types from '../constants/types/unlock-folders'
import * as DeviceTypes from '../constants/types/devices'
import {actionHasError} from '../util/container'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: UnlockFoldersGen.Actions): Types.State {
  switch (action.type) {
    case UnlockFoldersGen.resetStore:
      return initialState
    case UnlockFoldersGen.closeDone:
      return state.merge({popupOpen: false})
    case UnlockFoldersGen.waiting:
      return state.merge({waiting: action.payload.waiting})
    case UnlockFoldersGen.onBackFromPaperKey:
      return state.merge({
        paperkeyError: '',
        phase: 'promptOtherDevice',
      })
    case UnlockFoldersGen.toPaperKeyInput:
      return state.merge({phase: 'paperKeyInput'})
    case UnlockFoldersGen.checkPaperKeyDone:
      if (actionHasError(action)) {
        return state.merge({paperkeyError: action.payload.error})
      }
      return state.merge({phase: 'success'})
    case UnlockFoldersGen.finish:
      return state.merge({phase: 'dead', popupOpen: false})
    case UnlockFoldersGen.newRekeyPopup: {
      const devices: I.List<Types.Device> = I.List(
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
      return state
  }
}
