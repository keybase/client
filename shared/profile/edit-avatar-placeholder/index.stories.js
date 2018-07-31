// @flow
import * as React from 'react'
import {action, storiesOf, PropProviders} from '../../stories/storybook'
import EditAvatar from '.'

const props = {
  hasAvatar: true,
  keybaseUsername: 'thedude',
  onAck: action('onAck'),
}

const load = () => {
  storiesOf('Profile/EditAvatar', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Has', () => <EditAvatar {...props} />)
    .add('Missing', () => <EditAvatar {...props} hasAvatar={false} />)
}

export default load
