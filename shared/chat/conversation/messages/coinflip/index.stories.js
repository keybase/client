// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters/index'
import * as Sb from '../../../../stories/storybook'

import CoinFlip from '.'

const gathering = {
  isError: false,
  progressText: 'Gathering commitments...',
  resultText: '',
  showParticipants: false,
}

const partialGather = {
  isError: false,
  progressText: 'Gathered 2 commitments...',
  resultText: '',
  showParticipants: true,
}

const result = {
  isError: false,
  progressText: '2 participants have revealed secrets...',
  resultText: 'HEADS',
  showParticipants: true,
}

const error = {
  isError: true,
  progressText: 'Something went wrong: Somebody pulled the plug',
  resultText: '',
  showParticipants: false,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Coinflip', module)
    .addDecorator(story => <Box style={{maxWidth: 400, padding: 5}}>{story()}</Box>)
    .add('Gathering', () => <CoinFlip {...gathering} />)
    .add('Partial Gather', () => <CoinFlip {...partialGather} />)
    .add('Result', () => <CoinFlip {...result} />)
    .add('Error', () => <CoinFlip {...error} />)
}

export default load
