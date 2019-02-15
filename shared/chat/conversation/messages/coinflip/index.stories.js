// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters/index'
import * as Sb from '../../../../stories/storybook'

import CoinFlip from '.'

const gathering = {
  displayText: 'Gathering commitments...',
  isResult: false,
  showParticipants: false,
}

const partialGather = {
  displayText: 'Gathered 2 commitments...',
  isResult: false,
  showParticipants: true,
}

const result = {
  displayText: 'HEADS',
  isResult: true,
  showParticipants: true,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Coinflip', module)
    .addDecorator(story => <Box style={{maxWidth: 400, padding: 5}}>{story()}</Box>)
    .add('Gathering', () => <CoinFlip {...gathering} />)
    .add('Partial Gather', () => <CoinFlip {...partialGather} />)
    .add('Result', () => <CoinFlip {...result} />)
}

export default load
