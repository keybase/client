// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EditAvatar from '.'

const props = {
  onClose: Sb.action('onClose'),
  onSave: Sb.action('onSave'),
}

const load = () => {
  Sb.storiesOf('Profile/EditAvatar', module)
    .add('Has', () => <EditAvatar {...props} />)
    .add('Missing', () => <EditAvatar {...props} />)
}

export default load
