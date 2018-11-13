// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box2, Text} from '../../../common-adapters'
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

const participantProviderProperties = {
  ...makeResultsListSelectorMap(connectPropsMap),
  ...makeUserInputSelectorMap([]),
}

const provider = Sb.createPropProviderWithCommon(participantProviderProperties)

const primaryAccount: Account = {
  name: 'Primary Account',
  contents: '2000 XLM',
  id: stringToAccountID('fakeaccountID'),
  isDefault: true,
}

const accounts = [
  primaryAccount,
  {
    name: 'Secondary Account',
    contents: '6435 XLM',
    id: stringToAccountID('fakeaccountID2'),
    isDefault: false,
  },
  {
    name: 'third Account',
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID3'),
    isDefault: false,
  },
]

const keybaseUserProps = {
  isRequest: false,
  recipientUsername: '',
  onShowProfile: Sb.action('onShowProfile'),
  onShowSuggestions: Sb.action('onShowSuggestions'),
  onRemoveProfile: Sb.action('onRemoveProfile'),
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onScanQRCode: null,
}

const stellarPublicKeyProps = {
  recipientPublicKey: '',
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onScanQRCode: Sb.action('onScanQRCode'),
}

const otherAccountProps = {
  user: 'cjb',
  fromAccount: primaryAccount,
  allAccounts: accounts,
  onChangeFromAccount: Sb.action('onChangeFromAccount'),
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onLinkAccount: Sb.action('onLinkAccount'),
  onCreateNewAccount: Sb.action('onCreateNewAccount'),
  showSpinner: false,
}

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Participants', module)
    .addDecorator(provider)
    .add('To Keybase user', () => <ParticipantsKeybaseUser {...keybaseUserProps} />)
    .add('To Keybase user with QR', () => (
      <ParticipantsKeybaseUser {...keybaseUserProps} onScanQRCode={Sb.action('onScanQRCode')} />
    ))
    .add('To Keybase user chris', () => (
      <ParticipantsKeybaseUser {...keybaseUserProps} recipientUsername="chris" />
    ))
    .add('Request from Keybase user chris', () => (
      <ParticipantsKeybaseUser {...keybaseUserProps} isRequest={true} recipientUsername="chris" />
    ))
    .add('To stellar address', () => <ParticipantsStellarPublicKey {...stellarPublicKeyProps} />)
    .add('To stellar address with QR', () => <ParticipantsStellarPublicKey {...stellarPublicKeyProps} />)
    .add('Stellar address Error', () => (
      <ParticipantsStellarPublicKey {...stellarPublicKeyProps} errorMessage="Stellar address incorrect" />
    ))
    .add('To other account (multiple accounts)', () => (
      <Box2 direction="vertical" gap="small">
        <Text type="Header">Initial State:</Text>
        <ParticipantsOtherAccount {...otherAccountProps} />
        <Text type="Header">Before setting toAccount:</Text>
        <ParticipantsOtherAccount {...otherAccountProps} showSpinner={true} />
        <Text type="Header">After setting toAccount, but before toAccount is loaded:</Text>
        <ParticipantsOtherAccount {...otherAccountProps} showSpinner={true} />
      </Box2>
    ))
    .add('To other account (one account)', () => (
      <ParticipantsOtherAccount {...otherAccountProps} allAccounts={accounts.slice(0, 1)} />
    ))
}

export default load
