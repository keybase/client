// @flow
import * as PropProviders from '../../stories/prop-providers'
import React from 'react'
import {Box2} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
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
  type: 'default',
  currency: 'USD',
  onDelete: () => {},
  onSetDefault: () => {},
  onEditName: () => {},
}

const secondarySettingsProps = {
  name: 'some other wallet',
  user: 'testuser',
  type: 'secondary',
  currency: 'XLM',
  onDelete: () => {},
  onSetDefault: () => {},
  onEditName: () => {},
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
}

const styleWidth = {width: 520}

export default load
