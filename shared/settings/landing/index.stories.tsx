import * as React from 'react'
import Landing from '.'
import {action, storiesOf} from '../../stories/storybook'

const defaultAccountProps = {
  email: 'max@keyba.se',
  hasRandomPW: false,
  isVerified: false,
  onChangeEmail: action('onchangeemail'),
  onChangePassword: action('onchangepassword'),
  onChangeRememberPassword: action('onchangerememberpassword'),
  rememberPassword: true,
}

const defaultPlanProps = {
  plan: {},
  plans: [],
}

const load = () => {
  storiesOf('Settings/Landing', module)
    .add('Normal', () => (
      // @ts-ignore plan
      <Landing
        account={{
          ...defaultAccountProps,
          email: 'michal@keyba.se',
          hasRandomPW: false,
          isVerified: true,
          rememberPassword: true,
        }}
        {...defaultPlanProps}
      />
    ))
    .add('Unknown HasRandomPW', () => (
      // @ts-ignore plan
      <Landing
        account={{
          ...defaultAccountProps,
          hasRandomPW: null,
        }}
        {...defaultPlanProps}
      />
    ))
    .add('Random PW', () => (
      // @ts-ignore plan
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
      // @ts-ignore plan
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
      // @ts-ignore plan
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
