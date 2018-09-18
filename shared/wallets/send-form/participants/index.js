// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import FromField from './from-field'
import ToField from './to-field'
import type {CounterpartyType, AccountID} from '../../../constants/types/wallets'

export type Account = {|
  contents: string,
  name: string,
  id: AccountID,
|}

type ParticipantsProps = {|
  recipientType: CounterpartyType,
  // Used for send to other account
  user: string,
  fromAccount?: Account,
  toAccount?: Account,
  allAccounts: Account[],
  onChangeFromAccount: string => void,
  onChangeRecipient: string => void,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
  // Used for send to stellar address
  incorrect?: string,
  toFieldInput: string,
  // Used to display a keybase profile
  recipientUsername?: string,
  recipientFullName?: string,
  onShowProfile?: string => void,
  onRemoveProfile?: () => void,
|}

const Participants = (props: ParticipantsProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.recipientType === 'otherAccount' &&
      props.fromAccount && (
        <FromField
          initialAccount={props.fromAccount}
          accounts={props.allAccounts}
          onChangeSelectedAccount={props.onChangeFromAccount}
          user={props.user}
        />
      )}
    <ToField
      toAccount={props.toAccount}
      accounts={props.allAccounts}
      incorrect={props.incorrect}
      onChangeRecipient={props.onChangeRecipient}
      onCreateNewAccount={props.onCreateNewAccount}
      onLinkAccount={props.onLinkAccount}
      onRemoveProfile={props.onRemoveProfile}
      onShowProfile={props.onShowProfile}
      recipientFullName={props.recipientFullName}
      recipientType={props.recipientType}
      recipientUsername={props.recipientUsername}
      toFieldInput={props.toFieldInput}
      user={props.user}
    />
  </Kb.Box2>
)

export default Participants
