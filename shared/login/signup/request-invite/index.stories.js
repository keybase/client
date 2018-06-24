// @flow
import * as React from 'react'
import RequestInvite from '.'
import {action, storiesOf} from '../../../stories/storybook'
import * as PropProviders from '../../../stories/prop-providers'

const props = {
  emailError: undefined,
  nameError: undefined,
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
}

const load = () => {
  storiesOf('Signup/Request Invite', module)
    .addDecorator(PropProviders.Common())
    .add('Start', () => <RequestInvite {...props} />)
    .add('Name Error', () => <RequestInvite {...props} nameError="Name bad, smash!" />)
    .add('Email Error', () => <RequestInvite {...props} emailError="Email bad, booo" />)
}

export default load
