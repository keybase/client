import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RPCTypes from '../../constants/types/rpc-stellar-gen'
import {capitalize} from 'lodash-es'
import {Transaction, TimestampError, TimestampPending} from '../transaction'
import {SmallAccountID} from '../common'
import {formatTimeForStellarDetail, formatTimeForStellarTooltip} from '../../util/timestamp'
import PaymentPath, {Asset} from './payment-path'

export type NotLoadingProps = {
  amountUser: string
  amountXLM: string
  approxWorth: string
  assetCode: string
  counterparty: string
  // counterpartyMeta is used only when counterpartyType === 'keybaseUser'.
  counterpartyMeta: string | null
  counterpartyType: Types.CounterpartyType
  feeChargedDescription: string
  fromAirdrop: boolean
  // issuer, for non-xlm assets
  issuerDescription: string
  issuerAccountID: Types.AccountID | null
  loading: false
  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string
  onBack: () => void
  onCancelPayment: (() => void) | null
  onCancelPaymentWaitingKey: string
  // onChat is used only when counterpartyType === 'keybaseUser'.
  onChat: (username: string) => void
  onLoadPaymentDetail: () => void
  onShowProfile: (username: string) => void
  onViewTransaction?: () => void
  operations?: Array<string>
  pathIntermediate: Asset[]
  publicMemo?: string
  recipientAccountID: Types.AccountID | null
  selectableText: boolean
  senderAccountID: Types.AccountID
  sourceAmount: string
  sourceAsset: string
  sourceConvRate: string
  sourceIssuer: string
  sourceIssuerAccountID: string
  status: Types.StatusSimplified
  statusDetail: string
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null
  title: string
  transactionID?: string
  you: string
  yourRole: Types.Role
  // sending wallet to wallet we show the actual wallet and not your username
  yourAccountName: string
  trustline?: RPCTypes.PaymentTrustlineLocal
  isAdvanced: boolean
  summaryAdvanced?: string
}
export type Props =
  | NotLoadingProps
  | {
      loading: true
      onBack: () => void
      onLoadPaymentDetail: () => void
      title: string
    }

type PartyAccountProps = {
  accountID: Types.AccountID | null
  accountName: string
}

interface ConvertedCurrencyLabelProps {
  amount: string | number
  assetCode: string
  issuerDescription: string
}

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

type CounterpartyProps = {
  accountID: Types.AccountID | null
  counterparty: string
  // counterpartyMeta is used only when counterpartyType ===  'keybaseUser'.
  counterpartyMeta: string | null
  counterpartyType: Types.CounterpartyType
  // onChat and onShowProfile are used only when counterpartyType ===
  // 'keybaseUser'.
  onChat: (username: string) => void
  onShowProfile: (username: string) => void
}

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
            label="Chat"
            mode="Secondary"
            small={true}
            style={styles.chatButton}
            onClick={() => props.onChat(props.counterparty)}
          />
        </Kb.Box2>
      )
    case 'stellarPublicKey':
      return (
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
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
      throw new Error(`unknown counterpartyType: ${props}`)
  }
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

type YourAccountProps = {
  accountID: Types.AccountID | null
  accountName: string | null
  you: string
  onShowProfile: (username: string) => void
}

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
      return Styles.globalColors.greenDark
    case 'pending':
    case 'claimable':
      return Styles.globalColors.purple
    case 'error':
    case 'canceled':
      return Styles.globalColors.redDark
    default:
      return Styles.globalColors.black
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
        case 'airdrop':
        case 'receiverOnly':
          return 'Received'
        case 'senderAndReceiver':
          return 'Sent'
        case 'none':
          return 'Done'
        default:
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

  const counterparty = props.counterparty ? (
    <Counterparty
      accountID={counterpartyAccountID}
      counterparty={props.counterparty}
      counterpartyMeta={props.counterpartyMeta}
      counterpartyType={props.counterpartyType}
      onChat={props.onChat}
      onShowProfile={props.onShowProfile}
    />
  ) : null

  switch (props.yourRole) {
    case 'airdrop':
      return {receiver: you, sender: counterparty}
    case 'senderOnly':
      return {receiver: counterparty, sender: you}
    case 'receiverOnly':
      return {receiver: you, sender: counterparty}
    case 'senderAndReceiver':
      // Even if we sent money from an account to itself, show the
      // account details as the recipient.
      return {receiver: counterparty, sender: you}
    case 'none':
      return {receiver: null, sender: null}
    default:
      throw new Error(`Unexpected role ${props.yourRole}`)
  }
}

type TimestampLineProps = {
  error: string
  timestamp: Date | null
  selectableText: boolean
}

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

const ConvertedCurrencyLabel = (props: ConvertedCurrencyLabelProps) => (
  <Kb.Box2 direction="vertical" noShrink={true}>
    <Kb.Text type="BodyBigExtrabold">
      {props.amount} {props.assetCode || 'XLM'}
    </Kb.Text>
    <Kb.Text type="BodySmall">/{props.issuerDescription}</Kb.Text>
  </Kb.Box2>
)

