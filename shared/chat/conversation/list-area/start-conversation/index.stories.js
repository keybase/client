// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import StartConversation from '.'

const load = () => {
  storiesOf('Chat/Conversation/StartConversation', module)
    .add('Add more', () => (
      <StartConversation
        participants="chris,max"
        onStart={action('onStart')}
        showAddParticipants={true}
        isLoading={false}
        isError={false}
      />
    ))
    .add('No add more', () => (
      <StartConversation
        participants="chris,max"
        onStart={action('onStart')}
        showAddParticipants={false}
        isLoading={false}
        isError={false}
      />
    ))
    .add('Loading', () => (
      <StartConversation
        participants="chris,max"
        onStart={action('onStart')}
        showAddParticipants={true}
        isLoading={true}
        isError={false}
      />
    ))
}

export default load
