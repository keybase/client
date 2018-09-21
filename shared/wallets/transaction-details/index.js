// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, Divider, Icon, NameWithIcon, Text} from '../../common-adapters'
import {capitalize} from 'lodash-es'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../../styles'
import Transaction, {CounterpartyIcon, CounterpartyText, TimestampLine} from '../transaction'
import {SmallAccountID} from '../common'

type Role = 'sender' | 'receiver'

export type Props = {|
  amountUser: string,
  amountXLM: string,
  counterparty: string,
  counterpartyMeta: ?string,
  counterpartyType: Types.CounterpartyType,
  delta: 'none' | 'increase' | 'decrease',
  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string,
  onBack: () => void,
  title: string,
  onLoadPaymentDetail: () => void,
  onViewTransaction?: () => void,
  publicMemo?: string,
  recipientAccountID: ?Types.AccountID,
  senderAccountID: Types.AccountID,
  status: Types.StatusSimplified,
  statusDetail: string,
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  transactionID?: string,
  you: string,
  yourRole: Role,
|}

type CounterpartyProps = {|
  accountID: ?Types.AccountID,
  counterparty: string,
  counterpartyMeta: ?string,
  counterpartyType: Types.CounterpartyType,
  isYou: boolean,
  you: string,
  yourRole: Role,
|}

const Counterparty = (props: CounterpartyProps) => {
  if (props.isYou) {
    return (
      <NameWithIcon
        colorFollowing={true}
        horizontal={true}
        username={props.you}
        metaOne="You"
        metaTwo={props.accountID && <SmallAccountID accountID={props.accountID} />}
      />
    )
  }

  if (props.counterpartyType === 'keybaseUser') {
    return (
      <NameWithIcon
        colorFollowing={true}
        horizontal={true}
        username={props.counterparty}
        metaOne={props.counterpartyMeta}
        metaTwo={props.accountID && <SmallAccountID accountID={props.accountID} />}
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
      <Box2 direction="vertical" fullWidth={true} style={styles.counterPartyText}>
        <CounterpartyText
          counterparty={props.counterparty}
          counterpartyType={props.counterpartyType}
          large={false}
          showFullKey={true}
          textType="BodySemibold"
        />
        {props.accountID && <SmallAccountID accountID={props.accountID} />}
      </Box2>
    </Box2>
  )
}

const colorForStatus = (status: Types.StatusSimplified) => {
  switch (status) {
    case 'completed':
      return globalColors.green
    case 'pending':
      return globalColors.black_75
    case 'error':
      return globalColors.red
    default:
      return globalColors.black
  }
}

const descriptionForStatus = (status: Types.StatusSimplified, yourRole: Role) =>
  status === 'completed' ? (yourRole === 'receiver' ? 'Received' : 'Sent') : capitalize(status)

class TransactionDetails extends React.Component<Props> {
  componentDidMount() {
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
          status={this.props.status}
          statusDetail={this.props.statusDetail}
          timestamp={this.props.timestamp}
          yourRole={this.props.yourRole}
        />
        <Divider />

        <Box2 direction="vertical" gap="xtiny" fullWidth={true}>
          <Text type="BodySmallSemibold">Sender:</Text>
          <Counterparty
            accountID={this.props.senderAccountID}
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
            accountID={this.props.recipientAccountID}
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
          <Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.statusBox}>
            <Icon
              color={colorForStatus(this.props.status)}
              fontSize={16}
              type={
                this.props.status === 'error'
                  ? 'iconfont-close'
                  : this.props.status === 'completed'
                    ? 'iconfont-success'
                    : 'icon-transaction-pending-16'
              }
            />
            <Text
              style={collapseStyles([
                styles.statusText,
                {color: colorForStatus(this.props.status), marginLeft: globalMargins.xtiny},
              ])}
              type="Body"
            >
              {descriptionForStatus(this.props.status, this.props.yourRole)}
            </Text>
          </Box2>
          {this.props.status !== 'error' && (
            <TimestampLine
              status={this.props.status}
              error={this.props.statusDetail}
              relative={false}
              timestamp={this.props.timestamp}
            />
          )}
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

export default TransactionDetails

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.small,
  },
  counterPartyText: {
    justifyContent: 'center',
    marginLeft: globalMargins.tiny,
  },
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
  statusBox: {
    alignItems: 'center',
  },
  statusText: {
    marginLeft: globalMargins.xtiny,
  },
})
