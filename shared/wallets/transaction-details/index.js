// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as Flow from '../../util/flow'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {capitalize} from 'lodash-es'
import Transaction, {TimestampError, TimestampPending} from '../transaction'
import {SmallAccountID} from '../common'
import {formatTimeForStellarDetail, formatTimeForStellarTooltip} from '../../util/timestamp'

export type NotLoadingProps = {|
  amountUser: string,
  amountXLM: string,
  approxWorth: string,
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
  // issuer, for non-xlm assets
  issuerDescription: string,
  issuerAccountID: ?Types.AccountID,
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
    <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.partyAccountContainer}>
      <Kb.Icon type="icon-wallet-32" style={styles.icon32} />
      <Kb.Box2 direction="vertical" style={styles.flexOne}>
        <Kb.Text type="BodySemibold">{props.accountName}</Kb.Text>
        {!!props.accountID && <SmallAccountID accountID={props.accountID} />}
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
            metaOne={<AccountMeta counterpartyMeta={props.counterpartyMeta} accountID={props.accountID} />}
            metaStyle={styles.flexOne}
            containerStyle={styles.alignItemsFlexStart}
            underline={true}
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
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.Icon type="icon-placeholder-secret-user-32" style={styles.icon32} />
          <Kb.Text
            type="BodySemibold"
            selectable={true}
            style={styles.stellarPublicKey}
            title={props.counterparty}
          >
            {props.counterparty}
          </Kb.Text>
        </Kb.Box2>
      )
    case 'otherAccount':
      return <PartyAccount accountID={props.accountID} accountName={props.counterparty} />
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.counterpartyType)
      break
  }
  return null
}

const AccountMeta = ({counterpartyMeta, accountID}) => (
  <Kb.Box2 direction="horizontal" style={{flexWrap: 'wrap'}}>
    {!!counterpartyMeta && (
      <Kb.Text type="BodySmall">
        {counterpartyMeta}
        {!!accountID && ' ·'}
        &nbsp;
      </Kb.Text>
    )}
    {!!accountID && <SmallAccountID accountID={accountID} />}
  </Kb.Box2>
)

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
      metaOne={<AccountMeta counterpartyMeta="You" accountID={props.accountID} />}
      metaStyle={styles.flexOne}
      containerStyle={styles.alignItemsFlexStart}
    />
  )
}

const colorForStatus = (status: Types.StatusSimplified) => {
  switch (status) {
    case 'completed':
      return Styles.globalColors.green
    case 'pending':
    case 'claimable':
      return Styles.globalColors.purple2
    case 'error':
    case 'canceled':
      return Styles.globalColors.red
    default:
      return Styles.globalColors.black_75
  }
}

const descriptionForStatus = (status: Types.StatusSimplified, yourRole: Types.Role) => {
  switch (status) {
    case 'claimable':
      return 'Cancelable'
    case 'completed':
      switch (yourRole) {
        case 'senderOnly':
          return 'Sent'
        case 'receiverOnly':
          return 'Received'
        case 'senderAndReceiver':
          return 'Sent'
        default:
          Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(yourRole)
          throw new Error(`Unexpected role ${yourRole}`)
      }
    case 'error':
      return 'Failed'
    default:
      return capitalize(status)
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
      return {receiver: counterparty, sender: you}
    case 'receiverOnly':
      return {receiver: you, sender: counterparty}
    case 'senderAndReceiver':
      // Even if we sent money from an account to itself, show the
      // account details as the recipient.
      return {receiver: counterparty, sender: you}
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.yourRole)
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
      <Kb.Divider />
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        <Transaction
          approxWorth={props.approxWorth}
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
          issuerDescription={props.issuerDescription}
        />
      </Kb.Box2>
      <Kb.Divider />
      <Kb.Box2
        direction="vertical"
        gap="small"
        fullWidth={true}
        style={Styles.collapseStyles([styles.container, styles.flexOne])}
      >
        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Sender:</Kb.Text>
          {sender}
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Recipient:</Kb.Text>
          {receiver}
        </Kb.Box2>

        {props.issuerAccountID && (
          <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">Asset issuer:</Kb.Text>
            <Kb.Text selectable={true} style={styles.transactionID} type="BodySemibold">
              {props.issuerDescription}
            </Kb.Text>
            <Kb.Text selectable={true} style={styles.transactionID} type="Body">
              {props.issuerAccountID}
            </Kb.Text>
          </Kb.Box2>
        )}

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Status:</Kb.Text>
          <Kb.WithTooltip
            containerStyle={styles.statusBox}
            text={
              props.status === 'claimable'
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
              style={Kb.iconCastPlatformStyles(styles.statusIcon)}
              type={
                ['error', 'canceled'].includes(props.status)
                  ? 'iconfont-remove'
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
          {props.status === 'error' && (
            <Kb.Text type="BodySmallError" selectable={true}>
              {props.statusDetail}
            </Kb.Text>
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
                <Kb.Text
                  type="BodySmallSemibold"
                  backgroundMode="Information"
                  style={styles.warningBannerText}
                >
                  Watch out for phishing attacks and dangerous websites.
                </Kb.Text>
              </Kb.Box2>
            )}
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Transaction ID:</Kb.Text>
          <Kb.Text selectable={true} style={styles.transactionID} type="Body">
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
  componentDidUpdate(prevProps: Props) {
    // An erased transaction ID likely means the payment was updated,
    // which means details need to be retrieved again
    if (
      (!this.props.transactionID || !this.props.senderAccountID) &&
      prevProps.transactionID &&
      prevProps.senderAccountID &&
      !this.props.loading
    ) {
      this.props.onLoadPaymentDetail()
    }
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
  alignItemsFlexStart: {alignItems: 'flex-start'},
  button: {
    alignSelf: 'center',
  },
  buttonBox: Styles.platformStyles({
    common: {
      justifyContent: 'center',
      minHeight: 0,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
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
  flexOne: {flex: 1},
  icon32: {height: 32, width: 32},
  partyAccountContainer: {
    alignSelf: 'flex-start',
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
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
  },
  statusBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  statusIcon: {
    position: 'relative',
    top: 1,
  },
  statusText: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  stellarPublicKey: Styles.platformStyles({
    common: {
      flex: 1,
      justifyContent: 'center',
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {wordBreak: 'break-all'},
  }),
  tooltipText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-work',
    },
  }),
  transactionID: Styles.platformStyles({isElectron: {wordBreak: 'break-all'}}),
  warningBannerContainer: {
    backgroundColor: Styles.backgroundModeToColor.Information,
    marginTop: Styles.globalMargins.xsmall,
    padding: Styles.globalMargins.xsmall,
  },
  warningBannerText: {
    color: Styles.globalColors.brown_75,
  },
})
