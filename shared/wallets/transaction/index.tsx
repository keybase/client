import type * as Types from '../../constants/types/wallets'
import type * as RPCTypes from '../../constants/types/rpc-stellar-gen'
import * as Constants from '../../constants/wallets'
import capitalize from 'lodash/capitalize'
import {
  Avatar,
  Box2,
  ClickableBox,
  Icon,
  ConnectedUsernames,
  Text,
  WaitingButton,
} from '../../common-adapters'
import * as Styles from '../../styles'
import {formatTimeForMessages, formatTimeForStellarTooltip} from '../../util/timestamp'
import {MarkdownMemo} from '../common'

type CounterpartyIconProps = {
  detailView?: boolean
  large: boolean
  onShowProfile: (username: string) => void
  counterparty: string
  counterpartyType: Types.CounterpartyType
}

const CounterpartyIcon = (props: CounterpartyIconProps) => {
  const size = props.large ? 48 : 32
  if (!props.counterparty && props.counterpartyType !== 'airdrop') {
    return <Icon type="iconfont-identity-stellar" fontSize={size} />
  }
  switch (props.counterpartyType) {
    case 'airdrop':
      return <Icon type="icon-airdrop-logo-48" style={{height: size, width: size}} />
    case 'keybaseUser':
      return (
        <Avatar
          onClick={() => props.onShowProfile(props.counterparty)}
          username={props.counterparty}
          size={size}
        />
      )
    case 'stellarPublicKey':
      return <Icon type="icon-placeholder-secret-user-48" style={{height: 48, width: 48}} />
    case 'otherAccount':
      return (
        <Box2
          alignSelf="flex-start"
          direction="horizontal"
          style={Styles.collapseStyles([styles.transferIconContainer, {width: size}])}
        >
          <Icon
            color={Styles.globalColors.purple}
            sizeType={props.detailView ? 'Bigger' : 'Big'}
            style={Styles.collapseStyles([!props.detailView && styles.transferIcon])}
            type="iconfont-wallet-transfer"
          />
        </Box2>
      )
    default:
      throw new Error(`Unexpected counterpartyType ${props.counterpartyType}`)
  }
}

type CounterpartyTextProps = {
  counterparty: string
  counterpartyType: Types.CounterpartyType
  onShowProfile: (username: string) => void
  textType: 'Body' | 'BodySmall'
  textTypeBold: 'BodyBold' | 'BodySmallBold'
  textTypeItalic: 'BodyItalic' | 'BodySmallItalic'
  textTypeSemibold: 'BodySemibold' | 'BodySmallSemibold'
}

export const CounterpartyText = (props: CounterpartyTextProps) => {
  switch (props.counterpartyType) {
    case 'airdrop':
      return (
        <Text style={{color: Styles.globalColors.purpleDark}} type={props.textTypeSemibold}>
          Stellar airdrop
        </Text>
      )
    case 'keybaseUser':
      return (
        <ConnectedUsernames
          colorFollowing={true}
          colorBroken={true}
          inline={true}
          onUsernameClicked={props.onShowProfile}
          type={props.textTypeBold}
          underline={true}
          usernames={props.counterparty}
        />
      )
    case 'stellarPublicKey': {
      const key = props.counterparty
      return (
        <Text type={props.textType} selectable={false} title={key}>
          {key.substr(0, 6) + '...' + key.substr(-5)}
        </Text>
      )
    }
    case 'otherAccount':
      return <Text type={props.textTypeItalic}>{props.counterparty}</Text>
    default:
      throw new Error(`Unexpected counterpartyType ${props.counterpartyType}`)
  }
}

type DetailProps = {
  amountUser: string
  approxWorth: string
  canceled: boolean
  counterparty: string
  counterpartyType: Types.CounterpartyType
  detailView: boolean
  fromAirdrop: boolean
  isAdvanced: boolean
  isXLM: boolean
  issuerDescription: string
  large: boolean
  onShowProfile: (username: string) => void
  pending: boolean
  selectableText: boolean
  sourceAmount: string
  sourceAsset: string
  status: string
  summaryAdvanced?: string
  trustline?: RPCTypes.PaymentTrustlineLocal
  yourRole: Types.Role
}

