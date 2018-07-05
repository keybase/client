// @flow
import * as React from 'react'
import RequestInviteSuccess from '.'
import {action, storiesOf} from '../../../stories/storybook'
import * as PropProviders from '../../../stories/prop-providers'

const load = () => {
  storiesOf('Signup', module)
    .addDecorator(PropProviders.CommonProvider())
    .add('Request Invite Success', () => <RequestInviteSuccess onBack={action('onBack')} />)
}

export default load
