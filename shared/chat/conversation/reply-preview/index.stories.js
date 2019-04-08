// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import ReplyPreview from './index'

const base = {
  onCancel: Sb.action('onCancel'),
  text: 'This is a small message to reply to.',
  username: 'mikem',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/ReplyPreview', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 800, padding: 5}}>{story()}</Kb.Box>)
    .add('Base', () => <ReplyPreview {...base} />)
}

export default load
