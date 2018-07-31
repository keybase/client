// @flow
import * as React from 'react'
import RequestInvite from '.'
import {action, storiesOf, PropProviders} from '../../../stories/storybook'

const props = {
  emailError: undefined,
  nameError: undefined,
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
}

const load = () => {
  storiesOf('Signup/Request Invite', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Start', () => <RequestInvite {...props} />)
    .add('Name Error', () => <RequestInvite {...props} nameError="Name bad, smash!" />)
    .add('Email Error', () => <RequestInvite {...props} emailError="Email bad, booo" />)
}

export default load
