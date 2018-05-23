// @flow
import * as React from 'react'
import {Avatar, Box2, Divider, Icon, ConnectedUsernames, Markdown, NameWithIcon} from '../../common-adapters'
import Text, {type TextType} from '../../common-adapters/text'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {formatTimeForStellarTransaction} from '../../util/timestamp'
import Transaction, {CounterpartyIcon, CounterpartyText} from '../transaction'

type Role = 'sender' | 'receiver'
type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'wallet'

export type Props = {|
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,

  yourRole: Role,
  counterparty: string,
  counterpartyMeta?: string,
  counterpartyType: CounterpartyType,
  amountUser: string,
  amountXLM: string,

  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string,
|}

type CounterpartyProps = {|
  counterparty: string,
  counterpartyMeta?: string,
  counterpartyType: CounterpartyType,
  you: string,
  yourRole: Role,
|}

const Counterparty = (props: CounterpartyProps) => props.counterpartyType === 'keybaseUser' ? <NameWithIcon
  colorFollowing={true}
  horizontal={true}
  username={props.counterparty}
  metaOne={props.counterpartyMeta}
/> : 
<Box2 direction="horizontal" fullHeight={true}>
  <CounterpartyIcon
    counterparty={props.yourRole === 'sender' ? props.you : props.counterparty}
    counterpartyType={props.yourRole === 'sender' ? 'keybaseUser' : props.counterpartyType}
  />
  <Box2 direction="vertical" fullWidth={true}>
    <CounterpartyText
      counterparty={props.yourRole === 'sender' ? props.you : props.counterparty}
      counterpartyType={props.yourRole === 'sender' ? 'keybaseUser' : props.counterpartyType}
      large={true}
    />
    <Text type="Body">foo</Text>
  </Box2>
</Box2>


const TransactionDetails = (props: Props) => (
    <Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.container}>
      <Transaction {...props} large={true} />
      <Divider />
      <Text type="BodySmallSemibold">Sender:</Text>
          
      <Text type="BodySmallSemibold">Recipient:</Text>
      <Text type="BodySmallSemibold">Status:</Text>
      <Text type="BodySmallSemibold">Public memo:</Text>
      <Text type="BodySmallSemibold">Transaction ID:</Text>
      <Text type="Body">{props.transactionID}</Text>

      <Text type="BodySmallPrimaryLink">View transaction</Text>

    </Box2>
  )

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
})

export default TransactionDetails
