// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Types from '../../../constants/types/wallets'
import {Box2} from '../../../common-adapters'
import Header from '.'

const defaultWalletMock = {
  isDefaultWallet: true,
  keybaseUser: 'cecileb',
  walletName: "cecileb's account",
}

const secondWalletMock = {
  isDefaultWallet: false,
  keybaseUser: 'cecileb',
  walletName: 'Second account',
}

const common = {
  accountID: Types.stringToAccountID('GDP25ACNJ6CDEJLILV5UZZIQS66SHHWQ3554EMBF4VPXXKKYXXXMTAGZ'),
  navigateAppend: Sb.action('navigateAppend'),
  onDeposit: Sb.action('onDeposit'),
  onReceive: Sb.action('onReceive'),
  onSendToAnotherAccount: Sb.action('onSendToAnotherAccount'),
  onSendToKeybaseUser: Sb.action('onSendToKeybaseUser'),
  onSendToStellarAddress: Sb.action('onSendToStellarAddress'),
  onSettings: Sb.action('onSettings'),
  onShowSecretKey: Sb.action('onShowSecretKey'),
}

export const Container = (storyFn: any) => (
  <Box2 direction="horizontal" style={styleWidth}>
    {storyFn()}
  </Box2>
)

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Header', module)
    .addDecorator(Container)
    .add('Default wallet', () => <Header {...common} {...defaultWalletMock} />)
    .add('Second wallet', () => <Header {...common} {...secondWalletMock} />)
}

const styleWidth = {width: 520}

export default load
