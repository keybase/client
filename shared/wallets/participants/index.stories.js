// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box} from '../../common-adapters'
import Participants from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Participants: props => ({}),
})

const confirmCommonProps = {
  isConfirm: true,
  fromWallet: 'Primary Wallet',
  fromWalletUser: 'cjb',
  fromWalletContents: '2000 XLM',
  recipientUsername: 'zanderz',
  recipientFullName: 'Steve Sanders',
  recipientStellarAddress: 'GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I46',
  onShowProfile: Sb.action('onShowProfile'),
}

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Participants', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={{maxWidth: 360}}>{story()}</Box>)
    .add('To Keybase user', () => <Participants recipientType="keybaseUser" />)
    .add('To other wallet', () => (
      <Participants
        recipientType="otherWallet"
        fromWallet="Primary Wallet"
        fromWalletUser="cjb"
        fromWalletContents="2000 XLM"
      />
    ))
    .add('To stellar address', () => <Participants recipientType="stellarAddress" />)
    .add('Stellar address Error', () => <Participants incorrect={true} recipientType="stellarAddress" />)
    .add('User match', () => (
      <Participants
        recipientType="keybaseUser"
        recipientUsername="yen"
        recipientFullName="Addie Stokes"
        onShowProfile={Sb.action('onShowProfile')}
        onRemoveProfile={Sb.action('onRemoveProfile')}
      />
    ))
    .add('Confirm to Keybase user', () => (
      <Participants recipientType="keybaseUser" {...confirmCommonProps} />
    ))
    .add('Confirm to other wallet', () => <Participants recipientType="otherWallet" isConfirm={true} />)
    .add('Confirm to stellar address', () => (
      <Participants recipientType="stellarAddress" {...confirmCommonProps} />
    ))
}

export default load
