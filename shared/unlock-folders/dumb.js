// @flow

import UnlockFolders from './render.desktop'
import HiddenString from '../util/hidden-string'
import type {DumbComponentMap} from '../constants/types/more'

const devices = [
  {type: 'mobile', name: 'my phone', deviceID: 'deadbeef'},
  {type: 'desktop', name: 'my computer', deviceID: 'deadbeee'},
  {type: 'desktop', name: 'my laptop', deviceID: 'deadbeea'},
  {type: 'backup', name: 'my paperkey', deviceID: 'deadbee0'},
]

// phase: 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success',
const common = {
  parentProps: {style: {marginTop: 20, flex: 1, width: 500, height: 300}},
  paperKeysHidden: false,
  phase: 'promptOtherDevice',
  devices: devices,
  onClose: () => {
    console.log('onClose')
  },
  toPaperKeyInput: () => {
    console.log('toPaperKeyInput')
  },
  onBackFromPaperKey: () => {
    console.log('onBackFromPaperKey')
  },
  onContinueFromPaperKey: (paperkey: HiddenString) => {
    console.log('onContinueFromPaperKey')
  },
  paperkeyError: null,
  waiting: false,
  onFinish: () => {
    console.log('onFinish')
  },
}

const unlockFolderMap: DumbComponentMap<UnlockFolders> = {
  component: UnlockFolders,
  mocks: {
    Normal: {
      ...common,
    },
    'No paperkeys': {
      ...common,
      paperKeysHidden: true,
    },
    Single: {
      ...common,
      devices: [devices[0]],
    },
    'Paperkey input': {
      ...common,
      phase: 'paperKeyInput',
    },
    'Paperkey error': {
      ...common,
      phase: 'paperKeyInput',
      paperkeyError: 'Invalid paperkey',
    },
    'Paperkey error waiting': {
      ...common,
      phase: 'paperKeyInput',
      paperkeyError: 'Invalid paperkey',
      waiting: true,
    },
    Success: {
      ...common,
      phase: 'success',
      waiting: false,
    },
  },
}

export default {
  'unlock folders': unlockFolderMap,
}
