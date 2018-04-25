// @flow
import * as React from 'react'
import RequestInvite from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  email: '',
  emailChange: action('emailChange'),
  emailErrorText: undefined,
  name: '',
  nameChange: action('nameChange'),
  nameErrorText: undefined,
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
  waiting: false,
}

const load = () => {
  storiesOf('Signup/Request Invite', module)
    .add('Start', () => <RequestInvite {...props} />)
    .add('Name', () => <RequestInvite {...props} name={'Name'} />)
    .add('Email', () => <RequestInvite {...props} email={'Email@email.com'} />)
    .add('Name/Email', () => <RequestInvite {...props} name={'Name'} email={'Email@email.com'} />)
    .add('Name Error', () => <RequestInvite {...props} name={'Name'} nameErrorText={'Name bad, smash!'} />)
    .add('Email Error', () => (
      <RequestInvite {...props} email={'Email@email.com'} emailErrorText={'Email bad, booo'} />
    ))
    .add('Waiting', () => <RequestInvite {...props} name={'Name'} email={'Email@email.com'} waiting={true} />)
}

export default load
