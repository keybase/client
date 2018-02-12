// @flow
import React from 'react'
import {storiesOf, action} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import {Participant} from './participant'

const participant = {
  broken: false,
  following: false,
  fullname: 'Fred Akalin',
  isYou: true,
  username: 'akalin',
}

const load = () => {
  storiesOf('Chat/Conversation/InfoPanel', module).add('Participant', () => (
    <Box style={{maxWidth: 320}}>
      <Participant onShowProfile={action('onShowProfile')} participant={participant} />
    </Box>
  ))
}

export default load
