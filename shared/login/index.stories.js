// @flow
import relogin from './relogin/index.stories'
import * as React from 'react'
import * as Sb from '../stories/storybook'
import JoinOrLogin from './join-or-login'
import Loading from './loading'

const joinOrLoginProps = {
  bannerMessage: null,
  onFeedback: null,
  onLogin: Sb.action('onLogin'),
  onSignup: Sb.action('onSignup'),
}

const loadingProps = {
  failed: '',
  onFeedback: null,
  onRetry: null,
  status: 'Loading...',
}

const load = () => {
  relogin()

  Sb.storiesOf('Login/JoinOrLogin', module)
    .add('Normal', () => <JoinOrLogin {...joinOrLoginProps} />)
    .add('Banner', () => <JoinOrLogin {...joinOrLoginProps} bannerMessage="You just deleted your account!" />)
    .add('Feedback', () => <JoinOrLogin {...joinOrLoginProps} onFeedback={Sb.action('onFeedback')} />)

  Sb.storiesOf('Login/Loading', module)
    .add('Loading', () => <Loading {...loadingProps} />)
    .add('Failure', () => (
      <Loading
        {...loadingProps}
        failed="Can't load kbfs"
        status="Something went wrong"
        onRetry={Sb.action('onRetry')}
      />
    ))
    .add('Failure feedback', () => (
      <Loading
        {...loadingProps}
        failed="Can't talk to daemon"
        status="Something went wrong"
        onRetry={Sb.action('onRetry')}
        onFeedback={Sb.action('onFeedback')}
      />
    ))
  // storiesOf('Login', module).add('Failure', () => <Failure {...props} bootStatus="bootStatusFailure" />)
}

export default load
