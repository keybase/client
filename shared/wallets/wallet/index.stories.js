// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box2} from '../../common-adapters'
import Header from './header'
import SettingsPopup from './settings-popup'
import RemoveAccountDialog from './settings-popup/remove-account'
import ReallyRemoveDialog from './settings-popup/remove-account-really'

const defaultWalletMock = {
  isDefaultWallet: true,
  keybaseUser: 'cecileb',
  walletName: "cecileb's account",
}

const secondWalletMock = {
  isDefaultWallet: false,
  walletName: 'Second account',
}

const commonActions = {
  navigateAppend: Sb.action('navigateAppend'),
  onDeposit: Sb.action('onDeposit'),
  onReceive: Sb.action('onReceive'),
  onSendToAnotherWallet: Sb.action('onSendToAnotherWallet'),
  onSendToKeybaseUser: Sb.action('onSendToKeybaseUser'),
  onSendToStellarAddress: Sb.action('onSendToStellarAddress'),
  onSettings: Sb.action('onSettings'),
  onShowSecretKey: Sb.action('onShowSecretKey'),
}

const defaultSettingsProps = {
  name: 'awesome account',
  user: 'testuser',
  isDefault: true,
  currency: 'USD ($)',
  currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
}

const secondarySettingsProps = {
  name: 'some other account',
  user: 'testuser',
  isDefault: false,
  currency: 'XLM',
  currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
}

const warningProps = {
  name: 'awesome account',
  currency: '0.00 XLM',
  keys: '2 keys',
  onDelete: action('onDelete'),
  onClose: action('onClose'),
}

const reallyProps = {
  name: 'awesome account',
  onCopyKey: action('onCopyKey'),
  onClose: action('onClose'),
}

const provider = PropProviders.CommonProvider()

const load = () => {
  Sb.storiesOf('Wallets/Wallet', module)
    .add('Default wallet', () => (
      <Box2 direction="horizontal" style={styleWidth}>
        <Header {...commonActions} {...defaultWalletMock} />
      </Box2>
    ))
    .add('Second wallet', () => (
      <Box2 direction="horizontal" style={styleWidth}>
        <Header {...commonActions} {...secondWalletMock} />
      </Box2>
    ))
    .add('Settings, default', () => <SettingsPopup {...defaultSettingsProps} />)
    .add('Settings, secondary', () => <SettingsPopup {...secondarySettingsProps} />)
    .add('Remove warning', () => <RemoveAccountDialog {...warningProps} />)
    .add('Really remove', () => <ReallyRemoveDialog {...reallyProps} />)
}

const styleWidth = {width: 520}

export default load
