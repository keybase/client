// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import EditAvatar from '.'

const props = {
  hasAvatar: true,
  keybaseUsername: 'thedude',
  onAck: action('onAck'),
}

const load = () => {
  storiesOf('Profile/EditAvatar', module)
    .add('Has', () => <EditAvatar {...props} />)
    .add('Missing', () => <EditAvatar {...props} hasAvatar={false} />)
}

export default load
