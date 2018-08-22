// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import FromField from './from-field'
import ToField from './to-field'
import type {CounterpartyType} from '../../../constants/types/wallets'

export type Account = {|
  name: string,
  user: string,
  contents: string,
|}

type ParticipantsProps = {|
  recipientType: CounterpartyType,
  /* Used for send to other account */
  fromAccount: Account,
  allAccounts: Account[],
  onChangeFromAccount: (accountName: string) => void,
  onChangeToAccount: (accountName: string) => void,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
  /* Used for send to stellar address */
  incorrect?: string,
  onChangeAddress: string => void,
  /* Used to display a keybase profile */
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
        accounts={props.allAccounts ? props.allAccounts : []}
        onChangeSelectedAccount={props.onChangeFromAccount}
      />
    )}
    <ToField
      recipientType={props.recipientType}
      accounts={props.allAccounts ? props.allAccounts : []}
      incorrect={props.incorrect}
      username={props.recipientUsername}
      fullName={props.recipientFullName}
      onRemoveProfile={props.onRemoveProfile}
      onShowProfile={props.onShowProfile}
      onChangeAddress={props.onChangeAddress}
      onLinkAccount={props.onLinkAccount}
      onCreateNewAccount={props.onCreateNewAccount}
      onChangeSelectedAccount={props.onChangeToAccount}
    />
  </Kb.Box2>
)

export default Participants
