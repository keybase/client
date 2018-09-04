// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import {stringToAccountID} from '../../../constants/types/wallets'
import Participants, {type Account} from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Participants: props => ({}),
})

const primaryAccount: Account = {
  name: 'Primary Account',
  contents: '2000 XLM',
  id: stringToAccountID('fakeaccountID'),
}

const accounts = [
  primaryAccount,
  {
    name: 'Secondary Account',
    contents: '6435 XLM',
    id: stringToAccountID('fakeaccountID2'),
  },
  {
    name: 'third Account',
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID3'),
  },
]

const defaultProps = {
  // Account -> Account transactions
  user: 'cjb',
  fromAccount: primaryAccount,
  allAccounts: accounts,
  onChangeFromAccount: Sb.action('onChangeFromAccount'),
  onChangeToAccount: Sb.action('onChangeToAccount'),
  onLinkAccount: Sb.action('onLinkAccount'),
  onCreateNewAccount: Sb.action('onCreateNewAccount'),
  // Stellar address
  onChangeAddress: Sb.action('onChangeAddress'),
}

const foundUsernameProps = {
  recipientUsername: 'yen',
  recipientFullName: 'Addie Stokes',
  onShowProfile: Sb.action('onShowProfile'),
  onRemoveProfile: Sb.action('onRemoveProfile'),
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
      <Participants {...defaultProps} {...foundUsernameProps} recipientType="keybaseUser" />
    ))
}

export default load