const TransactionDetails = (props: NotLoadingProps) => {
  const {sender, receiver} = propsToParties(props)

  const hasNontrivialPath =
    !!props.sourceAmount &&
    props.assetCode !== props.sourceAsset &&
    props.issuerAccountID !== props.sourceIssuerAccountID &&
    props.issuerDescription !== props.sourceIssuer

  // If we don't have a sourceAsset, the source is native Lumens
  const sourceIssuer =
    props.sourceAsset === ''
      ? 'Stellar Lumens'
      : props.sourceIssuer ||
        (props.sourceIssuerAccountID === Types.noAccountID
          ? 'Unknown issuer'
          : Constants.shortenAccountID(props.sourceIssuerAccountID))
  const {issuerAccountID} = props
  const destinationIssuer =
    props.assetCode === ''
      ? 'Stellar Lumens'
      : props.issuerDescription ||
        // TODO is this ok?
        (issuerAccountID === Types.noAccountID || !issuerAccountID
          ? 'Unknown issuer'
          : Constants.shortenAccountID(issuerAccountID))

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
          fromAirdrop={props.fromAirdrop}
          detailView={true}
          memo={props.memo}
          onCancelPayment={undefined}
          onCancelPaymentWaitingKey=""
          onShowProfile={props.onShowProfile} // Don't render unread state in detail view.
          readState="read"
          selectableText={true}
          sourceAmount={props.sourceAmount}
          sourceAsset={props.sourceAsset}
          status={props.status}
          statusDetail={props.statusDetail}
          timestamp={props.timestamp}
          unread={false}
          yourRole={props.yourRole}
          issuerDescription={props.issuerDescription}
          isAdvanced={props.isAdvanced}
          summaryAdvanced={props.summaryAdvanced}
          trustline={props.trustline}
        />
      </Kb.Box2>
      <Kb.Divider />
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.container}>
        {hasNontrivialPath && (
          <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">Payment path:</Kb.Text>
            <PaymentPath
              sourceAmount={`${props.sourceAmount} ${props.sourceAsset || 'XLM'}`}
              sourceIssuer={sourceIssuer}
              pathIntermediate={props.pathIntermediate}
              destinationIssuer={destinationIssuer}
              destinationAmount={props.amountXLM}
            />
          </Kb.Box2>
        )}

        {hasNontrivialPath && (
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">Conversion rate:</Kb.Text>
            <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
              <ConvertedCurrencyLabel
                amount={1}
                assetCode={props.sourceAsset}
                issuerDescription={sourceIssuer}
              />
              <Kb.Box2
                direction="horizontal"
                alignSelf="flex-start"
                centerChildren={true}
                style={styles.equals}
              >
                <Kb.Text type="BodyBig">=</Kb.Text>
              </Kb.Box2>
              <ConvertedCurrencyLabel
                amount={props.sourceConvRate}
                assetCode={props.assetCode}
                issuerDescription={destinationIssuer}
              />
            </Kb.Box2>
          </Kb.Box2>
        )}

        {!!sender && (
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">Sender:</Kb.Text>
            {sender}
          </Kb.Box2>
        )}

        {!!receiver && (
          <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">Recipient:</Kb.Text>
            {receiver}
          </Kb.Box2>
        )}

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

        {props.operations && props.operations.length && !(props.trustline && props.operations.length <= 1) && (
          <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">Operations:</Kb.Text>
            {props.operations.map((op, i) => (
              <Kb.Text key={i} selectable={true} style={styles.operation} type="Body">
                {i + 1}. {op}
              </Kb.Text>
            ))}
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
              sizeType="Small"
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
            <TimestampLine error="" selectableText={true} timestamp={props.timestamp} />
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
                <Kb.Text type="BodySmallSemibold" style={styles.warningBannerText}>
                  Watch out for phishing attacks and dangerous websites.
                </Kb.Text>
              </Kb.Box2>
            )}
        </Kb.Box2>

        <Kb.Box2 direction="vertical" gap="xxtiny" fullWidth={true}>
          <Kb.Text type="BodySmallSemibold">Fee:</Kb.Text>
          <Kb.Text selectable={true} type="Body">
            {props.feeChargedDescription}
          </Kb.Text>
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
              mode="Secondary"
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

function isNotLoadingProps(props: Props): props is NotLoadingProps {
  return !props.loading
}

class LoadTransactionDetails extends React.Component<Props> {
  componentDidMount() {
    this.props.onLoadPaymentDetail()
  }
  componentDidUpdate(prevProps: Props) {
    // An erased transaction ID likely means the payment was updated,
    // which means details need to be retrieved again
    if (!isNotLoadingProps(this.props) || !isNotLoadingProps(prevProps)) {
      return
    }
    const props = this.props
    const prev = prevProps
    if (
      (!props.transactionID || !props.senderAccountID) &&
      prev.transactionID &&
      prev.senderAccountID &&
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
    const props = this.props as NotLoadingProps
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
  equals: Styles.platformStyles({isMobile: {flex: 1}}),
  flexOne: {flex: 1},
  icon32: {height: 32, width: 32},
  operation: Styles.platformStyles({isElectron: {wordBreak: 'break-all'}}),
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
      wordBreak: 'break-word',
    },
  }),
  transactionID: Styles.platformStyles({isElectron: {wordBreak: 'break-all'}}),
  warningBannerContainer: {
    backgroundColor: Styles.backgroundModeToColor.Information,
    borderRadius: Styles.borderRadius,
    marginTop: Styles.globalMargins.xtiny,
    padding: Styles.globalMargins.tiny,
  },
  warningBannerText: {
    color: Styles.globalColors.brown_75,
  },
})
