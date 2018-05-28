// @flow
import * as React from 'react'
import {Box2, Divider, Icon, NameWithIcon, Text} from '../../common-adapters'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'
import Transaction, {CounterpartyIcon, CounterpartyText, Timestamp} from '../transaction'

type Role = 'sender' | 'receiver'
type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'wallet'

export type Props = {|
  amountUser: string,
  amountXLM: string,
  counterparty: string,
  counterpartyMeta?: string,
  counterpartyType: CounterpartyType,
  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string,
  publicMemo?: string,
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  transactionID?: string,
  you: string,
  yourRole: Role,
|}

type CounterpartyProps = {|
  counterparty: string,
  counterpartyMeta?: string,
  counterpartyType: CounterpartyType,
  isYou: boolean,
  you: string,
  yourRole: Role,
|}

const Counterparty = (props: CounterpartyProps) => {
  if (props.isYou) {
    return <NameWithIcon colorFollowing={true} horizontal={true} username={props.you} metaOne="You" />
  }

  if (props.counterpartyType === 'keybaseUser') {
    return (
      <NameWithIcon
        colorFollowing={true}
        horizontal={true}
        username={props.counterparty}
        metaOne={props.counterpartyMeta}
      />
    )
  } else {
    return (
      <Box2 direction="horizontal" fullHeight={true}>
        <CounterpartyIcon
          counterparty={props.counterparty}
          counterpartyType={props.counterpartyType}
          large={false}
        />
        <Box2
          direction="vertical"
          fullWidth={true}
          style={{justifyContent: 'center', marginLeft: globalMargins.small}}
        >
          <CounterpartyText
            counterparty={props.counterparty}
            counterpartyType={props.counterpartyType}
            large={false}
            showFullKey={true}
            textType="BodySemibold"
          />
        </Box2>
      </Box2>
    )
  }
}

const TransactionDetails = (props: Props) => (
  <Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
    <Transaction
      amountUser={props.amountUser}
      amountXLM={props.amountXLM}
      counterparty={props.counterparty}
      counterpartyType={props.counterpartyType}
      large={true}
      memo={props.memo}
      timestamp={props.timestamp}
      yourRole={props.yourRole}
    />
    <Divider />

    <Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      <Text type="BodySmallSemibold">Sender:</Text>
      <Counterparty
        counterparty={props.counterparty}
        counterpartyMeta={props.counterpartyMeta}
        counterpartyType={props.counterpartyType}
        isYou={props.yourRole === 'sender'}
        you={props.you}
        yourRole={props.yourRole}
      />
    </Box2>

    <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
      <Text type="BodySmallSemibold">Recipient:</Text>
      <Counterparty
        counterparty={props.counterparty}
        counterpartyMeta={props.counterpartyMeta}
        counterpartyType={props.counterpartyType}
        isYou={props.yourRole === 'receiver'}
        you={props.you}
        yourRole={props.yourRole}
      />
    </Box2>

    <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
      <Text type="BodySmallSemibold">Status:</Text>
      <Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={{alignItems: 'center'}}>
        <Icon
          color={props.timestamp ? globalColors.green2 : globalColors.black}
          fontSize={16}
          type={props.timestamp ? 'iconfont-success' : 'icon-transaction-pending-16'}
        />
        <Text
          style={{
            color: props.timestamp ? globalColors.green2 : globalColors.black,
            marginLeft: globalMargins.xtiny,
          }}
          type="Body"
        >
          {props.timestamp ? 'Sent' : 'Pending'}
        </Text>
      </Box2>
      <Timestamp relative={false} timestamp={props.timestamp} />
    </Box2>

    <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
      <Text type="BodySmallSemibold">Public memo:</Text>
      <Text type="Body">{props.publicMemo}</Text>
    </Box2>

    <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
      <Text type="BodySmallSemibold">Transaction ID:</Text>
      <Text selectable={true} type="Body">
        {props.transactionID}
      </Text>
      <Text type="BodySmallPrimaryLink">View transaction</Text>
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.small,
  },
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
})

export default TransactionDetails