const Detail = (props: DetailProps) => {
  const textType = props.large ? 'Body' : 'BodySmall'
  const textStyle = props.canceled || props.status === 'error' ? styles.lineThrough : undefined
  const textTypeBold = props.large ? 'BodyBold' : 'BodySmallBold'
  const textTypeItalic = props.large ? 'BodyItalic' : 'BodySmallItalic'
  const textTypeSemibold = props.large ? 'BodySemibold' : 'BodySmallSemibold'
  // u2026 is an ellipsis
  const textSentenceEnd = props.detailView && props.pending ? '\u2026' : '.'

  if (props.isAdvanced) {
    if (props.trustline) {
      const assetCode = props.trustline.asset.code
      const assetIssuer = props.trustline.asset.verifiedDomain || 'Unknown'
      const asset = (
        <Text type="BodySmall" style={{textDecorationLine: props.trustline.remove ? 'line-through' : 'none'}}>
          <Text type="BodySmallBold">{assetCode}</Text>/{assetIssuer}
        </Text>
      )
      const verb = props.trustline.remove ? 'removed' : 'added'
      return (
        <Text type="BodySmall" style={{...styles.breakWord, ...textStyle}}>
          You {verb} a trustline: {asset}
        </Text>
      )
    }
    return (
      <Text type={textType} style={{...styles.breakWord, ...textStyle}}>
        {props.summaryAdvanced || 'This account was involved in a complex transaction.'}
      </Text>
    )
  }

  let amount
  if (props.issuerDescription) {
    // non-native asset
    amount = (
      <>
        <Text selectable={props.selectableText} type={textType}>
          {props.amountUser}
        </Text>{' '}
        <Text selectable={props.selectableText} type={textType}>
          ({props.issuerDescription})
        </Text>
      </>
    )
  } else if (props.isXLM) {
    // purely, strictly lumens
    amount = (
      <>
        <Text selectable={props.selectableText} type={textType}>
          {props.amountUser}
        </Text>
      </>
    )
  } else {
    // lumens sent with outside currency exchange rate
    amount = (
      <>
        Lumens worth{' '}
        <Text selectable={true} type={textType}>
          {props.amountUser}
        </Text>
      </>
    )
  }

  const counterparty = () => (
    <CounterpartyText
      counterparty={props.counterparty}
      counterpartyType={props.counterpartyType}
      onShowProfile={props.onShowProfile}
      textType={textType}
      textTypeItalic={textTypeItalic}
      textTypeSemibold={textTypeSemibold}
      textTypeBold={textTypeBold}
    />
  )
  const approxWorth = props.approxWorth ? (
    <Text type={textType}> (approximately {props.approxWorth})</Text>
  ) : (
    ''
  )

  switch (props.yourRole) {
    case 'airdrop':
      return (
        <Text type={textType} style={textStyle}>
          {counterparty()}
        </Text>
      )
    case 'senderOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Text type={textType} style={textStyle}>
            {verbPhrase} {amount} from this account to {counterparty()}
            {approxWorth}
            {textSentenceEnd}
          </Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'Sending' : 'You sent'
        return (
          <Text type={textType} style={textStyle}>
            {verbPhrase} {amount} to {counterparty()}
            {approxWorth}
            {textSentenceEnd}
          </Text>
        )
      }
    case 'receiverOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Text type={textType} style={textStyle}>
            {verbPhrase} {amount} from {counterparty()} to this account{approxWorth}
            {textSentenceEnd}
          </Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'sending' : 'sent you'
        return (
          <Text type={textType} style={textStyle}>
            {counterparty()} {verbPhrase} {amount}
            {approxWorth}
            {textSentenceEnd}
          </Text>
        )
      }
    case 'senderAndReceiver': {
      const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
      return (
        <Text type={textType} style={textStyle}>
          {verbPhrase} {amount} from this account to itself{approxWorth}
          {textSentenceEnd}
        </Text>
      )
    }
    case 'none': {
      return (
        <Text type={textType} style={{...styles.breakWord, ...textStyle}}>
          {props.summaryAdvanced || 'This account was involved in a complex transaction.'}
        </Text>
      )
    }
    default:
      throw new Error(`Unexpected role ${props.yourRole}`)
  }
}

type AmountProps = {
  yourRole: Types.Role
  amountDescription: string
  sourceAmountDescription?: string
  canceled: boolean
  pending: boolean
  selectableText: boolean
}

const roleToColor = (role: Types.Role) => {
  switch (role) {
    case 'airdrop':
      return Styles.globalColors.purpleDark
    case 'senderOnly':
      return Styles.globalColors.black
    case 'receiverOnly':
      return Styles.globalColors.greenDark
    case 'senderAndReceiver':
      return Styles.globalColors.black
    case 'none':
      return Styles.globalColors.black
    default:
      throw new Error(`Unexpected role ${role}`)
  }
}

