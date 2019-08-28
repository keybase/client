import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import PinnedMessage from './index'

const unpinnable = {
  author: 'mikem',
  dismissUnpins: true,
  onClick: Sb.action('onClick'),
  onDismiss: Sb.action('onDismiss'),
  text: 'THIS IS SOME IMPORTANT RULES PAY ATTENTION',
  unpinning: false,
}

const ignorable = {
  ...unpinnable,
  dismissUnpins: false,
}

const unpinning = {
  ...unpinnable,
  unpinning: true,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/PinnedMessage', module)
    .addDecorator(story => (
      <Kb.Box style={{maxWidth: 600, padding: 5, position: 'relative'}}>{story()}</Kb.Box>
    ))
    .add('Unpinnable', () => <PinnedMessage {...unpinnable} />)
    .add('Ignorable', () => <PinnedMessage {...ignorable} />)
    .add('Unpinning', () => <PinnedMessage {...unpinning} />)
}

export default load
