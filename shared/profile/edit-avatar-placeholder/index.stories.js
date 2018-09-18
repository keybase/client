// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EditAvatar from '.'

const props = {
  hasAvatar: true,
  keybaseUsername: 'thedude',
  onAck: Sb.action('onAck'),
}

const load = () => {
  Sb.storiesOf('Profile/EditAvatar', module)
    .add('Has', () => <EditAvatar {...props} />)
    .add('Missing', () => <EditAvatar {...props} hasAvatar={false} />)
}

export default load
