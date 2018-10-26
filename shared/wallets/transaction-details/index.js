// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {capitalize} from 'lodash-es'
import Transaction, {TimestampLine} from '../transaction'
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
  // onChat and onShowProfile are used only when counterpartyType ===
  // 'keybaseUser'.
  onChat: string => void,
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
  // sending wallet to wallet we show the actual wallet and not your username
  yourAccountName: string,
|}
export type Props =
  | NotLoadingProps
  | {|loading: true, onBack: () => void, onLoadPaymentDetail: () => void, title: string|}

type CounterpartyIconProps = {|
  onShowProfile: string => void,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
|}

export const CounterpartyIcon = (props: CounterpartyIconProps) => {
  const size = 32
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return (
        <Kb.Avatar
          onClick={() => props.onShowProfile(props.counterparty)}
          username={props.counterparty}
          size={size}
        />
      )
    case 'stellarPublicKey':
      return <Kb.Icon type="icon-placeholder-secret-user-32" style={{height: size, width: size}} />
    case 'otherAccount':
      return <Kb.Icon type="icon-wallet-32" style={{height: size, width: size}} />
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (counterpartyType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.counterpartyType);
      */
      return null
  }
}

type CounterpartyTextProps = {|
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  onShowProfile: string => void,
|}

export const CounterpartyText = (props: CounterpartyTextProps) => {
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return (
        <Kb.ConnectedUsernames
          colorFollowing={true}
          colorBroken={true}
          inline={true}
          onUsernameClicked={props.onShowProfile}
          type="BodySmallSemibold"
          underline={true}
          usernames={[props.counterparty]}
        />
      )
    case 'stellarPublicKey':
      return (
        <Kb.Text type="BodySemibold" selectable={true} title={props.counterparty}>
          {props.counterparty}
        </Kb.Text>
      )
    case 'otherAccount':
      return <Kb.Text type="BodySemibold">{props.counterparty}</Kb.Text>
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (counterpartyType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.counterpartyType);
      */
      break
  }
  return null
}

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
      <Kb.NameWithIcon
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
    <Kb.Box2 direction="horizontal" fullHeight={true}>
      <CounterpartyIcon
        counterparty={props.counterparty}
        counterpartyType={props.counterpartyType}
        onShowProfile={props.onShowProfile}
      />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.counterPartyText}>
        <CounterpartyText
          counterparty={props.counterparty}
          counterpartyType={props.counterpartyType}
          onShowProfile={props.onShowProfile}
        />
        {props.counterpartyType !== 'stellarPublicKey' &&
          props.accountID && <SmallAccountID accountID={props.accountID} />}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const YourAccount = props => {
  const yourAccountID = props.yourRole === 'senderOnly' ? props.senderAccountID : props.recipientAccountID
  return props.counterpartyType === 'otherAccount' && props.yourAccountName ? (
    <Counterparty
      counterpartyType={props.counterpartyType}
      counterparty={props.yourAccountName}
      accountID={yourAccountID}
      onShowProfile={() => {}}
      counterpartyMeta=""
    />
  ) : (
    <Kb.NameWithIcon
      colorFollowing={true}
      horizontal={true}
      onClick={() => props.onShowProfile(props.you)}
      underline={true}
      username={props.you}
      metaOne="You"
      metaTwo={yourAccountID ? <SmallAccountID accountID={yourAccountID} /> : null}
    />
  )
}

const colorForStatus = (status: Types.StatusSimplified) => {
  switch (status) {
    case 'completed':
      return Styles.globalColors.green
    case 'pending':
    case 'cancelable':
      return Styles.globalColors.purple2
    case 'error':
    case 'canceled':
      return Styles.globalColors.red
    default:
      return Styles.globalColors.black
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
  let counterpartyAccountID =
    props.yourRole === 'senderOnly' ? props.recipientAccountID : props.senderAccountID
  if (props.status === 'canceled') {
    // Canceled relay, recipient might not have accountID. Don't show.
    counterpartyAccountID = null
  }
  const you = <YourAccount {...props} />

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
    <Kb.ScrollView style={styles.scrollView}>
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        <Transaction
          amountUser={props.amountUser}
          amountXLM={props.amountXLM}
          counterparty={props.counterparty}
          counterpartyType={props.counterpartyType}
          memo={props.memo}
          onCancelPayment={null}
          onCancelPaymentWaitingKey=""
          onChat={props.onChat}
          onShowProfile={props.onShowProfile}
          // Don't render unread state in detail view.
          readState="read"
          selectableText={true}
          status={props.status}
          statusDetail={props.statusDetail}
          timestamp={props.timestamp}
          yourRole={props.yourRole}
        />
        <Kb.Divider />

        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Sender:</Kb.Text>
          {sender}
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Recipient:</Kb.Text>
          {receiver}
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Status:</Kb.Text>
          <Kb.WithTooltip
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
            <Kb.Icon
              color={colorForStatus(props.status)}
              fontSize={16}
              type={
                ['error', 'canceled'].includes(props.status)
                  ? 'iconfont-close'
                  : props.status === 'completed'
                    ? 'iconfont-success'
                    : 'iconfont-clock'
              }
            />
            <Kb.Text
              style={Styles.collapseStyles([
                styles.statusText,
                {color: colorForStatus(props.status), marginLeft: Styles.globalMargins.xtiny},
              ])}
              type="Body"
            >
              {descriptionForStatus(props.status, props.yourRole)}
            </Kb.Text>
          </Kb.WithTooltip>
          {props.status !== 'error' && (
            <TimestampLine
              error={props.status === 'error' ? props.statusDetail : ''}
              selectableText={true}
              timestamp={props.timestamp}
            />
          )}
          {props.onCancelPayment && (
            <Kb.WaitingButton
              waitingKey={props.onCancelPaymentWaitingKey}
              type="Danger"
              label="Cancel"
              onClick={props.onCancelPayment}
              small={true}
              style={{alignSelf: 'flex-start'}}
            />
          )}
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Public memo:</Kb.Text>
          <Kb.Text selectable={true} type="Body">
            {props.publicMemo}
          </Kb.Text>
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Transaction ID:</Kb.Text>
          <Kb.Text selectable={true} type="Body">
            {props.transactionID}
          </Kb.Text>
          {props.onViewTransaction && (
            <Kb.Text onClick={props.onViewTransaction} type="BodySmallPrimaryLink">
              View transaction
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

class LoadTransactionDetails extends React.Component<Props> {
  componentDidMount() {
    this.props.onLoadPaymentDetail()
  }
  render() {
    if (this.props.loading) {
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.ProgressIndicator style={styles.progressIndicator} />
        </Kb.Box2>
      )
    }
    const props: NotLoadingProps = this.props
    return <TransactionDetails {...props} />
  }
}

export default LoadTransactionDetails

const styles = Styles.styleSheetCreate({
  container: {
    padding: Styles.globalMargins.small,
  },
  counterPartyText: {
    justifyContent: 'center',
    marginLeft: Styles.globalMargins.tiny,
  },
  progressIndicator: {height: 50, width: 50},
  rightContainer: {
    flex: 1,
    marginLeft: Styles.globalMargins.tiny,
  },
  scrollView: {
    height: '100%',
    width: '100%',
  },
  statusBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  statusText: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  tooltipText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-work',
    },
  }),
})
