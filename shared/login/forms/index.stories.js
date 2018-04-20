// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {Intro, Splash, Failure} from '.'

const props: Props = {
  bootStatus: 'bootStatusLoading',
  justDeletedSelf: null,
  justLoginFromRevokedDevice: null,
  justRevokedSelf: null,
  onFeedback: action('onFeedback'),
  onLogin: action('onLogin'),
  onRetry: action('onRetry'),
  onSignup: action('onSignup'),
  retrying: false,
}

const load = () => {
  storiesOf('Login/Forms', module)
    .add('Intro: First time user', () => <Intro {...props} bootStatus="bootStatusBootstrapped" />)
    .add('Intro: User who just revoked device', () => (
      <Intro {...props} bootStatus="bootStatusBootstrapped" justRevokedSelf="DEVICE_NAME" />
    ))
    .add('Intro: User who just deleted self', () => (
      <Intro {...props} bootStatus="bootStatusBootstrapped" justDeletedSelf="hal9000" />
    ))
    .add('Intro: User who tried to login from revoked device', () => (
      <Intro {...props} bootStatus="bootStatusBootstrapped" justLoginFromRevokedDevice="DEVICE_NAME" />
    ))
    .add('Splash', () => <Splash {...props} />)
    .add('Failure', () => <Failure {...props} bootStatus="bootStatusFailure" />)
}

export default load
