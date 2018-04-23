// @flow
import * as React from 'react'
import UnlockFolders from '.'
import {action, storiesOf} from '../stories/storybook'

const devices = [
  {
    type: 'mobile',
    name: 'my phone',
    deviceID: 'deadbeef',
  },

  {
    type: 'desktop',
    name: 'my computer',
    deviceID: 'deadbeee',
  },

  {
    type: 'desktop',
    name: 'my laptop',
    deviceID: 'deadbeea',
  },

  {
    type: 'backup',
    name: 'my paperkey',
    deviceID: 'deadbee0',
  },
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
  onContinueFromPaperKey: (paperkey: string) => {
    console.log('onContinueFromPaperKey')
  },
  paperkeyError: null,
  waiting: false,
  onFinish: () => {
    console.log('onFinish')
  },
}

const load = () => {
  storiesOf('UnlockFolders', module).add('', () => <UnlockFolders {...props} />)
}

export default load
