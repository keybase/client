// @flow
import * as React from 'react'
import UsernameEmailForm from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  email: null,
  emailChange: action('emailChange'),
  emailErrorText: null,
  onBack: action('onBack'),
  onSubmit: action('onSubmit'),
  submitUserEmail: action('submitUserEmail'),
  username: null,
  usernameChange: action('usernameChange'),
  usernameErrorText: null,
  waiting: false,
}

const load = () => {
  storiesOf('Signup/Username email', module)
    .add('Start', () => <UsernameEmailForm {...props} />)
    .add('Name', () => <UsernameEmailForm {...props} username={'Name'} />)
    .add('Email', () => <UsernameEmailForm {...props} email={'Email@email.com'} />)
    .add('Name/Email', () => <UsernameEmailForm {...props} username={'Name'} email={'Email@email.com'} />)
    .add('Name Error', () => (
      <UsernameEmailForm {...props} username={'Name'} usernameErrorText={'Name bad, smash!'} />
    ))
    .add('Email Error', () => (
      <UsernameEmailForm {...props} email={'Email@email.com'} emailErrorText={'Email bad, booo'} />
    ))
    .add('Waiting', () => (
      <UsernameEmailForm {...props} username={'Name'} email={'Email@email.com'} waiting={true} />
    ))
}

export default load
