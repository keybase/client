// @flow
import * as React from 'react'
import {action, storiesOf, PropProviders} from '../../stories/storybook'
import EditAvatar from '.'

const props = {
  onClose: action('onClose'),
  onSave: action('onSave'),
}

const load = () => {
  storiesOf('Profile/EditAvatar', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Has', () => <EditAvatar {...props} />)
    .add('Missing', () => <EditAvatar {...props} />)
}

export default load
