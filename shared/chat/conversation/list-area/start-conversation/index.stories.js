// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import StartConversation from '.'

const load = () => {
  storiesOf('Chat/Conversation', module)
    .add('StartConversationAndAddSome', () => (
      <StartConversation participants="chris,max" onStart={action('onStart')} showAddParticipants={true} />
    ))
    .add('StartConversation', () => (
      <StartConversation participants="chris,max" onStart={action('onStart')} showAddParticipants={false} />
    ))
}

export default load
