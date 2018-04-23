// @flow
import * as React from 'react'
import UnlockFolders from '.'
import {action, storiesOf} from '../stories/storybook'
import {Box} from '../common-adapters'

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
const props = {
  devices: devices,
  onBackFromPaperKey: action('onBackFromPaperKey'),
  onClose: action('onClose'),
  onContinueFromPaperKey: action('onContinueFromPaperKey'),
  onFinish: action('onFinish'),
  paperKeysHidden: false,
  paperkeyError: null,
  parentProps: {style: {}},
  phase: 'promptOtherDevice',
  toPaperKeyInput: action('toPaperKeyInput'),
  waiting: false,
}

const Wrapper = props => (
  <Box style={{flex: 1, height: 300, marginTop: 20, width: 500}}>
    <UnlockFolders {...props} />
  </Box>
)

const load = () => {
  storiesOf('UnlockFolders', module).add('', () => <Wrapper {...props} />)
}

export default load
