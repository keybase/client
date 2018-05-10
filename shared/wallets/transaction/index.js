// @flow
import * as React from 'react'
import {Avatar, Box2, Text} from '../../common-adapters'
import {globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../styles'
// TODO: Format relative dates.
import {formatTimeForPopup} from '../../util/timestamp'

type Role = 'sender' | 'receiver'
type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'wallet'

type IconProps = {|
  counterparty: string,
  counterpartyType: CounterpartyType,
|}

const Icon = (props: IconProps) => {
  switch (props.counterpartyType) {
    case 'keybaseUser':
      return <Avatar username={props.counterparty} size={48} />
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
  yourRole: Role,
  counterparty: string,
  counterpartyType: CounterpartyType,
  amountUser: string,
|}

const Detail = (props: DetailProps) => {
  let counterparty
  switch (props.counterpartyType) {
    case 'keybaseUser':
      // TODO: Color counterparty based on following status.
      counterparty = <Text type="BodySemibold">{props.counterparty}</Text>
      break
    case 'stellarPublicKey':
      const counterpartyStr = props.counterparty.substr(0, 6) + '...' + props.counterparty.substr(-5)
      counterparty = <Text type="Body">{counterpartyStr}</Text>
      break
    case 'wallet':
      counterparty = <Text type="Body">{props.counterparty}</Text>
      break
    default:
      counterparty = <Text type="BodySemibold">TODO {props.counterparty}</Text>
      break
  }

  if (props.counterpartyType === 'wallet') {
    if (props.yourRole === 'sender') {
      return (
        <Text type="Body">
          You transferred Lumens worth
          <Text type="BodySemibold"> {props.amountUser} </Text>
          from this wallet to
          {counterparty}.
        </Text>
      )
    }

    return (
      <Text type="Body">
        You transferred Lumens worth
        <Text type="BodySemibold"> {props.amountUser} </Text>
        from {counterparty} to this wallet.
      </Text>
    )
  }

  if (props.yourRole === 'sender') {
    return (
      <Text type="Body">
        You sent Lumens worth
        <Text type="BodySemibold"> {props.amountUser} </Text>
        to
        {counterparty}.
      </Text>
    )
  }

  return (
    <Text type="Body">
      {counterparty}
      sent you Lumens worth
      <Text type="BodySemibold"> {props.amountUser}</Text>.
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
  // A null timestamp means the transaction is still pending.
  timestamp: Date | null,
  amountXLM: string,
  note: string,
|}

export const Transaction = (props: Props) => (
  <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
    <Icon counterparty={props.counterparty} counterpartyType={props.counterpartyType} />
    <Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.rightContainer}>
      <Text type="BodySmall">{props.timestamp ? formatTimeForPopup(props.timestamp) : 'Pending'}</Text>
      <Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.rightDownContainer}>
        <Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.detailContainer}>
          <Detail
            yourRole={props.yourRole}
            counterparty={props.counterparty}
            counterpartyType={props.counterpartyType}
            amountUser={props.amountUser}
          />
          <Text style={styles.note} type="Body">
            {props.note}
          </Text>
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
