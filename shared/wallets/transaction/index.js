// @flow
import * as React from 'react'
import * as Flow from '../../util/flow'
import * as Types from '../../constants/types/wallets'
import {capitalize} from 'lodash-es'
import {
  Avatar,
  Box2,
  ClickableBox,
  Icon,
  ConnectedUsernames,
  Text,
  WaitingButton,
} from '../../common-adapters'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {formatTimeForMessages, formatTimeForStellarTooltip} from '../../util/timestamp'
import {MarkdownMemo} from '../common'

type CounterpartyIconProps = {|
  large: boolean,
  onShowProfile: string => void,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
|}

const CounterpartyIcon = (props: CounterpartyIconProps) => {
  const size = props.large ? 48 : 32
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return (
        <Avatar
          onClick={() => props.onShowProfile(props.counterparty)}
          username={props.counterparty}
          size={size}
        />
      )
    case 'stellarPublicKey':
      return <Icon type="icon-placeholder-secret-user-48" style={{height: size, width: size}} />
    case 'otherAccount':
      return <Icon type="icon-wallet-to-wallet-48" style={{height: size, width: size}} />
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.counterpartyType)
      return null
  }
}

type CounterpartyTextProps = {|
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  onShowProfile: string => void,
  textTypeSemibold: 'BodySemibold' | 'BodySmallSemibold',
  textTypeSemiboldItalic: 'BodySemiboldItalic' | 'BodySmallSemiboldItalic',
|}

export const CounterpartyText = (props: CounterpartyTextProps) => {
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return (
        <ConnectedUsernames
          colorFollowing={true}
          colorBroken={true}
          inline={true}
          onUsernameClicked={props.onShowProfile}
          type={props.textTypeSemibold}
          underline={true}
          usernames={[props.counterparty]}
        />
      )
    case 'stellarPublicKey':
      const key = props.counterparty
      return (
        <Text type={props.textTypeSemibold} selectable={false} title={key}>
          {key.substr(0, 6) + '...' + key.substr(-5)}
        </Text>
      )
    case 'otherAccount':
      return <Text type={props.textTypeSemiboldItalic}>{props.counterparty}</Text>
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.counterpartyType)
      break
  }
  return null
}

type DetailProps = {|
  approxWorth: string,
  detailView: boolean,
  large: boolean,
  pending: boolean,
  yourRole: Types.Role,
  canceled: boolean,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  amountUser: string,
  isXLM: boolean,
  onShowProfile: string => void,
  selectableText: boolean,
  status: string,
  issuerDescription: string,
|}

const Detail = (props: DetailProps) => {
  const textTypeSemibold = props.large ? 'BodySemibold' : 'BodySmallSemibold'
  const textTypeSemiboldItalic = props.large ? 'BodySemiboldItalic' : 'BodySmallSemiboldItalic'
  const textTypeExtrabold = props.large ? 'BodyExtrabold' : 'BodySmallExtrabold'
  // u2026 is an ellipsis
  const textSentenceEnd = props.detailView && props.pending ? '\u2026' : '.'

  let amount
  if (props.issuerDescription) {
    // non-native asset
    amount = (
      <React.Fragment>
        <Text selectable={props.selectableText} type={textTypeExtrabold}>
          {props.amountUser}
        </Text>{' '}
        <Text selectable={props.selectableText} type={textTypeSemibold}>
          ({props.issuerDescription})
        </Text>
      </React.Fragment>
    )
  } else if (props.isXLM) {
    // purely, strictly lumens
    amount = (
      <React.Fragment>
        <Text selectable={props.selectableText} type={textTypeExtrabold}>
          {props.amountUser}
        </Text>
      </React.Fragment>
    )
  } else {
    // lumens sent with outside currency exchange rate
    amount = (
      <React.Fragment>
        Lumens worth{' '}
        <Text selectable={true} type={textTypeExtrabold}>
          {props.amountUser}
        </Text>
      </React.Fragment>
    )
  }

  const counterparty = () => (
    <CounterpartyText
      counterparty={props.counterparty}
      counterpartyType={props.counterpartyType}
      onShowProfile={props.onShowProfile}
      textTypeSemibold={textTypeSemibold}
      textTypeSemiboldItalic={textTypeSemiboldItalic}
    />
  )
  const approxWorth = props.approxWorth ? (
    <Text type={textTypeSemibold}>
      {' '}
      (approximately <Text type={textTypeExtrabold}>{props.approxWorth}</Text>)
    </Text>
  ) : (
    ''
  )

  const textStyle = props.canceled || props.status === 'error' ? styles.lineThrough : null

  switch (props.yourRole) {
    case 'senderOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Text type={textTypeSemibold} style={textStyle}>
            {verbPhrase} {amount} from this account to {counterparty()}
            {approxWorth}
            {textSentenceEnd}
          </Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'Sending' : 'You sent'
        return (
          <Text type={textTypeSemibold} style={textStyle}>
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
          <Text type={textTypeSemibold} style={textStyle}>
            {verbPhrase} {amount} from {counterparty()} to this account{approxWorth}
            {textSentenceEnd}
          </Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'sending' : 'sent you'
        return (
          <Text type={textTypeSemibold} style={textStyle}>
            {counterparty()} {verbPhrase} {amount}
            {approxWorth}
            {textSentenceEnd}
          </Text>
        )
      }
    case 'senderAndReceiver':
      const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
      return (
        <Text type={textTypeSemibold} style={textStyle}>
          {verbPhrase} {amount} from this account to itself{approxWorth}
          {textSentenceEnd}
        </Text>
      )
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.yourRole)
      throw new Error(`Unexpected role ${props.yourRole}`)
  }
}

type AmountXLMProps = {|
  yourRole: Types.Role,
  amountXLM: string,
  canceled: boolean,
  pending: boolean,
  selectableText: boolean,
|}

