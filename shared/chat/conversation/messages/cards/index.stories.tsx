import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Kb from '../../../../common-adapters'
import NewChat from './new-chat'

const load = () => {
  Sb.storiesOf('Chat/Conversation/Cards', module)
    .addDecorator(story => (
      <Kb.Box2 direction="vertical" style={{backgroundColor: 'lightGrey', width: 500, padding: 20}}>
        {story()}
      </Kb.Box2>
    ))
    .add('New Chat', () => <NewChat />)
}

export default load
