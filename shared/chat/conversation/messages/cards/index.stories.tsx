import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Kb from '../../../../common-adapters'
import NewChat from './new-chat'
import HelloBot from './hello-bot'

const load = () => {
  Sb.storiesOf('Chat/Conversation/Cards', module)
    .addDecorator(story => (
      <Kb.Box2 direction="vertical" style={{backgroundColor: 'lightGrey', padding: 20, width: 500}}>
        {story()}
      </Kb.Box2>
    ))
    .add('New Chat', () => <NewChat />)
    .add('Hello Bot', () => <HelloBot />)
}

export default load
