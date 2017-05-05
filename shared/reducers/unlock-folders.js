// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/unlock-folders'
import {toDeviceType} from '../constants/types/more'

const initialState: Constants.State = {
  closed: true,
  devices: null,
  paperkeyError: null,
  phase: 'dead',
  sessionID: null,
  started: false,
  waiting: false,
}

export default function (state: Constants.State = initialState, action: Constants.Actions): Constants.State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {
        ...initialState,
        started: state.started,
      }

    case Constants.close:
      return {
        ...state,
        closed: true,
      }
    case Constants.waiting:
      if (action.error) {
        return state
      }

      return {
        ...state,
        waiting: action.payload,
      }

    case Constants.onBackFromPaperKey:
      return {
        ...state,
        paperkeyError: '',
        phase: 'promptOtherDevice',
      }

    case Constants.toPaperKeyInput:
      return {
        ...state,
        phase: 'paperKeyInput',
      }
    case Constants.checkPaperKey:
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
    case Constants.finish:
      return {
        ...state,
        closed: true,
        phase: 'dead',
      }

    case Constants.registerRekeyListener:
      if (action.payload && action.payload.started) {
        return {
          ...state,
          started: true,
        }
      } else {
        return state
      }
    case Constants.newRekeyPopup:
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
