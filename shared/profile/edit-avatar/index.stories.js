// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EditAvatar from '.'

const props = {
  leftAction: 'cancel',
  leftActionText: 'Close',
  onLeftAction: Sb.action('onLeftAction'),
  onSave: Sb.action('onSave'),
}

const load = () => {
  Sb.storiesOf('Profile/EditAvatar', module)
    .add('Has', () => <EditAvatar {...props} />)
    .add('Missing', () => <EditAvatar {...props} />)
}

export default load
