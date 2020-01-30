import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import * as RPCTypes from '../../constants/types/rpc-stellar-gen'
import * as Constants from '../../constants/wallets'
import capitalize from 'lodash/capitalize'
import * as Kb from '../../common-adapters'
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
    return <Kb.Icon type={Kb.Icon.makeFastType(Kb.IconType.iconfont_identity_stellar)} fontSize={size} />
  }
  switch (props.counterpartyType) {
    case 'airdrop':
      return (
        <Kb.Icon
          type={Kb.Icon.makeFastType(Kb.IconType.icon_airdrop_logo_48)}
          style={{height: size, width: size}}
        />
      )
    case 'keybaseUser':
      return (
        <Kb.Avatar
          onClick={() => props.onShowProfile(props.counterparty)}
          username={props.counterparty}
          size={size}
        />
      )
    case 'stellarPublicKey':
      return (
        <Kb.Icon
          type={Kb.Icon.makeFastType(Kb.IconType.icon_placeholder_secret_user_48)}
          style={{height: 48, width: 48}}
        />
      )
    case 'otherAccount':
      return (
        <Kb.Box2
          alignSelf="flex-start"
          direction="horizontal"
          style={Styles.collapseStyles([styles.transferIconContainer, {width: size}])}
        >
          <Kb.Icon
            color={Styles.globalColors.purple}
            sizeType={props.detailView ? 'Bigger' : 'Big'}
            style={Styles.collapseStyles([!props.detailView && styles.transferIcon])}
            type={Kb.Icon.makeFastType(Kb.IconType.iconfont_wallet_transfer)}
          />
        </Kb.Box2>
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
  textTypeSemibold: 'BodySemibold' | 'BodySmallSemibold'
  textTypeItalic: 'BodyItalic' | 'BodySmallItalic'
}

export const CounterpartyText = (props: CounterpartyTextProps) => {
  switch (props.counterpartyType) {
    case 'airdrop':
      return (
        <Kb.Text style={{color: Styles.globalColors.purpleDark}} type={props.textTypeSemibold}>
          Stellar airdrop
        </Kb.Text>
      )
    case 'keybaseUser':
      return (
        <Kb.ConnectedUsernames
          colorFollowing={true}
          colorBroken={true}
          inline={true}
          onUsernameClicked={props.onShowProfile}
          type={props.textTypeSemibold}
          underline={true}
          usernames={[props.counterparty]}
        />
      )
    case 'stellarPublicKey': {
      const key = props.counterparty
      return (
        <Kb.Text type={props.textType} selectable={false} title={key}>
          {key.substr(0, 6) + '...' + key.substr(-5)}
        </Kb.Text>
      )
    }
    case 'otherAccount':
      return <Kb.Text type={props.textTypeItalic}>{props.counterparty}</Kb.Text>
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
  const textTypeItalic = props.large ? 'BodyItalic' : 'BodySmallItalic'
  const textTypeSemibold = props.large ? 'BodySemibold' : 'BodySmallSemibold'
  const textTypeExtrabold = props.large ? 'BodyExtrabold' : 'BodySmallExtrabold'
  // u2026 is an ellipsis
  const textSentenceEnd = props.detailView && props.pending ? '\u2026' : '.'

  if (props.isAdvanced) {
    if (props.trustline) {
      const assetCode = props.trustline.asset.code
      const assetIssuer = props.trustline.asset.verifiedDomain || 'Unknown'
      const asset = (
        <Kb.Text
          type="BodySmall"
          style={{textDecorationLine: props.trustline.remove ? 'line-through' : 'none'}}
        >
          <Kb.Text type="BodySmallBold">{assetCode}</Kb.Text>/{assetIssuer}
        </Kb.Text>
      )
      const verb = props.trustline.remove ? 'removed' : 'added'
      return (
        <Kb.Text type="BodySmall" style={{...styles.breakWord, ...textStyle}}>
          You {verb} a trustline: {asset}
        </Kb.Text>
      )
    }
    return (
      <Kb.Text type={textType} style={{...styles.breakWord, ...textStyle}}>
        {props.summaryAdvanced || 'This account was involved in a complex transaction.'}
      </Kb.Text>
    )
  }

  let amount
  if (props.issuerDescription) {
    // non-native asset
    amount = (
      <>
        <Kb.Text selectable={props.selectableText} type={textTypeExtrabold}>
          {props.amountUser}
        </Kb.Text>{' '}
        <Kb.Text selectable={props.selectableText} type={textType}>
          ({props.issuerDescription})
        </Kb.Text>
      </>
    )
  } else if (props.isXLM) {
    // purely, strictly lumens
    amount = (
      <>
        <Kb.Text selectable={props.selectableText} type={textTypeExtrabold}>
          {props.amountUser}
        </Kb.Text>
      </>
    )
  } else {
    // lumens sent with outside currency exchange rate
    amount = (
      <>
        Lumens worth{' '}
        <Kb.Text selectable={true} type={textTypeExtrabold}>
          {props.amountUser}
        </Kb.Text>
      </>
    )
  }

  const counterparty = () => (
    <CounterpartyText
      counterparty={props.counterparty}
      counterpartyType={props.counterpartyType}
      onShowProfile={props.onShowProfile}
      textType={textType}
      textTypeSemibold={textTypeSemibold}
      textTypeItalic={textTypeItalic}
    />
  )
  const approxWorth = props.approxWorth ? (
    <Kb.Text type={textType}>
      {' '}
      (approximately <Kb.Text type={textTypeExtrabold}>{props.approxWorth}</Kb.Text>)
    </Kb.Text>
  ) : (
    ''
  )

  switch (props.yourRole) {
    case 'airdrop':
      return (
        <Kb.Text type={textType} style={textStyle}>
          {counterparty()}
        </Kb.Text>
      )
    case 'senderOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Kb.Text type={textType} style={textStyle}>
            {verbPhrase} {amount} from this account to {counterparty()}
            {approxWorth}
            {textSentenceEnd}
          </Kb.Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'Sending' : 'You sent'
        return (
          <Kb.Text type={textType} style={textStyle}>
            {verbPhrase} {amount} to {counterparty()}
            {approxWorth}
            {textSentenceEnd}
          </Kb.Text>
        )
      }
    case 'receiverOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Kb.Text type={textType} style={textStyle}>
            {verbPhrase} {amount} from {counterparty()} to this account{approxWorth}
            {textSentenceEnd}
          </Kb.Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'sending' : 'sent you'
        return (
          <Kb.Text type={textType} style={textStyle}>
            {counterparty()} {verbPhrase} {amount}
            {approxWorth}
            {textSentenceEnd}
          </Kb.Text>
        )
      }
    case 'senderAndReceiver': {
      const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
      return (
        <Kb.Text type={textType} style={textStyle}>
          {verbPhrase} {amount} from this account to itself{approxWorth}
          {textSentenceEnd}
        </Kb.Text>
      )
    }
    case 'none': {
      return (
        <Kb.Text type={textType} style={{...styles.breakWord, ...textStyle}}>
          {props.summaryAdvanced || 'This account was involved in a complex transaction.'}
        </Kb.Text>
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

const roleToColor = (role: Types.Role): string => {
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
    <Kb.Text
      selectable={props.selectableText}
      style={Styles.collapseStyles([
        {color, flexShrink: 0, textAlign: 'right'},
        props.canceled && styles.lineThrough,
      ])}
      type="BodyExtrabold"
    >
      {amount}
    </Kb.Text>
  )
}

type TimestampErrorProps = {
  error: string
  status?: Types.StatusSimplified
}

export const TimestampError = (props: TimestampErrorProps) => (
  <Kb.Text type="BodySmallError">
    {props.status ? capitalize(props.status) + ' • ' : ''}
    The Stellar network did not approve this transaction - {props.error}
  </Kb.Text>
)

export const TimestampPending = () => (
  <Kb.Text type="BodySmall">The Stellar network hasn't confirmed your transaction.</Kb.Text>
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
    <Kb.Text
      selectable={props.selectableText}
      style={props.reverseColor ? {color: Styles.globalColors.white} : undefined}
      title={tooltip}
      type="BodySmall"
    >
      {human}
      {status ? ` • ` : null}
      {!!status && (
        <Kb.Text
          selectable={props.selectableText}
          type={status === 'Failed' ? 'BodySmallError' : 'BodySmall'}
        >
          {status}
        </Kb.Text>
      )}
      {status === 'Failed' && !props.detailView && (
        <>
          {' '}
          (
          <Kb.Text selectable={props.selectableText} type="BodySmallSecondaryLink">
            see more
          </Kb.Text>
          )
        </>
      )}
    </Kb.Text>
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
    <Kb.Box2 direction="vertical" fullWidth={true} style={{backgroundColor}}>
      <Kb.ClickableBox onClick={props.onSelectTransaction}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
          {!(props.isAdvanced && props.trustline) && (
            <CounterpartyIcon
              counterparty={props.counterparty}
              counterpartyType={props.counterpartyType}
              detailView={props.detailView}
              large={large}
              onShowProfile={props.onShowProfile}
            />
          )}
          <Kb.Box2 direction="vertical" fullHeight={true} style={styles.rightContainer}>
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
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.marginTopXTiny}>
              {props.onCancelPayment && (
                <Kb.Box2 direction="vertical" gap="tiny" style={styles.flexOne}>
                  <Kb.Text type="BodySmall">{Constants.makeCancelButtonInfo(props.counterparty)}</Kb.Text>
                  <Kb.WaitingButton
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
                </Kb.Box2>
              )}
              <Kb.Box2 direction="horizontal" style={styles.marginLeftAuto} />
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
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
        {props.readState === 'oldestUnread' && (
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.orangeLine} />
        )}
      </Kb.ClickableBox>
    </Kb.Box2>
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
