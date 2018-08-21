// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import FromField from './from-field'
import ToField from './to-field'
import type {CounterpartyType} from '../../constants/types/wallets'

export type Wallet = {|
  name: string,
  user: string,
  contents: string,
|}

type ParticipantsProps = {|
  recipientType: CounterpartyType,
  /* Used for the confirm screen */
  isConfirm?: boolean,
  fromWallet?: Wallet,
  wallets?: Wallet[],
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
    {(props.isConfirm || props.recipientType === 'otherAccount') &&
      props.fromWallet && (
        <FromField
          isConfirm={props.isConfirm || false}
          initialWallet={props.fromWallet}
          wallets={props.wallets}
        />
      )}
    <ToField
      isConfirm={props.isConfirm || false}
      recipientType={props.recipientType}
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