const getAmount = (role: Types.Role, amount: string, sourceAmount?: string): string => {
  switch (role) {
    case 'senderOnly':
      return `- ${sourceAmount || amount}`
    case 'airdrop':
    case 'receiverOnly':
      return `+ ${amount}`
    case 'senderAndReceiver':
    case 'none':
      return '0 XLM'
    default:
      throw new Error(`Unexpected role ${role}`)
  }
}

const Amount = (props: AmountProps) => {
  const color = props.pending || props.canceled ? Styles.globalColors.black_20 : roleToColor(props.yourRole)

  const amount = getAmount(props.yourRole, props.amountDescription, props.sourceAmountDescription)
  return (
    <Text
      selectable={props.selectableText}
      style={Styles.collapseStyles([
        {color, flexShrink: 0, textAlign: 'right'},
        props.canceled && styles.lineThrough,
      ])}
      type="BodyExtrabold"
    >
      {amount}
    </Text>
  )
}

type TimestampErrorProps = {
  error: string
  status?: Types.StatusSimplified
}

export const TimestampError = (props: TimestampErrorProps) => (
  <Text type="BodySmallError">
    {props.status ? capitalize(props.status) + ' • ' : ''}
    The Stellar network did not approve this transaction - {props.error}
  </Text>
)

export const TimestampPending = () => (
  <Text type="BodySmall">The Stellar network hasn't confirmed your transaction.</Text>
)

type TimestampLineProps = {
  detailView: boolean | null
  error: string
  reverseColor?: boolean
  status: Types.StatusSimplified
  timestamp: Date | null
  selectableText: boolean
}

const TimestampLine = (props: TimestampLineProps) => {
  const timestamp = props.timestamp
  if (!timestamp) {
    return <TimestampPending />
  }
  const human = formatTimeForMessages(timestamp.getTime())
  const tooltip = formatTimeForStellarTooltip(timestamp)
  let status: string | null = capitalize(props.status)
  // 'claimable' -> show 'pending' and completed -> show nothing
  switch (status) {
    case 'Completed':
      status = null
      break
    case 'Claimable':
      status = 'Pending'
      break
    case 'Error':
      status = 'Failed'
      break
  }
  return (
    <Text
      selectable={props.selectableText}
      style={props.reverseColor ? {color: Styles.globalColors.white} : undefined}
      title={tooltip}
      type="BodySmall"
    >
      {human}
      {status ? ` • ` : null}
      {!!status && (
        <Text selectable={props.selectableText} type={status === 'Failed' ? 'BodySmallError' : 'BodySmall'}>
          {status}
        </Text>
      )}
      {status === 'Failed' && !props.detailView && (
        <>
          {' '}
          (
          <Text selectable={props.selectableText} type="BodySmallSecondaryLink">
            see more
          </Text>
          )
        </>
      )}
    </Text>
  )
}

const styleMarkdownMemo = {
  paragraph: {
    color: Styles.globalColors.purpleDark,
  },
  strong: {
    color: Styles.globalColors.purpleDark,
  },
}

export type ReadState = 'read' | 'unread' | 'oldestUnread'

export type Props = {
  amountUser: string // empty if sent with no display currency
  amountXLM: string
  approxWorth: string
  counterparty: string
  counterpartyType: Types.CounterpartyType
  detailView?: boolean
  fromAirdrop: boolean
  isAdvanced: boolean
  summaryAdvanced?: string
  // Ignored if counterpartyType is stellarPublicKey and yourRole is
  // receiverOnly.
  memo: string
  onCancelPayment?: () => void
  onCancelPaymentWaitingKey: string
  // onShowProfile is used only when counterpartyType === 'keybaseUser'.
  onSelectTransaction?: () => void
  onShowProfile: (username: string) => void
  readState: ReadState
  selectableText: boolean
  sourceAmount: string
  sourceAsset: string
  status: Types.StatusSimplified
  statusDetail: string
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null
  unread: boolean
  yourRole: Types.Role
  trustline?: RPCTypes.PaymentTrustlineLocal
  issuerDescription: string
}

