// @flow
import React from 'react'
import {storiesOf, action} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import {Participant} from './participants'

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
  storiesOf('Chat/Conversation/InfoPanel', module).add('Participant', () => (
    <Box style={{maxWidth: 320}}>
      <Participant onShowProfile={action('onShowProfile')} participant={participants[0]} />
    </Box>
  ))
}

export default load
