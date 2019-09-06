import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ForgotUsername from '.'

const props = {
  forgotUsernameResult: '',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Provision/ForgotUsername', module)
    .add('Success', () => <ForgotUsername {...props} forgotUsernameResult="success" />)
    .add('Error', () => (
      <ForgotUsername
        {...props}
        forgotUsernameResult="We couldn't find an account with that email address. Try again?"
      />
    ))
}

export default load