export const Transaction = (props: Props) => {
  let showMemo: boolean
  switch (props.counterpartyType) {
    case 'airdrop':
    case 'keybaseUser':
      showMemo = true
      break
    case 'stellarPublicKey':
      showMemo = props.yourRole !== 'receiverOnly'
      break
    case 'otherAccount':
      showMemo = !!props.memo
      break
    default:
      throw new Error(`Unexpected counterpartyType ${props.counterpartyType}`)
  }
  if (props.isAdvanced) {
    showMemo = !!props.memo
  }
  const large = true
  const pending = !props.timestamp || ['pending', 'claimable'].includes(props.status)
  const backgroundColor =
    (props.unread || pending) && !props.detailView
      ? Styles.globalColors.blueLighter2
      : Styles.globalColors.white
  return (
    <Box2 direction="vertical" fullWidth={true} style={{backgroundColor}}>
      <ClickableBox onClick={props.onSelectTransaction}>
        <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
          {!(props.isAdvanced && props.trustline) && (
            <CounterpartyIcon
              counterparty={props.counterparty}
              counterpartyType={props.counterpartyType}
              detailView={props.detailView}
              large={large}
              onShowProfile={props.onShowProfile}
            />
          )}
          <Box2 direction="vertical" fullHeight={true} style={styles.rightContainer}>
            <TimestampLine
              detailView={props.detailView || false}
              error={props.status === 'error' ? props.statusDetail : ''}
              selectableText={props.selectableText}
              status={props.status}
              timestamp={props.timestamp}
            />
            <Detail
              approxWorth={props.approxWorth}
              detailView={!!props.detailView}
              fromAirdrop={props.fromAirdrop}
              large={large}
              pending={pending}
              canceled={props.status === 'canceled'}
              yourRole={props.yourRole}
              counterparty={props.counterparty}
              counterpartyType={props.counterpartyType}
              amountUser={props.amountUser || props.amountXLM}
              isXLM={!props.amountUser}
              onShowProfile={props.onShowProfile}
              selectableText={props.selectableText}
              sourceAmount={props.sourceAmount}
              sourceAsset={props.sourceAsset}
              status={props.status}
              issuerDescription={props.issuerDescription}
              isAdvanced={props.isAdvanced}
              summaryAdvanced={props.summaryAdvanced}
              trustline={props.trustline}
            />
            {showMemo && (
              <MarkdownMemo
                memo={props.memo}
                hideDivider={props.fromAirdrop}
                style={styles.memoStyle}
                styleOverride={props.fromAirdrop ? styleMarkdownMemo : undefined}
              />
            )}
            <Box2 direction="horizontal" fullWidth={true} style={styles.marginTopXTiny}>
              {props.onCancelPayment && (
                <Box2 direction="vertical" gap="tiny" style={styles.flexOne}>
                  <Text type="BodySmall">{Constants.makeCancelButtonInfo(props.counterparty)}</Text>
                  <WaitingButton
                    type="Danger"
                    mode="Secondary"
                    label="Cancel"
                    small={true}
                    style={styles.cancelButton}
                    onClick={evt => {
                      evt.stopPropagation()
                      props.onCancelPayment && props.onCancelPayment()
                    }}
                    waitingKey={props.onCancelPaymentWaitingKey}
                  />
                </Box2>
              )}
              <Box2 direction="horizontal" style={styles.marginLeftAuto} />
              {props.status !== 'error' && !props.isAdvanced && (
                <Amount
                  selectableText={props.selectableText}
                  canceled={props.status === 'canceled'}
                  pending={pending}
                  yourRole={props.yourRole}
                  sourceAmountDescription={
                    props.sourceAmount ? `${props.sourceAmount} ${props.sourceAsset || 'XLM'}` : undefined
                  }
                  amountDescription={props.amountXLM}
                />
              )}
            </Box2>
          </Box2>
        </Box2>
        {props.readState === 'oldestUnread' && (
          <Box2 direction="horizontal" fullWidth={true} style={styles.orangeLine} />
        )}
      </ClickableBox>
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      breakWord: Styles.platformStyles({isElectron: {wordBreak: 'break-word'} as const}),
      cancelButton: {
        alignSelf: 'flex-start',
      },
      container: Styles.platformStyles({
        isElectron: {
          padding: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.small,
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
        },
      }),
      flexOne: {flex: 1},
      lineThrough: {
        textDecorationLine: 'line-through',
      } as const,
      marginLeftAuto: {marginLeft: 'auto'},
      marginTopXTiny: {
        marginTop: Styles.globalMargins.xtiny,
      },
      memoStyle: {
        marginTop: Styles.globalMargins.xtiny,
        paddingRight: Styles.globalMargins.small,
      },
      orangeLine: {backgroundColor: Styles.globalColors.orange, height: 1},
      rightContainer: {
        flex: 1,
        marginLeft: Styles.globalMargins.tiny,
      },
      transferIcon: {
        position: 'relative',
        top: Styles.globalMargins.xtiny,
      },
      transferIconContainer: {
        justifyContent: 'center',
      },
    } as const)
)

export default Transaction