const roleToColor = (role: Types.Role): string => {
  switch (role) {
    case 'senderOnly':
      return globalColors.black_75
    case 'receiverOnly':
      return globalColors.green
    case 'senderAndReceiver':
      return globalColors.black_75
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(role)
      throw new Error(`Unexpected role ${role}`)
  }
}

const getAmount = (role: Types.Role, amountXLM: string): string => {
  switch (role) {
    case 'senderOnly':
      return `- ${amountXLM}`
    case 'receiverOnly':
      return `+ ${amountXLM}`
    case 'senderAndReceiver':
      return '0 XLM'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(role)
      throw new Error(`Unexpected role ${role}`)
  }
}

const AmountXLM = (props: AmountXLMProps) => {
  const color = props.pending || props.canceled ? globalColors.black_20 : roleToColor(props.yourRole)

  const amount = getAmount(props.yourRole, props.amountXLM)
  return (
    <Text
      selectable={props.selectableText}
      style={collapseStyles([
        {color, flexShrink: 0, textAlign: 'right'},
        props.canceled && styles.lineThrough,
      ])}
      type="BodyExtrabold"
    >
      {amount}
    </Text>
  )
}

type TimestampErrorProps = {|
  error: string,
  status?: Types.StatusSimplified,
|}

export const TimestampError = (props: TimestampErrorProps) => (
  <Text type="BodySmallError">
    {props.status ? capitalize(props.status) + ' • ' : ''}
    The Stellar network did not approve this transaction - {props.error}
  </Text>
)

export const TimestampPending = () => (
  <Text type="BodySmall">The Stellar network hasn't confirmed your transaction.</Text>
)

type TimestampLineProps = {|
  detailView: ?boolean,
  error: string,
  status: Types.StatusSimplified,
  timestamp: ?Date,
  selectableText: boolean,
|}

const TimestampLine = (props: TimestampLineProps) => {
  const timestamp = props.timestamp
  if (!timestamp) {
    return <TimestampPending />
  }
  const human = formatTimeForMessages(timestamp.getTime())
  const tooltip = formatTimeForStellarTooltip(timestamp)
  let status = capitalize(props.status)
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
    <Text selectable={props.selectableText} title={tooltip} type="BodySmall">
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

type ReadState = 'read' | 'unread' | 'oldestUnread'

export type Props = {|
  amountUser: string, // empty if sent with no display currency
  amountXLM: string,
  approxWorth: string,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  detailView?: boolean,
  // Ignored if counterpartyType is stellarPublicKey and yourRole is
  // receiverOnly.
  memo: string,
  onCancelPayment: ?() => void,
  onCancelPaymentWaitingKey: string,
  // onShowProfile is used only when counterpartyType === 'keybaseUser'.
  onSelectTransaction?: ?() => void,
  onShowProfile: string => void,
  readState: ReadState,
  selectableText: boolean,
  status: Types.StatusSimplified,
  statusDetail: string,
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  unread: boolean,
  yourRole: Types.Role,
  issuerDescription: string,
|}

export const Transaction = (props: Props) => {
  let large: boolean
  let showMemo: boolean
  switch (props.counterpartyType) {
    case 'keybaseUser':
      large = true
      showMemo = true
      break
    case 'stellarPublicKey':
      large = true
      showMemo = props.yourRole !== 'receiverOnly'
      break
    case 'otherAccount':
      large = true
      showMemo = !!props.memo
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.counterpartyType)
      throw new Error(`Unexpected counterpartyType ${props.counterpartyType}`)
  }
  const pending = !props.timestamp || ['pending', 'claimable'].includes(props.status)
  const backgroundColor = props.unread && !props.detailView ? globalColors.blue4 : globalColors.white
  return (
    <Box2 direction="vertical" fullWidth={true} style={{backgroundColor}}>
      <ClickableBox onClick={props.onSelectTransaction}>
        <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
          <CounterpartyIcon
            counterparty={props.counterparty}
            counterpartyType={props.counterpartyType}
            large={large}
            onShowProfile={props.onShowProfile}
          />
          <Box2 direction="vertical" fullHeight={true} style={styles.rightContainer}>
            <TimestampLine
              detailView={props.detailView}
              error={props.status === 'error' ? props.statusDetail : ''}
              selectableText={props.selectableText}
              status={props.status}
              timestamp={props.timestamp}
            />
            <Detail
              approxWorth={props.approxWorth}
              detailView={!!props.detailView}
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
              status={props.status}
              issuerDescription={props.issuerDescription}
            />
            {showMemo && <MarkdownMemo style={styles.marginTopXTiny} memo={props.memo} />}
            <Box2 direction="horizontal" fullWidth={true} style={styles.marginTopXTiny}>
              {props.onCancelPayment && (
                <Box2 direction="vertical" gap="tiny" style={styles.flexOne}>
                  <Text type="BodySmall">
                    {props.counterparty} can claim this when they set up their wallet.
                  </Text>
                  <WaitingButton
                    type="Danger"
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
              {props.status !== 'error' && (
                <AmountXLM
                  selectableText={props.selectableText}
                  canceled={props.status === 'canceled'}
                  pending={pending}
                  yourRole={props.yourRole}
                  amountXLM={props.amountXLM}
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

const styles = styleSheetCreate({
  cancelButton: {
    alignSelf: 'flex-start',
  },
  container: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  flexOne: {flex: 1},
  lineThrough: {
    textDecorationLine: 'line-through',
  },
  marginLeftAuto: {marginLeft: 'auto'},
  marginTopXTiny: {
    marginTop: globalMargins.xtiny,
  },
  orangeLine: {backgroundColor: globalColors.orange, height: 1},
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
})

export default Transaction
