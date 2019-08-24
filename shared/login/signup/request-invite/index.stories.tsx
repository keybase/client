import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import RequestInvite from '.'

const props = {
  emailError: '',
  nameError: '',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
}

const load = () => {
  Sb.storiesOf('Signup/Request Invite', module)
    .add('Start', () => <RequestInvite {...props} />)
    .add('Name Error', () => <RequestInvite {...props} nameError="Name bad, smash!" />)
    .add('Email Error', () => <RequestInvite {...props} emailError="Email bad, booo" />)
}

export default load
