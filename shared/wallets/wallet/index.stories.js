// @flow
import * as PropProviders from '../../stories/prop-providers'
import React from 'react'
import {Box2} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import Header from './header'

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
  onDeposit: action('onDeposit'),
  onReceive: action('onReceive'),
  onSendToAnotherWallet: action('onSendToAnotherWallet'),
  onSendToKeybaseUser: action('onSendToKeybaseUser'),
  onSendToStellarAddress: action('onSendToStellarAddress'),
  onSettings: action('onSettings'),
  onShowSecretKey: action('onShowSecretKey'),
}

const provider = PropProviders.Common()

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
}

const styleWidth = {width: 520}

export default load
