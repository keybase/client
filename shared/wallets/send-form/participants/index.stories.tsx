import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box2, Text} from '../../../common-adapters'
import {stringToAccountID} from '../../../constants/types/wallets'
import {Account, ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import {makeSelectorMap as makeResultsListSelectorMap} from '../../../search/results-list/index.stories'
import {ConnectPropsMap as RowConnectPropsMap} from '../../../search/result-row/index.stories'
import {makeSelectorMap as makeUserInputSelectorMap} from '../../../search/user-input/index.stories'

const connectPropsMap: RowConnectPropsMap = {
  chris: {
    leftFollowingState: 'Following',
    leftFullname: 'chris',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'Chris Coyne',

    rightFollowingState: 'NoState',
    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
  cjb: {
    leftFollowingState: 'NotFollowing',
    leftFullname: 'cjb',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'Chris Ball',

    rightFollowingState: 'NoState',
    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
  jzila: {
    leftFollowingState: 'NotFollowing',
    leftFullname: 'jzila',
    leftIcon: null,
    leftIconOpaque: true,
    leftService: 'Keybase',
    leftUsername: 'John Zila',

    rightFollowingState: 'NoState',
    rightIcon: null,
    rightIconOpaque: true,
    rightService: null,
    rightUsername: null,

    userAlreadySelected: false,
    userIsInTeam: false,
    userIsSelectable: true,
  },
} as any

const participantProviderProperties = {
  ...makeResultsListSelectorMap(connectPropsMap),
  ...makeUserInputSelectorMap([]),
  SendFormParticipantsSearch: o => ({...o, onVisibleScreen: true}),
}

const provider = Sb.createPropProviderWithCommon(participantProviderProperties)

const primaryAccount: Account = {
  contents: '2000 XLM',
  id: stringToAccountID('fakeaccountID'),
  isDefault: true,
  name: 'Primary Account',
}

const accounts = [
  primaryAccount,
  {
    contents: '6435 XLM',
    id: stringToAccountID('fakeaccountID2'),
    isDefault: false,
    name: 'Secondary Account',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID3'),
    isDefault: false,
    name: 'third Account',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID4'),
    isDefault: false,
    name: 'a',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID5'),
    isDefault: false,
    name: 'bb',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID6'),
    isDefault: false,
    name: 'ccc',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID7'),
    isDefault: false,
    name: 'dddd',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID8'),
    isDefault: false,
    name: 'eeeee',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID9'),
    isDefault: false,
    name: 'ffffff',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID10'),
    isDefault: false,
    name: 'ggggggg',
  },
  {
    contents: '10 XLM',
    id: stringToAccountID('fakeaccountID11'),
    isDefault: false,
    name: 'hhhhhhhh',
  },
]

const keybaseUserProps = {
  isRequest: false,
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onRemoveProfile: Sb.action('onRemoveProfile'),
  onScanQRCode: null,
  onShowProfile: Sb.action('onShowProfile'),
  onShowSuggestions: Sb.action('onShowSuggestions'),
  recipientUsername: '',
}

const stellarPublicKeyProps = {
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onScanQRCode: Sb.action('onScanQRCode'),
  recipientPublicKey: '',
  setReadyToReview: Sb.action('setReadyToReview'),
}

const otherAccountProps = {
  allAccounts: accounts,
  fromAccount: primaryAccount,
  onChangeFromAccount: Sb.action('onChangeFromAccount'),
  onChangeRecipient: Sb.action('onChangeRecipient'),
  onCreateNewAccount: Sb.action('onCreateNewAccount'),
  onLinkAccount: Sb.action('onLinkAccount'),
  showSpinner: false,
  user: 'cjb',
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
