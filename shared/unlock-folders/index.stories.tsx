import * as React from 'react'
import UnlockFolders from './index.desktop'
import {action, storiesOf} from '../stories/storybook'
import {Box} from '../common-adapters'

const devices = [
  {deviceID: 'deadbeef', name: 'my phone', type: 'mobile'},
  {deviceID: 'deadbeee', name: 'my computer', type: 'desktop'},
  {deviceID: 'deadbeea', name: 'my laptop', type: 'desktop'},
  {deviceID: 'deadbee0', name: 'my paperkey', type: 'backup'},
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
  storiesOf('UnlockFolders', module)
    .add('Normal', () => <Wrapper {...props} />)
    // TODO this doesn't seem to work
    .add('No paperkeys', () => <Wrapper {...props} paperKeysHidden={true} />)
    .add('Single', () => <Wrapper {...props} devices={[devices[0]]} />)
    .add('Paperkey input', () => <Wrapper {...props} phase={'paperKeyInput'} />)
    .add('Paperkey error', () => (
      <Wrapper {...props} phase={'paperKeyInput'} paperkeyError={'Invalid paperkey'} />
    ))
    .add('Paperkey error waiting', () => (
      <Wrapper {...props} phase={'paperKeyInput'} paperkeyError={'Invalid paperkey'} waiting={true} />
    ))
    .add('Success', () => <Wrapper {...props} phase={'success'} waiting={false} />)
}

export default load
