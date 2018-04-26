// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../../stories/storybook'
import SetExplodingPopup from '.'

const common = {
  onHidden: () => {}, // pretty spammy otherwise
  onSelect: action('onSelect'),
  selected: null,
}

const load = () => {
  storiesOf('Chat/Conversation/Set explode time').add('New', () => (
    <SetExplodingPopup {...common} visible={true} attachTo={null} isNew={true} />
  ))
}

export default load
