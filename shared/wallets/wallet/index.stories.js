// @flow
import * as PropProviders from '../../stories/prop-providers'
import React from 'react'
import {Box2} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import Header from './header'
import SettingsPopup from './settings-popup'
import RemoveAccountDialog from './settings-popup/remove-account'

const defaultWalletMock = {
  isDefaultWallet: true,
  keybaseUser: 'cecileb',
  walletName: "cecileb's wallet",
}

const secondWalletMock = {
  isDefaultWallet: false,
  walletName: 'Second wallet',
}

const commonActions = {
  navigateAppend: action('navigateAppend'),
  onDeposit: action('onDeposit'),
  onReceive: action('onReceive'),
  onSendToAnotherWallet: action('onSendToAnotherWallet'),
  onSendToKeybaseUser: action('onSendToKeybaseUser'),
  onSendToStellarAddress: action('onSendToStellarAddress'),
  onSettings: action('onSettings'),
  onShowSecretKey: action('onShowSecretKey'),
}

const defaultSettingsProps = {
  name: 'awesome wallet',
  user: 'testuser',
  isDefault: true,
  currency: 'USD ($)',
  currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
  onDelete: action('onDelete'),
  onSetDefault: action('setDefault'),
  onEditName: action('onEditName'),
  onCurrencyChange: action('onCurrencyChange'),
}

const secondarySettingsProps = {
  name: 'some other wallet',
  user: 'testuser',
  isDefault: false,
  currency: 'XLM',
  currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
  onDelete: action('onDelete'),
  onSetDefault: action('setDefault'),
  onEditName: action('onEditName'),
  onCurrencyChange: action('onCurrencyChange'),
}

const warningProps = {
  name: 'awesome account',
  currency: '0.00 XLM',
  keys: '2 keys',
  onDelete: action('onDelete'),
  onClose: action('onClose'),
}

const provider = PropProviders.CommonProvider()

const load = () => {
  storiesOf('Wallets/Wallet', module)
    .addDecorator(provider)
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
}

const styleWidth = {width: 520}

export default load
