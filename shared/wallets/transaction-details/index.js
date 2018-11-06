// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {capitalize} from 'lodash-es'
import Transaction, {TimestampError, TimestampPending} from '../transaction'
import {SmallAccountID} from '../common'
import {formatTimeForStellarDetail, formatTimeForStellarTooltip} from '../../util/timestamp'

export type NotLoadingProps = {|
  amountUser: string,
  amountXLM: string,
  counterparty: string,
  // counterpartyMeta is used only when counterpartyType === 'keybaseUser'.
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
  // onChat is used only when counterpartyType === 'keybaseUser'.
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

type PartyAccountProps = {|
  accountID: ?Types.AccountID,
  accountName: string,
|}

const PartyAccount = (props: PartyAccountProps) => {
  return (
    <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
      <Kb.Icon type="icon-wallet-32" style={{height: 32, width: 32}} />
      <Kb.Box2 direction="vertical">
        <Kb.Text type="BodySemibold">{props.accountName}</Kb.Text>
        {props.accountID && <SmallAccountID accountID={props.accountID} />}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type CounterpartyProps = {|
  accountID: ?Types.AccountID,
  counterparty: string,
  // counterpartyMeta is used only when counterpartyType ===  'keybaseUser'.
  counterpartyMeta: ?string,
  counterpartyType: Types.CounterpartyType,
  // onChat and onShowProfile are used only when counterpartyType ===
  // 'keybaseUser'.
  onChat: string => void,
  onShowProfile: string => void,
|}

const Counterparty = (props: CounterpartyProps) => {
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.NameWithIcon
            colorFollowing={true}
            horizontal={true}
            onClick={() => props.onShowProfile(props.counterparty)}
            username={props.counterparty}
            metaOne={props.counterpartyMeta}
            underline={true}
            metaTwo={props.accountID && <SmallAccountID accountID={props.accountID} />}
          />
          <Kb.Button
            type="Secondary"
            label="Chat"
            small={true}
            style={styles.chatButton}
            onClick={() => props.onChat(props.counterparty)}
          />
        </Kb.Box2>
      )
    case 'stellarPublicKey':
      return (
        <Kb.Box2 direction="horizontal">
          <Kb.Icon type="icon-placeholder-secret-user-32" style={{height: 32, width: 32}} />
          <Kb.Box2 direction="vertical" style={styles.counterpartyText}>
            <Kb.Text type="BodySemibold" selectable={true} title={props.counterparty}>
              {props.counterparty}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      )
    case 'otherAccount':
      return <PartyAccount accountID={props.accountID} accountName={props.counterparty} />
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (counterpartyType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.counterpartyType);
      */
      break
  }
  return null
}

type YourAccountProps = {|
  accountID: ?Types.AccountID,
  accountName: ?string,
  you: string,
  onShowProfile: string => void,
|}

const YourAccount = (props: YourAccountProps) => {
  if (props.accountName) {
    return <PartyAccount accountID={props.accountID} accountName={props.accountName} />
  }
  return (
    <Kb.NameWithIcon
      colorFollowing={true}
      horizontal={true}
      onClick={() => props.onShowProfile(props.you)}
      underline={true}
      username={props.you}
      metaOne="You"
      metaTwo={props.accountID ? <SmallAccountID accountID={props.accountID} /> : null}
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
  const yourAccountID = props.yourRole === 'senderOnly' ? props.senderAccountID : props.recipientAccountID
  const yourAccountName = props.counterpartyType === 'otherAccount' ? props.yourAccountName : null
  const you = (
    <YourAccount
      accountID={yourAccountID}
      accountName={yourAccountName}
      you={props.you}
      onShowProfile={props.onShowProfile}
    />
  )

  let counterpartyAccountID =
    props.yourRole === 'senderOnly' ? props.recipientAccountID : props.senderAccountID
  if (props.status === 'canceled') {
    // Canceled relay, recipient might not have accountID. Don't show.
    counterpartyAccountID = null
  }

  const counterparty = (
    <Counterparty
      accountID={counterpartyAccountID}
      counterparty={props.counterparty}
      counterpartyMeta={props.counterpartyMeta}
      counterpartyType={props.counterpartyType}
      onChat={props.onChat}
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

type TimestampLineProps = {|
  error: string,
  timestamp: ?Date,
  selectableText: boolean,
|}

export const TimestampLine = (props: TimestampLineProps) => {
  if (props.error) {
    return <TimestampError error={props.error} />
  }
  const timestamp = props.timestamp
  if (!timestamp) {
    return <TimestampPending />
  }
  const human = formatTimeForStellarDetail(timestamp)
  const tooltip = formatTimeForStellarTooltip(timestamp)
  return (
    <Kb.Text selectable={props.selectableText} title={tooltip} type="BodySmall">
      {human}
    </Kb.Text>
  )
}

const TransactionDetails = (props: NotLoadingProps) => {
  const {sender, receiver} = propsToParties(props)
  return (
    <Kb.ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContainer}>
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} fullHeight={true} style={styles.container}>
        <Transaction
          amountUser={props.amountUser}
          amountXLM={props.amountXLM}
          counterparty={props.counterparty}
          counterpartyType={props.counterpartyType}
          detailView={true}
          memo={props.memo}
          onCancelPayment={null}
          onCancelPaymentWaitingKey=""
          onShowProfile={props.onShowProfile} // Don't render unread state in detail view.
          readState="read"
          selectableText={true}
          status={props.status}
          statusDetail={props.statusDetail}
          timestamp={props.timestamp}
          unread={false}
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
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Public memo:</Kb.Text>
          <Kb.Text selectable={true} type="Body">
            {props.publicMemo}
          </Kb.Text>
          {!!props.publicMemo &&
            props.yourRole === 'receiverOnly' &&
            props.counterpartyType === 'stellarPublicKey' && (
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.warningBannerContainer}>
                <Kb.Text type="BodySemibold" backgroundMode="Information">
                  Watch out for phishing attacks and dangerous websites.
                </Kb.Text>
              </Kb.Box2>
            )}
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
        {props.onCancelPayment && (
          <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true} style={styles.buttonBox}>
            <Kb.WaitingButton
              waitingKey={props.onCancelPaymentWaitingKey}
              type="Danger"
              label="Cancel transaction"
              onClick={props.onCancelPayment}
              small={true}
              style={styles.button}
            />
          </Kb.Box2>
        )}
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
  button: {
    alignSelf: 'center',
  },
  buttonBox: Styles.platformStyles({
    common: {
      justifyContent: 'center',
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      minHeight: 0,
    },
    isElectron: {
      marginTop: 'auto',
    },
    isMobile: {
      marginTop: Styles.globalMargins.medium,
    },
  }),
  chatButton: {
    alignSelf: 'flex-start',
    marginTop: Styles.globalMargins.tiny,
  },
  container: {
    alignSelf: 'flex-start',
    padding: Styles.globalMargins.small,
  },
  counterpartyText: {
    justifyContent: 'center',
    marginLeft: Styles.globalMargins.tiny,
  },
  progressIndicator: {height: 50, width: 50},
  rightContainer: {
    flex: 1,
    marginLeft: Styles.globalMargins.tiny,
  },
  scrollView: {
    display: 'flex',
    flexGrow: 1,
    width: '100%',
  },
  scrollViewContainer: {
    flexGrow: 1,
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
  warningBannerContainer: {
    backgroundColor: Styles.backgroundModeToColor.Information,
    borderRadius: 4,
    padding: Styles.globalMargins.xsmall,
  },
})
