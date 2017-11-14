// @flow
import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import * as Constants from '../constants/unlock-folders'
import {toDeviceType} from '../constants/devices'

export default function(
  state: Constants.State = Constants.initialState,
  action: UnlockFoldersGen.Actions
): Constants.State {
  switch (action.type) {
    case UnlockFoldersGen.resetStore:
      return {
        ...initialState,
        started: state.started,
      }

    case UnlockFoldersGen.close:
      return {
        ...state,
        closed: true,
      }
    case UnlockFoldersGen.waiting:{
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
    case UnlockFoldersGen.checkPaperKey:
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

    case UnlockFoldersGen.registerRekeyListener:
      if (action.payload && action.payload.started) {
        return {
          ...state,
          started: true,
        }
      } else {
        return state
      }
    case UnlockFoldersGen.newRekeyPopup:
      if (state.started && action.payload) {
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
      return state

    default:
      return state
  }
}
