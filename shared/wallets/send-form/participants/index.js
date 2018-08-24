// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import FromField from './from-field'
import ToField from './to-field'
import type {CounterpartyType} from '../../../constants/types/wallets'

export type Account = {|
  name: string,
  contents: string,
|}

type ParticipantsProps = {|
  recipientType: CounterpartyType,
  // Used for send to other account
  user: string,
  fromAccount: Account,
  allAccounts: Account[],
  onChangeFromAccount: (accountName: string) => void,
  onChangeToAccount: (accountName: string) => void,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
  // Used for send to stellar address
  incorrect?: string,
  onChangeAddress: string => void,
  // Used to display a keybase profile
  recipientUsername?: string,
  recipientFullName?: string,
  onShowProfile?: string => void,
  onRemoveProfile?: () => void,
|}

const Participants = (props: ParticipantsProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.recipientType === 'otherAccount' && (
      <FromField
        initialAccount={props.fromAccount}
        accounts={props.allAccounts}
        onChangeSelectedAccount={props.onChangeFromAccount}
        user={props.user}
      />
    )}
    <ToField
      accounts={props.allAccounts}
      recipientFullName={props.recipientFullName}
      incorrect={props.incorrect}
      onChangeAddress={props.onChangeAddress}
      onChangeSelectedAccount={props.onChangeToAccount}
      onCreateNewAccount={props.onCreateNewAccount}
      onLinkAccount={props.onLinkAccount}
      onRemoveProfile={props.onRemoveProfile}
      onShowProfile={props.onShowProfile}
      recipientType={props.recipientType}
      user={props.user}
      recipientUsername={props.recipientUsername}
    />
  </Kb.Box2>
)

export default Participants
