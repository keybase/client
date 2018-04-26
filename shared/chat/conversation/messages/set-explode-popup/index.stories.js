// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../../stories/storybook'
import SetExplodingPopup from '.'

const common = {
  attachTo: null,
  onHidden: () => {}, // pretty spammy otherwise
  onSelect: action('onSelect'),
  selected: null,
  visible: true, // TODO (for storyshots, see DESKTOP-6620)
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
