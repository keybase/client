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
  fromAccount: Account,
  /* Used for send to other account */
  allAccounts?: Account[],
  /* Used for send to stellar address */
  incorrect?: string,
  onChangeAddress?: string => void,
  /* Used to display a keybase profile */
  recipientUsername?: string,
  recipientFullName?: string,
  recipientStellarAddress?: string,
  onShowProfile?: string => void,
  onRemoveProfile?: () => void,
|}

const Participants = (props: ParticipantsProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.recipientType === 'otherAccount' &&
      props.fromAccount && (
        <FromField initialAccount={props.fromAccount} accounts={props.allAccounts ? props.allAccounts : []} />
      )}
    <ToField
      recipientType={props.recipientType}
      accounts={props.allAccounts ? props.allAccounts : []}
      incorrect={props.incorrect}
      username={props.recipientUsername}
      fullName={props.recipientFullName}
      stellarAddress={props.recipientStellarAddress}
      onRemoveProfile={props.onRemoveProfile}
      onShowProfile={props.onShowProfile}
      onChangeAddress={props.onChangeAddress}
    />
  </Kb.Box2>
)

export default Participants
