// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box2} from '../../common-adapters'
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
  name: 'awesome wallet',
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
  name: 'some other wallet',
  user: 'testuser',
  isDefault: false,
  currency: 'XLM',
  currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
}

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
}

const styleWidth = {width: 520}

export default load
