// @flow
import React from 'react'
import {Box2} from '../../common-adapters'
import {storiesOf, action, PropProviders} from '../../stories/storybook'
import Header from './header'
import SettingsPopup from './settings-popup'

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

const load = () => {
  storiesOf('Wallets/Wallet', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
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
}

const styleWidth = {width: 520}

export default load
