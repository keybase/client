/* @flow */

import * as Constants from '../constants/unlock-folders'
import HiddenString from '../util/hidden-string'

import {toDeviceType} from '../constants/types/more'
import type {UnlockFolderActions, Device} from '../constants/unlock-folders'

export type State = {
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success',
  devices: ?Array<Device>,
  paperkeyError: ?HiddenString
}

const initialState: State = {
  phase: 'dead',
  devices: null,
  paperkeyError: null
}

export default function (state: State = initialState, action: UnlockFolderActions): State {
  // TODO: Fill out the rest of this reducer
  switch (action.type) {
    case Constants.loadDevices:
      if (action.error) {
        return state
      } else {
        const devices = action.payload.devices.map(({name, type, deviceID}) => ({
          type: toDeviceType(type),
          name, deviceID
        }))
        return {
          ...state,
          devices
        }
      }

    case Constants.toPaperKeyInput:
      return {
        ...state,
        phase: 'paperKeyInput'
      }
    case Constants.checkPaperKey:
      if (action.error) {
        return {
          ...state,
          paperkeyError: action.payload.error
        }
      } else {
        return {
          ...state,
          phase: 'success'
        }
      }
    case Constants.finish:
      return {
        ...state,
        phase: 'dead'
      }
    default:
      return state
  }
}

// Mock states -- Use these when creating components.

export const mocks: {[key: string]: State} = {
  promptOtherSingleDevice: {
    phase: 'promptOtherDevice',
    devices: [{type: 'desktop', name: 'Cray', deviceID: 'bada55'}],
    paperkeyError: null
  },
  promptOtherMultiDevice: {
    phase: 'promptOtherDevice',
    devices: [
      {type: 'desktop', name: 'Cray', deviceID: 'c0ffee'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef'},
      {type: 'mobile', name: 'Newton', deviceID: 'dead'}
    ],
    paperkeyError: null
  },
  paperKeyInput: {
    phase: 'paperKeyInput',
    devices: [],
    paperkeyError: null
  },
  paperKeyInputWithError: {
    phase: 'paperKeyInput',
    devices: [],
    paperkeyError: new HiddenString('Invalid paper key')
  },
  success: {
    phase: 'success',
    devices: [],
    paperkeyError: null
  }
}
