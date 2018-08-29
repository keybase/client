// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Participants, {type Account} from '.'
import {makeSelectorMap as makeResultsListSelectorMap} from '../../../search/results-list/index.stories'
import {type ConnectPropsMap as RowConnectPropsMap} from '../../../search/result-row/index.stories'
import {makeSelectorMap as makeUserInputSelectorMap} from '../../../search/user-input/index.stories'

const connectPropsMap: RowConnectPropsMap = {
  chris: {
    leftFullname: 'chris',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'Chris Coyne',

    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    leftFollowingState: 'Following',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
    userAlreadySelected: false,
    userIsSelectable: true,
  },
  cjb: {
    leftFullname: 'cjb',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'Chris Ball',

    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
    userAlreadySelected: false,
    userIsSelectable: true,
  },
  jzila: {
    leftFullname: 'jzila',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'John Zila',

    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    leftFollowingState: 'NotFollowing',
    rightFollowingState: 'NoState',
    userIsInTeam: false,
    userAlreadySelected: false,
    userIsSelectable: true,
  },
}

export const participantProviderProperties = {
  ...makeResultsListSelectorMap(connectPropsMap),
  ...makeUserInputSelectorMap([]),
}

const provider = Sb.createPropProviderWithCommon(participantProviderProperties)

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
  // Account -> Account transactions
  fromAccount: primaryAccount,
  allAccounts: accounts,
  onChangeFromAccount: Sb.action('onChangeFromAccount'),
  onChangeToAccount: Sb.action('onChangeToAccount'),
  onLinkAccount: Sb.action('onLinkAccount'),
  onCreateNewAccount: Sb.action('onCreateNewAccount'),
  // Stellar address
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onShowProfile: Sb.action('onShowProfile'),
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
}

export default load
