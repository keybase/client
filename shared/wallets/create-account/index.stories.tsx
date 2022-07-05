import React from 'react'
import * as Sb from '../../stories/storybook'
import CreateAccount from '.'

const props = {
  createNewAccountError: '',
  error: '',
  nameValidationState: 'none' as 'none',
  onCancel: Sb.action('onCancel'),
  onClearErrors: Sb.action('onCancel'),
  onCreateAccount: Sb.action('onCreateAccount'),
  onDone: Sb.action('onDone'),
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Wallets', module).add('Create account', () => <CreateAccount {...props} />)
}

export default load
