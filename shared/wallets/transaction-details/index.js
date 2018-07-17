// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, Divider, Icon, NameWithIcon, Text} from '../../common-adapters'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'
import Transaction, {CounterpartyIcon, CounterpartyText, Timestamp} from '../transaction'

type Role = 'sender' | 'receiver'

export type Props = {|
  amountUser: string,
  amountXLM: string,
  counterparty: string,
  counterpartyMeta?: string,
  counterpartyType: Types.CounterpartyType,
  delta: 'increase' | 'decrease',
  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string,
  onLoadPaymentDetail: () => void,
  onViewTransaction?: () => void,
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
  counterpartyType: Types.CounterpartyType,
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
  }

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

export default class extends React.Component<Props> {
  componentWillMount() {
    this.props.onLoadPaymentDetail()
  }

  render() {
    return (
      <Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        <Transaction
          amountUser={this.props.amountUser}
          amountXLM={this.props.amountXLM}
          counterparty={this.props.counterparty}
          counterpartyType={this.props.counterpartyType}
          delta={this.props.delta}
          large={true}
          memo={this.props.memo}
          onSelectTransaction={() => {}}
          timestamp={this.props.timestamp}
          yourRole={this.props.yourRole}
        />
        <Divider />

        <Box2 direction="vertical" gap="xtiny" fullWidth={true}>
          <Text type="BodySmallSemibold">Sender:</Text>
          <Counterparty
            counterparty={this.props.counterparty}
            counterpartyMeta={this.props.counterpartyMeta}
            counterpartyType={this.props.counterpartyType}
            isYou={this.props.yourRole === 'sender'}
            you={this.props.you}
            yourRole={this.props.yourRole}
          />
        </Box2>

        <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Text type="BodySmallSemibold">Recipient:</Text>
          <Counterparty
            counterparty={this.props.counterparty}
            counterpartyMeta={this.props.counterpartyMeta}
            counterpartyType={this.props.counterpartyType}
            isYou={this.props.yourRole === 'receiver'}
            you={this.props.you}
            yourRole={this.props.yourRole}
          />
        </Box2>

        <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Text type="BodySmallSemibold">Status:</Text>
          <Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={{alignItems: 'center'}}>
            <Icon
              color={this.props.timestamp ? globalColors.green2 : globalColors.black}
              fontSize={16}
              type={this.props.timestamp ? 'iconfont-success' : 'icon-transaction-pending-16'}
            />
            <Text
              style={{
                color: this.props.timestamp ? globalColors.green2 : globalColors.black,
                marginLeft: globalMargins.xtiny,
              }}
              type="Body"
            >
              {this.props.timestamp ? 'Sent' : 'Pending'}
            </Text>
          </Box2>
          <Timestamp relative={false} timestamp={this.props.timestamp} />
        </Box2>

        <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Text type="BodySmallSemibold">Public memo:</Text>
          <Text type="Body">{this.props.publicMemo}</Text>
        </Box2>

        <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Text type="BodySmallSemibold">Transaction ID:</Text>
          <Text type="Body">{this.props.transactionID}</Text>
          {this.props.onViewTransaction && (
            <Text onClick={this.props.onViewTransaction} type="BodySmallPrimaryLink">
              View transaction
            </Text>
          )}
        </Box2>
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.small,
  },
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
})
