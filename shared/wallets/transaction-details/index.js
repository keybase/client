// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, Divider, Icon, NameWithIcon, Text} from '../../common-adapters'
import {capitalize} from 'lodash-es'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../../styles'
import Transaction, {CounterpartyIcon, CounterpartyText, TimestampLine} from '../transaction'
import {SmallAccountID} from '../common'

export type Props = {|
  amountUser: string,
  amountXLM: string,
  counterparty: string,
  counterpartyMeta: ?string,
  counterpartyType: Types.CounterpartyType,
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
  yourRole: Types.Role,
|}

type CounterpartyProps = {|
  accountID: ?Types.AccountID,
  counterparty: string,
  counterpartyMeta: ?string,
  counterpartyType: Types.CounterpartyType,
|}

const Counterparty = (props: CounterpartyProps) => {
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
        {props.counterpartyType !== 'stellarPublicKey' &&
          props.accountID && <SmallAccountID accountID={props.accountID} />}
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

const descriptionForStatus = (status: Types.StatusSimplified, yourRole: Types.Role) => {
  if (status !== 'completed') {
    return capitalize(status)
  }

  switch (yourRole) {
    case 'senderOnly':
      return 'Sent'
    case 'receiverOnly':
      return 'Received'
    case 'senderAndReceiver':
      return 'Sent'
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove(yourRole);
      */
      throw new Error(`Unexpected role ${yourRole}`)
  }
}

const propsToParties = (props: Props) => {
  const yourAccountID = props.yourRole === 'senderOnly' ? props.senderAccountID : props.recipientAccountID
  const counterpartyAccountID =
    props.yourRole === 'senderOnly' ? props.recipientAccountID : props.senderAccountID
  const you = (
    <NameWithIcon
      colorFollowing={true}
      horizontal={true}
      username={props.you}
      metaOne="You"
      metaTwo={yourAccountID ? <SmallAccountID accountID={yourAccountID} /> : null}
    />
  )
  const counterparty = (
    <Counterparty
      accountID={counterpartyAccountID}
      counterparty={props.counterparty}
      counterpartyMeta={props.counterpartyMeta}
      counterpartyType={props.counterpartyType}
    />
  )

  switch (props.yourRole) {
    case 'senderOnly':
      return {sender: you, receiver: counterparty}
    case 'receiverOnly':
      return {sender: counterparty, receiver: you}
    case 'senderAndReceiver':
      // Even if we sent money from an account to itself, show the
      // account details as the recipient.
      return {sender: you, receiver: counterparty}
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove(props.yourRole);
      */
      throw new Error(`Unexpected role ${props.yourRole}`)
  }
}

class TransactionDetails extends React.Component<Props> {
  componentDidMount() {
    this.props.onLoadPaymentDetail()
  }

  render() {
    const {sender, receiver} = propsToParties(this.props)

    return (
      <Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        <Transaction
          amountUser={this.props.amountUser}
          amountXLM={this.props.amountXLM}
          counterparty={this.props.counterparty}
          counterpartyType={this.props.counterpartyType}
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
          {sender}
        </Box2>

        <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Text type="BodySmallSemibold">Recipient:</Text>
          {receiver}
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
