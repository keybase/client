// @flow
import React from 'react'
import {storiesOf, action} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Participants from './participants'

const participants: Array<{
  username: string,
  following: boolean,
  fullname: string,
  broken: boolean,
  isYou: boolean,
}> = [
  {
    broken: false,
    following: false,
    fullname: 'Fred Akalin',
    isYou: true,
    username: 'akalin',
  },
  {
    broken: false,
    following: true,
    fullname: 'Jeremy Stribling',
    isYou: false,
    username: 'strib',
  },
  {
    broken: true,
    following: true,
    fullname: 'Max Krohn',
    isYou: false,
    username: 'max',
  },
]

const load = () => {
  storiesOf('Chat/Conversation/InfoPanel', module)
    .add('Participants', () => (
      <Box style={{maxWidth: 320}}>
        <Participants onShowProfile={action('onShowProfile')} participants={participants} />
      </Box>
    ))
    .add('Participants (with add button)', () => (
      <Box style={{maxWidth: 320}}>
        <Participants onShowProfile={action('onShowProfile')} participants={participants} />
      </Box>
    ))
}

export default load
