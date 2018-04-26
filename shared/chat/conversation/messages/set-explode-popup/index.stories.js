// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../../stories/storybook'
import SetExplodingPopup from '.'

const common = {
  attachTo: null,
  onHidden: () => {}, // pretty spammy otherwise
  onSelect: action('onSelect'),
  selected: null,
  visible: true,
}

const load = () => {
  storiesOf('Chat/Conversation/Set explode time')
    .add('New', () => <SetExplodingPopup {...common} isNew={true} />)
    .add('Old', () => <SetExplodingPopup {...common} isNew={false} />)
}

export default load
