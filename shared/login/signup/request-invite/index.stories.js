// @flow
import * as React from 'react'
import RequestInvite from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  email: '',
  emailError: undefined,
  name: '',
  nameError: undefined,
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
}

const load = () => {
  storiesOf('Signup/Request Invite', module)
    .add('Start', () => <RequestInvite {...props} />)
    .add('Name Error', () => <RequestInvite {...props} nameError="Name bad, smash!" />)
    .add('Email Error', () => <RequestInvite {...props} emailError="Email bad, booo" />)
}

export default load
