// @flow
import * as React from 'react'
import {Avatar, Box2, Divider, Icon, ConnectedUsernames, Markdown} from '../../common-adapters'
import Text, {type TextType} from '../../common-adapters/text'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {formatTimeForStellarTransaction} from '../../util/timestamp'
import Transaction from '../transaction'

type Role = 'sender' | 'receiver'
type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'wallet'

type DetailProps = {|
  large: boolean,
  pending: boolean,
  yourRole: Role,
  counterparty: string,
  counterpartyType: CounterpartyType,
  amountUser: string,
|}

export type Props = {|
  large: boolean,

  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,

  yourRole: Role,
  counterparty: string,
  counterpartyType: CounterpartyType,
  amountUser: string,
  amountXLM: string,

  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string,
|}

const TransactionDetails = (props: Props) => {
  return (
    <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      <Transaction {...props}  />
    </Box2>
  )
}

const styles = styleSheetCreate({
  container: {

  },
})

export default TransactionDetails
