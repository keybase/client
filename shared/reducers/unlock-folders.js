// @flow
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import * as Constants from '../constants/unlock-folders'
import * as Types from '../constants/types/unlock-folders'
import {toDeviceType} from '../constants/devices'

export default function(
  state: Types.State = Constants.initialState,
  action: UnlockFoldersGen.Actions
): Types.State {
  switch (action.type) {
    case UnlockFoldersGen.resetStore:
      return {
        ...Constants.initialState,
      }
    case UnlockFoldersGen.closeDone:
      return {
        ...state,
        closed: true,
      }
    case UnlockFoldersGen.waiting: {
      const {waiting} = action.payload
      return {
        ...state,
        waiting,
      }
    }
    case UnlockFoldersGen.onBackFromPaperKey:
      return {
        ...state,
        paperkeyError: '',
        phase: 'promptOtherDevice',
      }
    case UnlockFoldersGen.toPaperKeyInput:
      return {
        ...state,
        phase: 'paperKeyInput',
      }
    case UnlockFoldersGen.checkPaperKeyDone:
      if (action.error) {
        return {
          ...state,
          paperkeyError: action.payload.error,
        }
      } else {
        return {
          ...state,
          phase: 'success',
        }
      }
    case UnlockFoldersGen.finish:
      return {
        ...state,
        closed: true,
        phase: 'dead',
      }
    case UnlockFoldersGen.newRekeyPopup: {
      const devices = action.payload.devices.map(({name, type, deviceID}) => ({
        deviceID,
        name,
        type: toDeviceType(type),
      }))

      return {
        ...state,
        closed: !devices.length,
        devices,
        sessionID: action.payload.sessionID,
      }
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}
