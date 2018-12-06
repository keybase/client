// @flow
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
    .add('New', () => <SetExplodingPopup {...common} isNew={true} />)
    .add('Old', () => <SetExplodingPopup {...common} isNew={false} />)
    .add('Selected', () => <SetExplodingPopup {...common} isNew={false} selected={3600 * 6} />)
}

export default load
