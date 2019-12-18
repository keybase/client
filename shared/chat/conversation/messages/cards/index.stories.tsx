import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Kb from '../../../../common-adapters'
import NewChat from './new-chat'
import HelloBot from './hello-bot'
import MakeTeam from './make-team'

const openPrivateFolder = Sb.action('openPrivateFolder')

const load = () => {
  Sb.storiesOf('Chat/Conversation/Cards', module)
    .addDecorator(story => (
      <Kb.Box2 direction="vertical" style={{backgroundColor: 'lightGrey', padding: 20, width: 500}}>
        {story()}
      </Kb.Box2>
    ))
    .add('New Chat', () => <NewChat self={false} openPrivateFolder={openPrivateFolder} />)
    .add('New Chat (Self)', () => <NewChat self={true} openPrivateFolder={openPrivateFolder} />)
    .add('Hello Bot', () => <HelloBot />)
    .add('Make Team', () => <MakeTeam conversationIDKey="" />)
}

export default load
