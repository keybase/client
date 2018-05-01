// @flow
import * as React from 'react'
import {messageExplodeDescriptions} from '../../../../constants/chat2'
import {action, storiesOf} from '../../../../stories/storybook'
import SetExplodingPopup from '.'

const items = messageExplodeDescriptions.sort((a, b) => (a.seconds < b.seconds ? 1 : 0))

const common = {
  attachTo: null,
  onHidden: action('onHidden'),
  onSelect: action('onSelect'),
  selected: null,
  items,
  visible: true,
}

const load = () => {
  storiesOf('Chat/Conversation/Set explode time', module)
    .add('New', () => <SetExplodingPopup {...common} isNew={true} />)
    .add('Old', () => <SetExplodingPopup {...common} isNew={false} />)
    .add('Selected', () => (
      <SetExplodingPopup {...common} isNew={false} selected={{text: '12 hours', seconds: 3600 * 12}} />
    ))
}

export default load
