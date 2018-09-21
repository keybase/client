// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {capitalize} from 'lodash-es'
import {Avatar, Box2, ClickableBox, Divider, Icon, ConnectedUsernames, Markdown} from '../../common-adapters'
import Text, {type TextType} from '../../common-adapters/text'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {formatTimeForMessages, formatTimeForStellarTooltip} from '../../util/timestamp'

type CounterpartyIconProps = {|
  large: boolean,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
|}

export const CounterpartyIcon = (props: CounterpartyIconProps) => {
  const size = props.large ? 48 : 32
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return <Avatar username={props.counterparty} size={size} />
    case 'stellarPublicKey':
      return <Icon type="icon-placeholder-secret-user-48" style={{height: size, width: size}} />
    case 'otherAccount':
      return <Icon type="icon-wallet-add-48" style={{height: size, width: size}} />
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
          type={textTypeSemibold}
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
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  amountUser: string,
  isXLM: boolean,
|}

const Detail = (props: DetailProps) => {
  const textType = props.large ? 'Body' : 'BodySmall'
  const textTypeSemibold = props.large ? 'BodySemibold' : 'BodySmallSemibold'
  const textTypeExtrabold = props.large ? 'BodyExtrabold' : 'BodySmallExtrabold'

  const amount = props.isXLM ? (
    <Text onClick={event => event.stopPropagation()} selectable={true} type={textTypeExtrabold}>
      {props.amountUser}
    </Text>
  ) : (
    <React.Fragment>
      Lumens worth{' '}
      <Text onClick={event => event.stopPropagation()} selectable={true} type={textTypeExtrabold}>
        {props.amountUser}
      </Text>
    </React.Fragment>
  )

  const counterparty = () => (
    <CounterpartyText
      counterparty={props.counterparty}
      counterpartyType={props.counterpartyType}
      large={props.large}
      showFullKey={false}
      textType={textType}
      textTypeSemibold={textTypeSemibold}
    />
  )

  switch (props.yourRole) {
    case 'senderOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Text type={textTypeSemibold}>
            {verbPhrase} {amount} from this account to {counterparty()}.
          </Text>
        )
      } else {
        const verbPhrase = props.pending ? 'Sending' : 'You sent'
        return (
          <Text type={textTypeSemibold}>
            {verbPhrase} {amount} to {counterparty()}.
          </Text>
        )
      }
    case 'receiverOnly':
      if (props.counterpartyType === 'otherAccount') {
        const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
        return (
          <Text type={textTypeSemibold}>
            {verbPhrase} {amount} from {counterparty()} to this account.
          </Text>
        )
      } else {
        const verbPhrase = props.pending ? 'sending' : 'sent you'
        return (
          <Text type={textTypeSemibold}>
            {counterparty()} {verbPhrase} {amount}.
          </Text>
        )
      }
    case 'senderAndReceiver':
      const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
      return (
        <Text type={textTypeSemibold}>
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
  pending: boolean,
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
  const color = props.pending ? globalColors.black_20 : roleToColor(props.yourRole)

  const amount = getAmount(props.yourRole, props.amountXLM)
  return (
    <Text
      onClick={event => event.stopPropagation()}
      selectable={true}
      style={{color, textAlign: 'right'}}
      type="BodyExtrabold"
    >
      {amount}
    </Text>
  )
}

type TimestampLineProps = {|
  error: string,
  status: Types.StatusSimplified,
  timestamp: Date | null,
  relative: boolean,
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
    return (
      <Text type="BodySmall">
        {props.relative ? 'Pending' : "The Stellar network hasn't confirmed your transaction."}
      </Text>
    )
  }
  const human = formatTimeForMessages(props.timestamp)
  const tooltip = props.timestamp ? formatTimeForStellarTooltip(props.timestamp) : ''
  return (
    <Text title={tooltip} type="BodySmall">
      {human}
    </Text>
  )
}

export type Props = {|
  amountUser: string, // empty if sent with no display currency
  amountXLM: string,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
  large: boolean,
  // Ignored if yourRole is receiverOnly and counterpartyType is
  // stellarPublicKey.
  memo: string,
  onCancelPayment?: () => void,
  onRetryPayment?: () => void,
  onSelectTransaction?: () => void,
  status: Types.StatusSimplified,
  statusDetail: string,
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  yourRole: Types.Role,
|}

export const Transaction = (props: Props) => {
  const pending = !props.timestamp || props.status !== 'completed'
  const showMemo =
    props.large && !(props.yourRole === 'receiverOnly' && props.counterpartyType === 'stellarPublicKey')
  return (
    <Box2 direction="vertical" fullWidth={true}>
      <ClickableBox onClick={props.onSelectTransaction}>
        <Box2
          direction="horizontal"
          fullWidth={true}
          style={collapseStyles([
            styles.container,
            {backgroundColor: pending ? globalColors.blue4 : globalColors.white},
          ])}
        >
          <CounterpartyIcon
            counterparty={props.counterparty}
            counterpartyType={props.counterpartyType}
            large={props.large}
          />
          <Box2 direction="vertical" fullHeight={true} style={styles.rightContainer}>
            <TimestampLine
              error={props.statusDetail}
              relative={true}
              status={props.status}
              timestamp={props.timestamp}
            />
            <Detail
              large={props.large}
              pending={pending}
              yourRole={props.yourRole}
              counterparty={props.counterparty}
              counterpartyType={props.counterpartyType}
              amountUser={props.amountUser || props.amountXLM}
              isXLM={!props.amountUser}
            />
            {// TODO: Consolidate memo display code below with
            // chat/conversation/messages/wallet-payment/index.js.
            showMemo && (
              <Box2
                direction="horizontal"
                gap="small"
                fullWidth={true}
                style={{marginTop: globalMargins.xtiny}}
              >
                <Divider vertical={true} style={styles.quoteMarker} />
                <Markdown allowFontScaling={true}>{props.memo}</Markdown>
              </Box2>
            )}
            <AmountXLM pending={pending} yourRole={props.yourRole} amountXLM={props.amountXLM} />
          </Box2>
        </Box2>
      </ClickableBox>
    </Box2>
  )
}

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  pendingBox: {backgroundColor: globalColors.blue5, padding: globalMargins.xtiny},
  quoteMarker: {maxWidth: 3, minWidth: 3},
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
})

export default Transaction
