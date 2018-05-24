// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import Intro from './intro'
import Splash from './splash'
import {isMobile} from '../../styles'

const introProps = {
  bannerMessage: null,
  onFeedback: isMobile ? action('onFeedback') : null,
  onLogin: action('onLogin'),
  onSignup: action('onSignup'),
}

const splashProps = {
  failed: false,
  onFeedback: null,
  onRetry: null,
  status: 'Loading',
}

const load = () => {
  storiesOf('Login', module)
    .add('Intro', () => <Intro {...introProps} />)
    .add('Intro: banner', () => <Intro {...introProps} bannerMessage="You just deleted your account!" />)

  storiesOf('Login', module)
    .add('Splash', () => <Splash {...splashProps} />)
    .add('Failure', () => (
      <Splash {...splashProps} failed={true} status="Something went wrong" onRetry={action('onRetry')} />
    ))
    .add('Failure feedback', () => (
      <Splash
        {...splashProps}
        failed={true}
        status="Something went wrong"
        onRetry={action('onRetry')}
        onFeedback={action('onFeedback')}
      />
    ))
  // storiesOf('Login', module).add('Failure', () => <Failure {...props} bootStatus="bootStatusFailure" />)
}

export default load
