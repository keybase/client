// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import EnterNamePopup from '.'

const common = {
  keyError: '',
  linkExistingAccountError: '',
  name: '',
  nameError: '',
  nameValidationState: 'none',
  onClose: Sb.action('onCancel'),
  onCheckKey: Sb.action('onCheckKey'),
  onCheckName: Sb.action('onCheckName'),
  onClearErrors: Sb.action('onClearErrors'),
  onDone: Sb.action('onDone'),
  onKeyChange: Sb.action('onKeyChange'),
  onNameChange: Sb.action('onNameChange'),
  onViewChange: Sb.action('onViewChange'),
  secretKey: '',
  secretKeyValidationState: 'none',
  waiting: false,
}

const enterNameProps = {
  ...common,
  view: 'name',
}

const nameErrorProps = {
  ...common,
  name: 'this is too long',
  error: 'Error: name too long',
  nameValidationState: 'error',
}

const load = () => {
  Sb.storiesOf('Wallets/Common/Enter Name Popup', module)
    .add('Enter name', () => <EnterNamePopup {...enterNameProps} />)
    .add('Prefilled name', () => <EnterNamePopup {...enterNameProps} name="mikem's third account" />)
    .add('Name error', () => <EnterNamePopup {...nameErrorProps} />)
}

export default load
