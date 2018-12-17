// @flow
import * as React from 'react'
import Email from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  edited: false,
  email: 'party@mypla.ce',
  isVerified: true,
  onChangeNewEmail: action('onChangeNewEmail'),
  onLeftAction: action('onLeftAction'),
  onSave: action('onSave'),
  waitingForResponse: false,
}

const load = () => {
  storiesOf('Settings/Email', module)
    .add('Normal', () => <Email {...props} />)
    .add('No email', () => <Email {...props} isVerified={false} email={null} />)
    .add('Not verified', () => <Email {...props} isVerified={false} />)
    .add('Resend Confirmation', () => (
      <Email {...props} onResendConfirmationCode={action('onResendConfirmationCode')} />
    ))
}

export default load
