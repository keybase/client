import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import ReplyPreview from './index'

const base = {
  onCancel: Sb.action('onCancel'),
  text: 'This is a small message to reply to.',
  username: 'mikem',
}

const long = {
  ...base,
  text:
    'This is a long message to reply to it just keeps going and keeps going and keeps going and  keeps going and  keeps going and  keeps going and  keeps going and  keeps going and ',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/ReplyPreview', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 800, padding: 5}}>{story()}</Kb.Box>)
    .add('Base', () => <ReplyPreview {...base} />)
    .add('Long', () => <ReplyPreview {...long} />)
}

export default load
