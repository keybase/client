/* @flow */

import * as Constants from '../constants/unlock-folders'
import HiddenString from '../util/hidden-string'

import type {UnlockFolderActions, Device} from '../constants/unlock-folders'

export type State = {
  phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success',
  devices: ?Array<Device>,
  paperkey: ?HiddenString,
  paperkeyError: ?HiddenString
}

const initialState: State = {
  phase: 'dead',
  devices: null,
  paperkey: null,
  paperkeyError: null
}

export default function (state: State = initialState, action: UnlockFolderActions): State {
  // TODO: Fill out the rest of this reducer
  switch (action.type) {
    case Constants.toPaperKeyInput:
      if (action.error) {
        return state
      } else {
        return {
          ...state,
          phase: 'paperKeyInput'
        }
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
    paperkey: null,
    paperkeyError: null
  },
  promptOtherMultiDevice: {
    phase: 'promptOtherDevice',
    devices: [
      {type: 'desktop', name: 'Cray', deviceID: 'c0ffee'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef'},
      {type: 'mobile', name: 'Newton', deviceID: 'dead'}
    ],
    paperkey: null,
    paperkeyError: null
  },
  promptOtherLotsaDevice: {
    phase: 'promptOtherDevice',
    devices: [
      {type: 'desktop', name: 'Cray', deviceID: 'c0ffee'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef1'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef2'},
      {type: 'mobile', name: 'Newton', deviceID: 'dead'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef3'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef4'},
      {type: 'mobile', name: 'Newton', deviceID: 'dead2'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef8'},
      {type: 'mobile', name: 'Newton', deviceID: 'dead4'},
      {type: 'desktop', name: 'Watson', deviceID: 'beef9'},
      {type: 'mobile', name: 'Newton', deviceID: 'deade'},
      {type: 'desktop', name: 'Watson', deviceID: 'beeff'},
      {type: 'mobile', name: 'Newton', deviceID: 'deada'},
      {type: 'desktop', name: 'Watson', deviceID: 'beefc'},
      {type: 'mobile', name: 'Newton', deviceID: 'dead1'}
    ],
    paperkey: null,
    paperkeyError: null
  },
  paperKeyInput: {
    phase: 'paperKeyInput',
    devices: [],
    paperkey: null,
    paperkeyError: null
  },
  paperKeyInputWithError: {
    phase: 'paperKeyInput',
    devices: [],
    paperkey: null,
    paperkeyError: new HiddenString('Invalid paper key')
  },
  success: {
    phase: 'success',
    devices: [],
    paperkey: null,
    paperkeyError: null
  }
}
