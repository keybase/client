// @flow
import * as React from 'react'
import {Avatar, Box2, Text} from '../../common-adapters'
import {globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../styles'
// TODO: Format relative dates.
import {formatTimeForPopup} from '../../util/timestamp'

type Role = 'sender' | 'receiver'
type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'wallet'

type IconProps = {|
  large: boolean,
  counterparty: string,
  counterpartyType: CounterpartyType,
|}

const Icon = (props: IconProps) => {
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return <Avatar username={props.counterparty} size={props.large ? 48 : 32} />
    case 'stellarPublicKey':
      // TODO: Return anonymous user icon.
      return null
    case 'wallet':
      // TODO: Return wallet icon.
      return null
    default:
      return null
  }
}

type DetailProps = {|
  large: boolean,
  yourRole: Role,
  counterparty: string,
  counterpartyType: CounterpartyType,
  amountUser: string,
|}

const Detail = (props: DetailProps) => {
  const textType = props.large ? 'Body' : 'BodySmall'
  const textTypeSemibold = props.large ? 'BodySemibold' : 'BodySmallSemibold'

  let counterparty
  switch (props.counterpartyType) {
    case 'keybaseUser':
      // TODO: Color counterparty based on following status.
      counterparty = <Text type={textTypeSemibold}>{props.counterparty}</Text>
      break
    case 'stellarPublicKey':
      const counterpartyStr = props.counterparty.substr(0, 6) + '...' + props.counterparty.substr(-5)
      counterparty = <Text type={textType}>{counterpartyStr}</Text>
      break
    case 'wallet':
      counterparty = <Text type={textType}>{props.counterparty}</Text>
      break
    default:
      counterparty = <Text type={textTypeSemibold}>TODO {props.counterparty}</Text>
      break
  }

  if (props.counterpartyType === 'wallet') {
    if (props.yourRole === 'sender') {
      return (
        <Text type={textType}>
          You transferred Lumens worth
          <Text type={textTypeSemibold}> {props.amountUser} </Text>
          from this wallet to
          {counterparty}.
        </Text>
      )
    }

    return (
      <Text type={textType}>
        You transferred Lumens worth
        <Text type={textTypeSemibold}> {props.amountUser} </Text>
        from {counterparty} to this wallet.
      </Text>
    )
  }

  if (props.yourRole === 'sender') {
    return (
      <Text type={textType}>
        You sent Lumens worth
        <Text type={textTypeSemibold}> {props.amountUser} </Text>
        to
        {counterparty}.
      </Text>
    )
  }

  return (
    <Text type={textType}>
      {counterparty}
      sent you Lumens worth
      <Text type={textTypeSemibold}> {props.amountUser}</Text>.
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
    : props.yourRole === 'sender' ? globalColors.red : globalColors.green
  const amount = `${props.yourRole === 'sender' ? '-' : '+'} ${props.amountXLM}`
    // Replace spaces with non-breaking spaces.
    .replace(/ /g, '\u00a0')
  return (
    <Text style={{color}} type="BodyExtrabold">
      {amount}
    </Text>
  )
}

export type Props = {|
  ...$Exact<DetailProps>,
  ...$Exact<IconProps>,
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  amountXLM: string,
  note: string,
|}

export const Transaction = (props: Props) => (
  <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
    <Icon counterparty={props.counterparty} counterpartyType={props.counterpartyType} large={props.large} />
    <Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.rightContainer}>
      <Text type="BodySmall">{props.timestamp ? formatTimeForPopup(props.timestamp) : 'Pending'}</Text>
      <Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.rightDownContainer}>
        <Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.detailContainer}>
          <Detail
            large={props.large}
            yourRole={props.yourRole}
            counterparty={props.counterparty}
            counterpartyType={props.counterpartyType}
            amountUser={props.amountUser}
          />
          {props.large && (
            <Text style={styles.note} type="Body">
              {props.note}
            </Text>
          )}
        </Box2>
        <AmountXLM pending={!props.timestamp} yourRole={props.yourRole} amountXLM={props.amountXLM} />
      </Box2>
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  detailContainer: {},
  note: platformStyles({
    // TODO: Consider using markdown quoting.
    common: {
      marginTop: globalMargins.xtiny,
    },
    isElectron: {borderLeft: `3px solid ${globalColors.lightGrey2}`, paddingLeft: 8},
    isMobile: {borderLeftColor: globalColors.lightGrey2, borderLeftWidth: 3, paddingLeft: 8},
  }),
  rightContainer: {
    marginLeft: globalMargins.tiny,
  },
  rightDownContainer: {},
})

export default Transaction
