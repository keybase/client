// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
// import {Intro, Failure} from '.'
import Splash from './splash'

// const props = {
// bootStatus: 'bootStatusLoading',
// justDeletedSelf: null,
// justLoginFromRevokedDevice: null,
// justRevokedSelf: null,
// onFeedback: action('onFeedback'),
// onLogin: action('onLogin'),
// onRetry: action('onRetry'),
// onSignup: action('onSignup'),
// retrying: false,
// }

const load = () => {
  // storiesOf('Login/Intro', module)
  // .add('First time user', () => <Intro {...props} bootStatus="bootStatusBootstrapped" />)
  // .add('User who just revoked device', () => (
  // <Intro {...props} bootStatus="bootStatusBootstrapped" justRevokedSelf="DEVICE_NAME" />
  // ))
  // .add('User who just deleted self', () => (
  // <Intro {...props} bootStatus="bootStatusBootstrapped" justDeletedSelf="hal9000" />
  // ))
  // .add('User who tried to login from revoked device', () => (
  // <Intro {...props} bootStatus="bootStatusBootstrapped" justLoginFromRevokedDevice="DEVICE_NAME" />
  // ))
  storiesOf('Login', module)
    .add('Splash', () => <Splash status="Loading" onRetry={null} onFeedback={null} />)
    .add('Failure', () => (
      <Splash status="Something went wrong" onRetry={action('onRetry')} onFeedback={null} />
    ))
    .add('Failure feedback', () => (
      <Splash status="Something went wrong" onRetry={action('onRetry')} onFeedback={action('onFeedback')} />
    ))
  // storiesOf('Login', module).add('Failure', () => <Failure {...props} bootStatus="bootStatusFailure" />)
}

export default load
