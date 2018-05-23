// @flow
import * as React from 'react'
import {Avatar, Box2, Divider, Icon, ConnectedUsernames, Markdown} from '../../common-adapters'
import Text, {type TextType} from '../../common-adapters/text'
import {globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {formatTimeForStellarTransaction, formatTimeForStellarTransactionDetails} from '../../util/timestamp'

type Role = 'sender' | 'receiver'
type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'wallet'

type CounterpartyIconProps = {|
  large: boolean,
  counterparty: string,
  counterpartyType: CounterpartyType,
|}

export const CounterpartyIcon = (props: CounterpartyIconProps) => {
  const size = props.large ? 48 : 32
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return <Avatar username={props.counterparty} size={size} />
    case 'stellarPublicKey':
      return <Icon type="icon-placeholder-secret-user-48" style={{height: size, width: size}} />
    case 'wallet':
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
    <Text type={props.textType} title={key}>
      {props.showFullKey ? key : key.substr(0, 6) + '...' + key.substr(-5)}
    </Text>
  )
}

type CounterpartyTextProps = {|
  large: boolean,
  counterparty: string,
  counterpartyType: CounterpartyType,
  showFullKey: boolean,
  textType?: 'Body' | 'BodySmall' | 'BodySemibold',
  textTypeSemibold?: 'BodySemibold' | 'BodySmallSemibold',
|}

export const CounterpartyText = (props: CounterpartyTextProps) => {
  const textType = props.textType || (props.large ? 'Body' : 'BodySmall')
  const textTypeSemibold = props.textTypeSemibold || (props.large ? 'BodySemibold' : 'BodySmallSemibold')

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
          textType={textType}
        />
      )
    case 'wallet':
      return props.large ? (
        <Text type={textType}>{props.counterparty}</Text>
      ) : (
        <Text type={'BodySmallItalic'}>{props.counterparty}</Text>
      )
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (counterpartyType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(props.counterpartyType);
      */
      break
  }
}

type DetailProps = {|
  large: boolean,
  pending: boolean,
  yourRole: Role,
  counterparty: string,
  counterpartyType: CounterpartyType,
  amountUser: string,
|}

const Detail = (props: DetailProps) => {
  const textType = props.large ? 'Body' : 'BodySmall'
  const textTypeSemibold = props.large ? 'BodySemibold' : 'BodySmallSemibold'

  const counterparty = (
    <CounterpartyText
      counterparty={props.counterparty}
      counterpartyType={props.counterpartyType}
      large={props.large}
      showFullKey={false}
      textType={textType}
      textTypeSemibold={textTypeSemibold}
    />
  )
  const amount = <Text type={textTypeSemibold}>{props.amountUser}</Text>

  if (props.counterpartyType === 'wallet') {
    const verbPhrase = props.pending ? 'Transferring' : 'You transferred'
    if (props.yourRole === 'sender') {
      return (
        <Text type={textType}>
          {verbPhrase} Lumens worth {amount} from this wallet to {counterparty}.
        </Text>
      )
    }

    return (
      <Text type={textType}>
        {verbPhrase} Lumens worth {amount} from {counterparty} to this wallet.
      </Text>
    )
  }

  if (props.yourRole === 'sender') {
    const verbPhrase = props.pending ? 'Sending' : 'You sent'
    return (
      <Text type={textType}>
        {verbPhrase} Lumens worth {amount} to {counterparty}.
      </Text>
    )
  }

  const verbPhrase = props.pending ? 'sending' : 'sent you'
  return (
    <Text type={textType}>
      {counterparty} {verbPhrase} Lumens worth {amount}.
    </Text>
  )
}

type AmountXLMProps = {|
  yourRole: Role,
  amountXLM: string,
  pending: boolean,
|}

const AmountXLM = (props: AmountXLMProps) => {
  const color = props.pending
    ? globalColors.black_20
    : props.yourRole === 'sender'
      ? globalColors.red
      : globalColors.green
  const amount = `${props.yourRole === 'sender' ? '-' : '+'} ${props.amountXLM}`
  return (
    <Text style={{color, textAlign: 'right'}} type="BodyExtrabold">
      {amount}
    </Text>
  )
}

type TimestampProps = {|
  timestamp: Date | null,
  relative: boolean,
|}

export const Timestamp = (props: TimestampProps) => {
  if (!props.timestamp) {
    return (
      <Text type="BodySmall">
        {props.relative ? 'Pending' : "The Stellar network hasn't confirmed your transaction."}
      </Text>
    )
  }
  let human
  let tooltip
  if (props.relative) {
    ;({human, tooltip} = formatTimeForStellarTransaction(props.timestamp))
  } else {
    ;({human, tooltip} = formatTimeForStellarTransactionDetails(props.timestamp))
  }
  return (
    <Text title={tooltip} type="BodySmall">
      {human}
    </Text>
  )
}

export type Props = {|
  large: boolean,

  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,

  yourRole: Role,
  counterparty: string,
  counterpartyType: CounterpartyType,
  amountUser: string,
  amountXLM: string,

  // Ignored if yourRole is receiver and counterpartyType is
  // stellarPublicKey.
  memo: string,
|}

export const Transaction = (props: Props) => {
  const pending = !props.timestamp
  const showMemo =
    props.large && !(props.yourRole === 'receiver' && props.counterpartyType === 'stellarPublicKey')
  return (
    <Box2 direction="vertical" fullWidth={true}>
      {pending && (
        <Box2
          direction="vertical"
          fullWidth={true}
          style={{backgroundColor: globalColors.blue5, padding: globalMargins.xtiny}}
        >
          <Text type="BodySmallSemibold">Pending</Text>
        </Box2>
      )}
      <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
        <CounterpartyIcon
          counterparty={props.counterparty}
          counterpartyType={props.counterpartyType}
          large={props.large}
        />
        <Box2 direction="vertical" fullHeight={true} style={styles.rightContainer}>
          <Timestamp relative={true} timestamp={props.timestamp} />
          <Detail
            large={props.large}
            pending={pending}
            yourRole={props.yourRole}
            counterparty={props.counterparty}
            counterpartyType={props.counterpartyType}
            amountUser={props.amountUser}
          />
          {// TODO: Consolidate memo display code below with
          // chat/conversation/messages/wallet-payment/index.js.
          showMemo && (
            <Box2 direction="horizontal" gap="small" fullWidth={true}>
              <Divider vertical={true} style={styles.quoteMarker} />
              <Markdown allowFontScaling={true}>{props.memo}</Markdown>
            </Box2>
          )}
          <AmountXLM pending={pending} yourRole={props.yourRole} amountXLM={props.amountXLM} />
        </Box2>
      </Box2>
    </Box2>
  )
}

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  quoteMarker: {maxWidth: 3, minWidth: 3},
  rightContainer: {
    flex: 1,
    marginLeft: globalMargins.tiny,
  },
})

export default Transaction
