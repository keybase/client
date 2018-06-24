// @flow
import * as React from 'react'
import RequestInvite from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  email: '',
  emailErrorText: undefined,
  name: '',
  nameErrorText: undefined,
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
}

const load = () => {
  storiesOf('Signup/Request Invite', module)
    .add('Start', () => <RequestInvite {...props} />)
    .add('Name Error', () => <RequestInvite {...props} nameErrorText={'Name bad, smash!'} />)
    .add('Email Error', () => (
      <RequestInvite {...props} emailErrorText={'Email bad, booo'} />
    ))
}

export default load
