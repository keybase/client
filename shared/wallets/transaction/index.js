// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {capitalize} from 'lodash-es'
import {
  Avatar,
  Box2,
  Button,
  ClickableBox,
  Icon,
  ConnectedUsernames,
  WaitingButton,
} from '../../common-adapters'
import Text, {type TextType} from '../../common-adapters/text'
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
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (counterpartyType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.counterpartyType);
      */
      return null
  }
}

type StellarPublicKeyProps = {|
  publicKey: string,
  showFullKey: boolean,
  textType: TextType,
|}

const StellarPublicKey = (props: StellarPublicKeyProps) => {
  const key = props.publicKey
  return (
    <Text type={props.textType} selectable={props.showFullKey} title={key}>
      {props.showFullKey ? key : key.substr(0, 6) + '...' + key.substr(-5)}
    </Text>
  )
}

type CounterpartyTextProps = {|
  large: boolean,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  onShowProfile: string => void,
  showFullKey: boolean,
  textType?: 'Body' | 'BodySmall' | 'BodySemibold',
  textTypeSemibold?: 'BodySemibold' | 'BodySmallSemibold',
  textTypeSemiboldItalic?: 'BodySemiboldItalic' | 'BodySmallSemiboldItalic',
|}

export const CounterpartyText = (props: CounterpartyTextProps) => {
  const textTypeSemibold = props.textTypeSemibold || (props.large ? 'BodySemibold' : 'BodySmallSemibold')
  const textTypeSemiboldItalic =
    props.textTypeSemiboldItalic || (props.large ? 'BodySemiboldItalic' : 'BodySmallSemiboldItalic')

  switch (props.counterpartyType) {
    case 'keybaseUser':
      return (
        <ConnectedUsernames
          colorFollowing={true}
          colorBroken={true}
          inline={true}
          onUsernameClicked={props.onShowProfile}
          type={textTypeSemibold}
          underline={true}
          usernames={[props.counterparty]}
        />
      )
    case 'stellarPublicKey':
      return (
        <StellarPublicKey
          publicKey={props.counterparty}
          showFullKey={props.showFullKey}
          textType={textTypeSemibold}
        />
      )
    case 'otherAccount':
      return <Text type={textTypeSemiboldItalic}>{props.counterparty}</Text>
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (counterpartyType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.counterpartyType);
      */
      break
  }
  return null
}

type DetailProps = {|
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
|}

const Detail = (props: DetailProps) => {
  const textType = props.large ? 'Body' : 'BodySmall'
  const textTypeSemibold = props.large ? 'BodySemibold' : 'BodySmallSemibold'
  const textTypeExtrabold = props.large ? 'BodyExtrabold' : 'BodySmallExtrabold'

  const amount = props.isXLM ? (
    <Text selectable={props.selectableText} type={textTypeExtrabold}>
      {props.amountUser}
    </Text>
  ) : (
    <React.Fragment>
      Lumens worth{' '}
      <Text selectable={true} type={textTypeExtrabold}>
        {props.amountUser}
      </Text>
    </React.Fragment>
  )

  const counterparty = () => (
    <CounterpartyText
      counterparty={props.counterparty}
      counterpartyType={props.counterpartyType}
      large={props.large}
      onShowProfile={props.onShowProfile}
      showFullKey={false}
      textType={textType}
      textTypeSemibold={textTypeSemibold}
    />
  )

  const textStyle = props.canceled ? styles.lineThrough : null

  switch (props.yourRole) {
    case 'senderOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Text type={textTypeSemibold} style={textStyle}>
            {verbPhrase} {amount} from this account to {counterparty()}.
          </Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'Sending' : 'You sent'
        return (
          <Text type={textTypeSemibold} style={textStyle}>
            {verbPhrase} {amount} to {counterparty()}.
          </Text>
        )
      }
    case 'receiverOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Text type={textTypeSemibold} style={textStyle}>
            {verbPhrase} {amount} from {counterparty()} to this account.
          </Text>
        )
      } else {
        const verbPhrase = props.pending || props.canceled ? 'sending' : 'sent you'
        return (
          <Text type={textTypeSemibold} style={textStyle}>
            {counterparty()} {verbPhrase} {amount}.
          </Text>
        )
      }
    case 'senderAndReceiver':
      const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
      return (
        <Text type={textTypeSemibold} style={textStyle}>
          {verbPhrase} {amount} from this account to itself.
        </Text>
      )
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove(props.yourRole);
      */
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
      return globalColors.red
    case 'receiverOnly':
      return globalColors.green
    case 'senderAndReceiver':
      return globalColors.black
    default:
      /*::
    declare var ifFlowErrorsHereItsCauseYouDidntHandleAllRolesAbove: (type: empty) => any
    ifFlowErrorsHereItsCauseYouDidntHandleAllRolesAbove(role);
  */
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
      /*::
    declare var ifFlowErrorsHereItsCauseYouDidntHandleAllRolesAbove: (type: empty) => any
    ifFlowErrorsHereItsCauseYouDidntHandleAllRolesAbove(role);
  */
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

