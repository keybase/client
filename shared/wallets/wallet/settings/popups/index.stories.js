// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import RemoveAccountPopup from './remove-account'
import ReallyRemoveAccountPopup from './really-remove-account'
import SetDefaultAccountPopup from './set-default'

const warningProps = {
  balance: '0.00 XLM',
  name: 'awesome account',
  onClose: Sb.action('onClose'),
  onDelete: Sb.action('onDelete'),
}

const reallyProps = {
  name: 'awesome account',
  onCancel: Sb.action('onCancel'),
  onFinish: Sb.action('onFinish'),
  onCopyKey: Sb.action('onCopyKey'),
}

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings/Popups', module)
    .add('Remove account', () => <RemoveAccountPopup {...warningProps} />)
    .add('Really remove account', () => <ReallyRemoveAccountPopup {...reallyProps} />)
    .add('Set as default popup', () => (
      <SetDefaultAccountPopup
        accountName="Second account"
        onAccept={Sb.action('onAccept')}
        onClose={Sb.action('onClose')}
        username="cecileb"
      />
    ))
}

export default load
