// @flow
import React from 'react'
import {storiesOf, action} from '../../../../stories/storybook'
import StartConversation from '.'

const load = () => {
  storiesOf('Chat/Conversation', module).add('StartConversation', () => (
    <StartConversation participants="chris,max" onStart={action('onStart')} />
  ))
}

export default load
