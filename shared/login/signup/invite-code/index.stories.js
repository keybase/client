// @flow
import * as React from 'react'
import InviteCode from '.'
import {action, storiesOf} from '../../../stories/storybook'
import * as PropProviders from '../../../stories/prop-providers'

const props = {
  error: undefined,
  onBack: action('onBack'),
  onRequestInvite: action('onRequestInvite'),
  onSubmit: action('onInviteCodeSubmit'),
}

const load = () => {
  storiesOf('Signup/Invite Code', module)
    .addDecorator(PropProviders.CommonProvider())
    .add('Start', () => <InviteCode {...props} />)
    .add('Code', () => <InviteCode {...props} />)
    .add('Error', () => <InviteCode {...props} error="This is an error" />)
}

export default load
