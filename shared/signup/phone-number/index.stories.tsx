import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {storyDecorator} from '../common-stories'
import EnterPhoneNumber from '.'
import VerifyPhoneNumber from './verify'

const props = {
  error: '',
  onContinue: Sb.action('onFinish'),
  onSkip: Sb.action('onSkip'),
  waiting: false,
}

const verifyProps = {
  error: '',
  onBack: Sb.action('onBack'),
  onContinue: Sb.action('onContinue'),
  onResend: Sb.action('onResend'),
  phoneNumber: '+33 6 76 38 86 97',
  resendWaiting: false,
  verifyWaiting: false,
}

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(storyDecorator)
    .add('Enter phone number', () => <EnterPhoneNumber {...props} />)
    .add('Verify phone number', () => <VerifyPhoneNumber {...verifyProps} />)
    .add('Verify phone number - error', () => (
      <VerifyPhoneNumber {...verifyProps} error="Incorrect code. Please try again." resendWaiting={true} />
    ))
}

export default load
