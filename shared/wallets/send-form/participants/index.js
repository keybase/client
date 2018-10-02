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

type ParticipantsProps =
  | {|
      recipientType: 'keybaseUser',
      recipientUsername: string,
      onChangeRecipient: string => void,
      onShowProfile: string => void,
      onShowSuggestions: () => void,
      onRemoveProfile: () => void,
    |}
  | {|
      recipientType: 'stellarPublicKey',
      incorrect?: string,
      toFieldInput: string,
      onChangeRecipient: string => void,
    |}
  | {|
      recipientType: 'otherAccount',
      user: string,
      fromAccount?: Account,
      toAccount?: Account,
      allAccounts: Account[],
      onChangeFromAccount: string => void,
      onChangeRecipient: string => void,
      onLinkAccount: () => void,
      onCreateNewAccount: () => void,
    |}

const Participants = (props: ParticipantsProps) => {
  switch (props.recipientType) {
    case 'keybaseUser':
      return (
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
    case 'stellarPublicKey':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <ToStellarPublicKey
            recipientPublicKey={props.toFieldInput}
            errorMessage={props.incorrect}
            onChangeRecipient={props.onChangeRecipient}
          />
        </Kb.Box2>
      )
    case 'otherAccount':
      return (
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
    default:
      /*::
    declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (recipientType: empty) => any
    ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.recipientType);
    */
      return null
  }
}

export default Participants
