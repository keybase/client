// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import FromField from './from-field'
import {ToKeybaseUser, ToStellarPublicKey, ToOtherAccount} from './to-field'
import type {AccountID} from '../../../constants/types/wallets'

export type Account = {|
  contents: string,
  name: string,
  id: AccountID,
|}

type ParticipantsKeybaseUserProps = {|
  recipientType: 'keybaseUser',
  recipientUsername: string,
  onChangeRecipient: string => void,
  onShowProfile: string => void,
  onShowSuggestions: () => void,
  onRemoveProfile: () => void,
|}

type ParticipantsStellarPublicKeyProps = {|
  recipientType: 'stellarPublicKey',
  incorrect?: string,
  toFieldInput: string,
  onChangeRecipient: string => void,
|}

type ParticipantsOtherAccountProps = {|
  recipientType: 'otherAccount',
  user: string,
  fromAccount?: Account,
  toAccount?: Account,
  allAccounts: Account[],
  onChangeRecipient: string => void,
  onChangeFromAccount: string => void,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
|}

type ParticipantsProps =
  | ParticipantsKeybaseUserProps
  | ParticipantsStellarPublicKeyProps
  | ParticipantsOtherAccountProps

const ParticipantsKeybaseUser = (props: ParticipantsKeybaseUserProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <ToKeybaseUser
      recipientUsername={props.recipientUsername}
      onChangeRecipient={props.onChangeRecipient}
      onShowProfile={props.onShowProfile}
      onShowSuggestions={props.onShowSuggestions}
      onRemoveProfile={props.onRemoveProfile}
    />
  </Kb.Box2>
)

const ParticipantsStellarPublicKey = (props: ParticipantsStellarPublicKeyProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <ToStellarPublicKey
      recipientPublicKey={props.toFieldInput}
      errorMessage={props.incorrect}
      onChangeRecipient={props.onChangeRecipient}
    />
  </Kb.Box2>
)

const ParticipantsOtherAccount = (props: ParticipantsOtherAccountProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.fromAccount && (
      <FromField
        initialAccount={props.fromAccount}
        accounts={props.allAccounts}
        onChangeSelectedAccount={props.onChangeFromAccount}
        user={props.user}
      />
    )}
    <ToOtherAccount
      user={props.user}
      toAccount={props.toAccount}
      allAccounts={props.allAccounts}
      onChangeRecipient={props.onChangeRecipient}
      onLinkAccount={props.onLinkAccount}
      onCreateNewAccount={props.onCreateNewAccount}
    />
  </Kb.Box2>
)

const Participants = (props: ParticipantsProps) => {
  switch (props.recipientType) {
    case 'keybaseUser':
      return <ParticipantsKeybaseUser {...props} />
    case 'stellarPublicKey':
      return <ParticipantsStellarPublicKey {...props} />
    case 'otherAccount':
      return <ParticipantsOtherAccount {...props} />
    default:
      /*::
    declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (recipientType: empty) => any
    ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.recipientType);
    */
      return null
  }
}

export default Participants
