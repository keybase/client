// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import RemoveAccountPopup from './remove-account'
import ReallyRemoveAccountPopup from './really-remove-account'
import SetDefaultAccountPopup from './set-default'

const warningProps = {
  name: 'awesome account',
  currency: '0.00 XLM',
  keys: '2 keys',
  onDelete: Sb.action('onDelete'),
  onClose: Sb.action('onClose'),
}

const reallyProps = {
  name: 'awesome account',
  onCopyKey: Sb.action('onCopyKey'),
  onClose: Sb.action('onClose'),
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
