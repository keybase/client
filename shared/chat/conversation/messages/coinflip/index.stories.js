// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters/index'
import * as Sb from '../../../../stories/storybook'

import CoinFlip from '.'
import CoinFlipParticipants from './participants'

const parts = [
  {
    commitment: '',
    deviceID: '',
    deviceName: 'lisa-5k',
    uid: '',
    username: 'mikem',
  },
  {
    commitment: '',
    deviceID: '',
    deviceName: 'work computer',
    uid: '',
    username: 'max',
  },
  {
    commitment: '',
    deviceID: '',
    deviceName: 'My Mac Home Device',
    uid: '',
    username: 'karenm',
  },
  {
    commitment: '',
    deviceID: '',
    deviceName: 'dsdsdkjsdjskdjskdjskkskjsd',
    uid: '',
    username: 'chris',
  },
]

const gathering = {
  isError: false,
  participants: [],
  progressText: 'Gathering commitments...',
  resultText: '',
  showParticipants: false,
}

const partialGather = {
  isError: false,
  participants: parts.slice(0, 2),
  progressText: 'Gathered 2 commitments...',
  resultText: '',
  showParticipants: true,
}

const result = {
  isError: false,
  participants: parts,
  progressText: '2 participants have revealed secrets...',
  resultText: 'HEADS',
  showParticipants: true,
}

const error = {
  isError: true,
  participants: [],
  progressText: 'Something went wrong: Somebody pulled the plug',
  resultText: '',
  showParticipants: false,
}

const participantProps = {
  attachTo: Sb.action('mocked'),
  onHidden: Sb.action('onHidden'),
  participants: parts,
  visible: true,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Coinflip', module)
    .addDecorator(story => <Box style={{maxWidth: 400, padding: 5}}>{story()}</Box>)
    .add('Gathering', () => <CoinFlip {...gathering} />)
    .add('Partial Gather', () => <CoinFlip {...partialGather} />)
    .add('Result', () => <CoinFlip {...result} />)
    .add('Error', () => <CoinFlip {...error} />)
    .add('Participants', () => <CoinFlipParticipants {...participantProps} />)
}

export default load
