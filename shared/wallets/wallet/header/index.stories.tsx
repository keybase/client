import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Types from '../../../constants/types/wallets'
import {Box2} from '../../../common-adapters'
import Header from '.'

const provider = Sb.createPropProviderWithCommon({
  WalletDropdownButton: props => ({
    disabled: false,
    onSettings: Sb.action('onSettings'),
    onShowSecretKey: Sb.action('onShowSecretKey'),
    small: props.small,
  }),
  WalletSendButton: props => ({
    disabled: false,
    onSendToAnotherAccount: Sb.action('onSendToAnotherAccount'),
    onSendToKeybaseUser: Sb.action('onSendToKeybaseUser'),
    onSendToStellarAddress: Sb.action('onSendToStellarAddress'),
    small: props.small,
    thisDeviceIsLockedOut: false,
  }),
})

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
  onBack: Sb.action('onBack'),
  onReceive: Sb.action('onReceive'),
  onSettings: Sb.action('onSettings'),
  thisDeviceIsLockedOut: false,
  unreadPayments: false,
}

export const Container = (storyFn: any) => (
  <Box2 direction="horizontal" style={styleWidth}>
    {storyFn()}
  </Box2>
)

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Header', module)
    .addDecorator(provider)
    .addDecorator(Container)
    .add('Default wallet', () => <Header {...common} {...defaultWalletMock} />)
    .add('Second wallet', () => <Header {...common} {...secondWalletMock} />)
}

const styleWidth = {width: 520}

export default load
