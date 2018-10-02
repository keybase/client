// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import {stringToAccountID} from '../../../constants/types/wallets'
import {
  type Account,
  ParticipantsKeybaseUser,
  ParticipantsStellarPublicKey,
  ParticipantsOtherAccount,
} from '.'
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

const keybaseUserProps = {
  recipientType: 'keybaseUser',
  recipientUsername: '',
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onShowProfile: Sb.action('onShowProfile'),
  onShowSuggestions: Sb.action('onShowSuggestions'),
  onRemoveProfile: Sb.action('onRemoveProfile'),
}

const otherAccountProps = {
  recipientType: 'otherAccount',
  user: 'cjb',
  fromAccount: primaryAccount,
  allAccounts: accounts,
  onChangeFromAccount: Sb.action('onChangeFromAccount'),
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onLinkAccount: Sb.action('onLinkAccount'),
  onCreateNewAccount: Sb.action('onCreateNewAccount'),
}

const stellarPublicKeyProps = {
  recipientType: 'stellarPublicKey',
  incorrect: '',
  toFieldInput: '',
  onChangeRecipient: Sb.action('onChangeRecipient'),
}

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Participants', module)
    .addDecorator(provider)
    .addDecorator(story => <Box style={{maxWidth: 360, marginTop: 60}}>{story()}</Box>)
    .add('To Keybase user', () => <ParticipantsKeybaseUser {...keybaseUserProps} />)
    .add('To stellar address', () => <ParticipantsStellarPublicKey {...stellarPublicKeyProps} />)
    .add('Stellar address Error', () => (
      <ParticipantsStellarPublicKey {...stellarPublicKeyProps} incorrect="Stellar address incorrect" />
    ))
    .add('To other account (multiple accounts)', () => <ParticipantsOtherAccount {...otherAccountProps} />)
    .add('To other account (one account)', () => (
      <ParticipantsOtherAccount {...otherAccountProps} allAccounts={accounts.slice(0, 1)} />
    ))
}

export default load
