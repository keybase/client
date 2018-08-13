// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Participants from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Participants: props => ({}),
})

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Participants', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={{maxWidth: 360}}>{story()}</Box>)
    .add('To Keybase User', () => <Participants recipientType="keybaseUser" />)
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
        username="yen"
        fullname="Addie Stokes"
        onShowProfile={Sb.action('onShowProfile')}
        onRemoveProfile={Sb.action('onRemoveUser')}
      />
    ))
}

export default load
