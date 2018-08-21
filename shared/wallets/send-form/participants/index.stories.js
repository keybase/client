// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Participants, {type Account} from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Participants: props => ({}),
})

const primaryAccount: Account = {
  name: 'Primary Account',
  user: 'cjb',
  contents: '2000 XLM',
}

const accounts = [
  primaryAccount,
  {
    name: 'Secondary Account',
    user: 'cjb',
    contents: '6435 XLM',
  },
  {
    name: 'third Account',
    user: 'cjb',
    contents: '10 XLM',
  },
]

const defaultProps = {
  fromAccount: primaryAccount,
  allAccounts: accounts,
}

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Participants', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={{maxWidth: 360, marginTop: 60}}>{story()}</Box>)
    .add('To Keybase user', () => <Participants {...defaultProps} recipientType="keybaseUser" />)
    .add('To other account (multiple accounts)', () => (
      <Participants recipientType="otherAccount" {...defaultProps} />
    ))
    .add('To other account (one account)', () => (
      <Participants recipientType="otherAccount" {...defaultProps} allAccounts={accounts.slice(0, 1)} />
    ))
    .add('To stellar address', () => <Participants {...defaultProps} recipientType="stellarPublicKey" />)
    .add('Stellar address Error', () => (
      <Participants
        {...defaultProps}
        incorrect="Stellar address incorrect"
        recipientType="stellarPublicKey"
      />
    ))
    .add('User match', () => (
      <Participants
        {...defaultProps}
        recipientType="keybaseUser"
        recipientUsername="yen"
        recipientFullName="Addie Stokes"
        onShowProfile={Sb.action('onShowProfile')}
        onRemoveProfile={Sb.action('onRemoveProfile')}
      />
    ))
}

export default load
