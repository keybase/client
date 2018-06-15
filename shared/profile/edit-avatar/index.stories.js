// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {action, storiesOf} from '../../stories/storybook'
import EditAvatar from '.'

const props = {
  // filename: '',
  image: {},
  onClose: action('onClose'),
  onSave: action('onSave'),
}

const provider = PropProviders.Common()

const load = () => {
  storiesOf('Profile/EditAvatar', module)
    .addDecorator(provider)
    .add('Has', () => <EditAvatar {...props} />)
    .add('Missing', () => <EditAvatar {...props} />)
}

export default load
