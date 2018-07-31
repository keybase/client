// @flow
import * as React from 'react'
import InviteCode from '.'
import {action, storiesOf, PropProviders} from '../../../stories/storybook'

const props = {
  error: undefined,
  onBack: action('onBack'),
  onRequestInvite: action('onRequestInvite'),
  onSubmit: action('onInviteCodeSubmit'),
}

const load = () => {
  storiesOf('Signup/Invite Code', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Start', () => <InviteCode {...props} />)
    .add('Code', () => <InviteCode {...props} />)
    .add('Error', () => <InviteCode {...props} error="This is an error" />)
}

export default load
