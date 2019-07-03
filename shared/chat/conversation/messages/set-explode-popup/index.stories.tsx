import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import {messageExplodeDescriptions} from '../../../../constants/chat2'
import SetExplodingPopup from '.'

const common = {
  attachTo: () => null,
  items: messageExplodeDescriptions,
  onHidden: Sb.action('onHidden'),
  onSelect: Sb.action('onSelect'),
  selected: 0,
  visible: true,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Set explode time', module)
    .add('Unselected', () => <SetExplodingPopup {...common} />)
    .add('Selected', () => <SetExplodingPopup {...common} selected={3600 * 6} />)
}

export default load
