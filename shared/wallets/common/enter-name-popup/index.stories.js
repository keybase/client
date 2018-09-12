// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import EnterNamePopup from '.'

const enterNameProps = {
  name: '',
  onCancel: Sb.action('onCancel'),
  onPrimaryClick: Sb.action('onDone'),
  onNameChange: Sb.action('onNameChange'),
  waiting: false,
}

const nameErrorProps = {
  ...enterNameProps,
  name: 'this is too long',
  error: 'Error: name too long',
}

const load = () => {
  Sb.storiesOf('Wallets/Common/Enter Name Popup', module)
    .add('Enter name', () => <EnterNamePopup {...enterNameProps} />)
    .add('Prefilled name', () => <EnterNamePopup {...enterNameProps} name="mikem's third account" />)
    .add('Name error', () => <EnterNamePopup {...nameErrorProps} />)
}

export default load