type TimestampLineProps = {|
  error: string,
  status?: Types.StatusSimplified,
  timestamp: ?Date,
  selectableText: boolean,
|}

export const TimestampLine = (props: TimestampLineProps) => {
  if (props.error) {
    return (
      <Text type="BodySmallError">
        {capitalize(props.status)} • The Stellar network did not approve this transaction - {props.error}
      </Text>
    )
  }
  if (!props.timestamp) {
    return <Text type="BodySmall">The Stellar network hasn't confirmed your transaction.</Text>
  }
  const human = formatTimeForMessages(props.timestamp)
  const tooltip = props.timestamp ? formatTimeForStellarTooltip(props.timestamp) : ''
  let status = capitalize(props.status)
  // 'cancelable' -> show 'pending' and completed -> show nothing
  switch (status) {
    case 'Completed':
      status = null
      break
    case 'Cancelable':
      status = 'Pending'
      break
  }
  return (
    <Text selectable={props.selectableText} title={tooltip} type="BodySmall">
      {human}
      {status ? ` • ${status}` : null}
    </Text>
  )
}

type ReadState = 'read' | 'unread' | 'oldestUnread'

export type Props = {|
  amountUser: string, // empty if sent with no display currency
  amountXLM: string,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  // Ignored if counterpartyType is stellarPublicKey and yourRole is
  // receiverOnly.
  memo: string,
  onCancelPayment: ?() => void,
  onCancelPaymentWaitingKey: string,
  // onChat and onShowProfile are used only when counterpartyType ===
  // 'keybaseUser'.
  onChat: string => void,
  onSelectTransaction?: () => void,
  onShowProfile: string => void,
  readState: ReadState,
  selectableText: boolean,
  status: Types.StatusSimplified,
  statusDetail: string,
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  yourRole: Types.Role,
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
      large = !!props.memo
      showMemo = !!props.memo
      break
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (counterpartyType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.counterpartyType);
      */
      throw new Error(`Unexpected counterpartyType ${props.counterpartyType}`)
  }
  const pending = !props.timestamp || ['pending', 'cancelable'].includes(props.status)
  const unread = props.readState === 'unread' || props.readState === 'oldestUnread'
  const backgroundColor = pending || unread ? globalColors.blue4 : globalColors.white
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
              error={props.status === 'error' ? props.statusDetail : ''}
              selectableText={props.selectableText}
              status={props.status}
              timestamp={props.timestamp}
            />
            <Detail
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
            />
            {showMemo && <MarkdownMemo style={styles.marginVerticalXTiny} memo={props.memo} />}
            <Box2 direction="horizontal" fullWidth={true}>
              <Box2 direction="vertical" gap="tiny">
                {props.onCancelPayment && (
                  <Text type="BodySmall">
                    {props.counterparty} can claim this when they set up their wallet.
                  </Text>
                )}
                <Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                  {props.counterpartyType === 'keybaseUser' && (
                    <Button
                      type="Secondary"
                      label="Chat"
                      small={true}
                      onClick={() => props.onChat(props.counterparty)}
                    />
                  )}
                  {props.onCancelPayment && (
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
                  )}
                </Box2>
              </Box2>

              <Box2 direction="horizontal" style={{flex: 1}} />
              <AmountXLM
                selectableText={props.selectableText}
                canceled={props.status === 'canceled'}
                pending={pending}
                yourRole={props.yourRole}
                amountXLM={props.amountXLM}
              />
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
  lineThrough: {
    textDecorationLine: 'line-through',
  },
  marginVerticalXTiny: {
    marginBottom: globalMargins.xtiny,
    marginTop: globalMargins.xtiny,
  },
  orangeLine: {backgroundColor: globalColors.orange, height: 1},
  pendingBox: {backgroundColor: globalColors.blue5, padding: globalMargins.xtiny},
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
})

export default Transaction
