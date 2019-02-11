// @flow
import * as React from 'react'
import Landing from '.'
import {action, storiesOf} from '../../stories/storybook'

const defaultAccountProps = {
  email: 'max@keyba.se',
  hasRandomPW: false,
  isVerified: false,
  onChangeEmail: action('onchangeemail'),
  onChangePassphrase: action('onchangepassphrase'),
  onChangeRememberPassphrase: action('onchangerememberpassphrase'),
  rememberPassphrase: true,
}

const defaultPlanProps = {
  // $FlowIssue
  plan: {},
  plans: [],
}

const load = () => {
  storiesOf('Settings/Landing', module)
    .add('Normal', () => (
      <Landing
        account={{
          ...defaultAccountProps,
          email: 'michal@keyba.se',
          hasRandomPW: false,
          isVerified: true,
          rememberPassphrase: true,
        }}
        {...defaultPlanProps}
      />
    ))
    .add('Unknown HasRandomPW', () => (
      <Landing
        account={{
          ...defaultAccountProps,
          hasRandomPW: null,
        }}
        {...defaultPlanProps}
      />
    ))
    .add('Random PW', () => (
      <Landing
        account={{
          ...defaultAccountProps,
          email: 'michal+rpw@keyba.se',
          hasRandomPW: true,
          isVerified: true,
        }}
        {...defaultPlanProps}
      />
    ))
    .add('No e-mail', () => (
      <Landing
        account={{
          ...defaultAccountProps,
          email: '',
          hasRandomPW: false,
        }}
        {...defaultPlanProps}
      />
    ))
    .add('Both no-email and random pw', () => (
      <Landing
        account={{
          ...defaultAccountProps,
          email: '',
          hasRandomPW: true,
        }}
        {...defaultPlanProps}
      />
    ))
}

export default load
