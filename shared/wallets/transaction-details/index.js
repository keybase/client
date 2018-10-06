// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {
  Box2,
  Divider,
  Icon,
  NameWithIcon,
  ProgressIndicator,
  Text,
  WaitingButton,
  WithTooltip,
} from '../../common-adapters'
import {capitalize} from 'lodash-es'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  platformStyles,
  styleSheetCreate,
} from '../../styles'
import Transaction, {CounterpartyIcon, CounterpartyText, TimestampLine} from '../transaction'
import {SmallAccountID} from '../common'

export type NotLoadingProps = {|
  amountUser: string,
  amountXLM: string,
  counterparty: string,
  counterpartyMeta: ?string,
  counterpartyType: Types.CounterpartyType,
  loading: false,
  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string,
  onBack: () => void,
  onCancelPayment: ?() => void,
  onCancelPaymentWaitingKey: string,
  title: string,
  onLoadPaymentDetail: () => void,
  onShowProfile: string => void,
  onViewTransaction?: () => void,
  publicMemo?: string,
  recipientAccountID: ?Types.AccountID,
  selectableText: boolean,
  senderAccountID: Types.AccountID,
  status: Types.StatusSimplified,
  statusDetail: string,
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  transactionID?: string,
  you: string,
  yourRole: Types.Role,
|}
export type Props =
  | NotLoadingProps
  | {|loading: true, onBack: () => void, onLoadPaymentDetail: () => void, title: string|}

type CounterpartyProps = {|
  accountID: ?Types.AccountID,
  counterparty: string,
  counterpartyMeta: ?string,
  counterpartyType: Types.CounterpartyType,
  onShowProfile: string => void,
|}

const Counterparty = (props: CounterpartyProps) => {
  if (props.counterpartyType === 'keybaseUser') {
    return (
      <NameWithIcon
        colorFollowing={true}
        horizontal={true}
        onClick={() => props.onShowProfile(props.counterparty)}
        username={props.counterparty}
        metaOne={props.counterpartyMeta}
        underline={true}
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
        onShowProfile={props.onShowProfile}
      />
      <Box2 direction="vertical" fullWidth={true} style={styles.counterPartyText}>
        <CounterpartyText
          counterparty={props.counterparty}
          counterpartyType={props.counterpartyType}
          large={false}
          onShowProfile={props.onShowProfile}
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

const propsToParties = (props: NotLoadingProps) => {
  const yourAccountID = props.yourRole === 'senderOnly' ? props.senderAccountID : props.recipientAccountID
  const counterpartyAccountID =
    props.yourRole === 'senderOnly' ? props.recipientAccountID : props.senderAccountID
  const you = (
    <NameWithIcon
      colorFollowing={true}
      horizontal={true}
      onClick={() => props.onShowProfile(props.you)}
      underline={true}
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
      onShowProfile={props.onShowProfile}
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

const TransactionDetails = (props: NotLoadingProps) => {
  const {sender, receiver} = propsToParties(props)
  return (
    <Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
      <Transaction
        amountUser={props.amountUser}
        amountXLM={props.amountXLM}
        counterparty={props.counterparty}
        counterpartyType={props.counterpartyType}
        large={true}
        memo={props.memo}
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onShowProfile={props.onShowProfile}
        readState="read"
        selectableText={true}
        status={props.status}
        statusDetail={props.statusDetail}
        timestamp={props.timestamp}
        yourRole={props.yourRole}
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
        <WithTooltip
          containerStyle={styles.statusBox}
          text={
            props.status === 'cancelable'
              ? `${
                  props.counterparty
                } hasn't generated a Stellar account yet. This payment will automatically complete when they create one.`
              : ''
          }
          textStyle={styles.tooltipText}
          multiline={true}
        >
          <Icon
            color={colorForStatus(props.status)}
            fontSize={16}
            type={
              props.status === 'error'
                ? 'iconfont-close'
                : props.status === 'completed'
                  ? 'iconfont-success'
                  : 'icon-transaction-pending-16'
            }
          />
          <Text
            style={collapseStyles([
              styles.statusText,
              {color: colorForStatus(props.status), marginLeft: globalMargins.xtiny},
            ])}
            type="Body"
          >
            {descriptionForStatus(props.status, props.yourRole)}
          </Text>
        </WithTooltip>
        {props.status !== 'error' && (
          <TimestampLine
            error={props.status === 'error' ? props.statusDetail : ''}
            selectableText={true}
            timestamp={props.timestamp}
          />
        )}
        {props.onCancelPayment && (
          <WaitingButton
            waitingKey={props.onCancelPaymentWaitingKey}
            type="Danger"
            label="Cancel"
            onClick={props.onCancelPayment}
            small={true}
            style={{alignSelf: 'flex-start'}}
          />
        )}
      </Box2>

      <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
        <Text type="BodySmallSemibold">Public memo:</Text>
        <Text selectable={true} type="Body">
          {props.publicMemo}
        </Text>
      </Box2>

      <Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
        <Text type="BodySmallSemibold">Transaction ID:</Text>
        <Text selectable={true} type="Body">
          {props.transactionID}
        </Text>
        {props.onViewTransaction && (
          <Text onClick={props.onViewTransaction} type="BodySmallPrimaryLink">
            View transaction
          </Text>
        )}
      </Box2>
    </Box2>
  )
}

class LoadTransactionDetails extends React.Component<Props> {
  componentDidMount() {
    this.props.onLoadPaymentDetail()
  }
  render() {
    if (this.props.loading) {
      return (
        <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
          <ProgressIndicator style={styles.progressIndicator} />
        </Box2>
      )
    }
    const props: NotLoadingProps = this.props
    return <TransactionDetails {...props} />
  }
}

export default LoadTransactionDetails

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.small,
  },
  counterPartyText: {
    justifyContent: 'center',
    marginLeft: globalMargins.tiny,
  },
  progressIndicator: {height: 50, width: 50},
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
  statusBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  statusText: {
    marginLeft: globalMargins.xtiny,
  },
  tooltipText: platformStyles({
    isElectron: {
      wordBreak: 'break-work',
    },
  }),
})
