// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box} from '../../common-adapters'
import Participants, {type Wallet} from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Participants: props => ({}),
})

const fromWallet: Wallet = {
  name: 'Primary Wallet',
  user: 'cjb',
  contents: '2000 XLM',
}

const wallets = [
  {
    name: 'Secondary Wallet',
    user: 'cjb',
    contents: '6435 XLM',
  },
  {
    name: 'third Wallet',
    user: 'cjb',
    contents: '10 XLM',
  },
]

const confirmCommonProps = {
  isConfirm: true,
  fromWallet,
  recipientUsername: 'zanderz',
  recipientFullName: 'Steve Sanders',
  recipientStellarAddress: 'GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I46',
  onShowProfile: Sb.action('onShowProfile'),
}

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Participants', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={{maxWidth: 360, marginTop: 60}}>{story()}</Box>)
    .add('To Keybase user', () => <Participants recipientType="keybaseUser" />)
    .add('To other wallet', () => (
      <Participants recipientType="otherAccount" fromWallet={fromWallet} wallets={wallets} />
    ))
    .add('To stellar address', () => <Participants recipientType="stellarPublicKey" />)
    .add('Stellar address Error', () => (
      <Participants incorrect="Stellar address incorrect" recipientType="stellarPublicKey" />
    ))
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
    .add('Confirm to other wallet', () => <Participants recipientType="otherAccount" isConfirm={true} />)
    .add('Confirm to stellar address', () => (
      <Participants recipientType="stellarPublicKey" {...confirmCommonProps} />
    ))
}

export default load
