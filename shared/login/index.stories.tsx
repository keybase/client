import recoverPassword from './recover-password/index.stories'
import relogin from './relogin/index.stories'
import reset from './reset/index.stories'
import * as React from 'react'
import * as Sb from '../stories/storybook'
import {storyDecorator} from '../signup/common-stories'
import JoinOrLogin from './join-or-login'
import Loading from './loading'

const joinOrLoginProps = {
  bannerMessage: null,
  checkIsOnline: Sb.action('checkIsOnline'),
  clearInterval: Sb.action('clearInterval'),
  clearTimeout: Sb.action('clearTimeout'),
  isOnline: true,
  onFeedback: null,
  onLogin: Sb.action('onLogin'),
  onSignup: Sb.action('onSignup'),
  setInterval: Sb.action('setInterval'),
  setTimeout: Sb.action('setTimeout'),
  showProxySettings: Sb.action('showProxySettings'),
}

const loadingProps = {
  failed: '',
  onFeedback: null,
  onRetry: null,
  status: 'Loading...',
}

const load = () => {
  recoverPassword()
  relogin()

  Sb.storiesOf('Login/JoinOrLogin', module)
    .addDecorator(storyDecorator)
    .add('Normal', () => <JoinOrLogin {...joinOrLoginProps} />)
    .add('Banner', () => <JoinOrLogin {...joinOrLoginProps} bannerMessage="You just deleted your account!" />)
    .add('Proxy Settings', () => <JoinOrLogin {...joinOrLoginProps} isOnline={false} />)

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

  reset()

  // storiesOf('Login', module).add('Failure', () => <Failure {...props} bootStatus="bootStatusFailure" />)
}

export default load
