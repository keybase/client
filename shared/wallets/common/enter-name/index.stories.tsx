import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import EnterName from '.'
import WalletPopup from '../wallet-popup'

const enterNameProps = {
  name: '',
  onNameChange: Sb.action('onNameChange'),
}

const nameErrorProps = {
  ...enterNameProps,
  error: 'Error: name too long',
  name: 'this is too long',
}

const load = () => {
  Sb.storiesOf('Wallets/Common/Enter Name Popup', module)
    .addDecorator(story => (
      <WalletPopup onExit={Sb.action('onExit')} backButtonType="cancel" headerTitle="Name account">
        {story()}
      </WalletPopup>
    ))
    .add('Enter name', () => <EnterName {...enterNameProps} />)
    .add('Prefilled name', () => <EnterName {...enterNameProps} name="mikem's third account" />)
    .add('Name error', () => <EnterName {...nameErrorProps} />)
}

export default load
