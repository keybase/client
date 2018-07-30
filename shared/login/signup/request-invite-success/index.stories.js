// @flow
import * as React from 'react'
import RequestInviteSuccess from '.'
import {action, storiesOf, PropProviders} from '../../../stories/storybook'

const load = () => {
  storiesOf('Signup', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Request Invite Success', () => <RequestInviteSuccess onBack={action('onBack')} />)
}

export default load
