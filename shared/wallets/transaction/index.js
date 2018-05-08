// @flow
import * as React from 'react'
import {Avatar, Box2, Text} from '../../common-adapters'
import {globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../styles'
// TODO: Format relative dates.
import {formatTimeForPopup} from '../../util/timestamp'

type Role = 'sender' | 'receiver'

type DetailProps = {|
  yourRole: Role,
  counterparty: string,
  amountUser: string,
|}

const Detail = (props: DetailProps) => {
  // TODO: Color counterparty based on following status.
  if (props.yourRole === 'sender') {
    return (
      <Text type="Body">
        You sent Lumens worth
        <Text type="BodySemibold"> {props.amountUser} </Text>
        to
        <Text type="BodySemibold"> {props.counterparty}</Text>.
      </Text>
    )
  }

  return (
    <Text type="Body">
      <Text type="BodySemibold">{props.counterparty} </Text>
      sent you Lumens worth
      <Text type="BodySemibold"> {props.amountUser}</Text>.
    </Text>
  )
}

type AmountXLMProps = {|
  yourRole: Role,
  amountXLM: string,
|}

const AmountXLM = (props: AmountXLMProps) => {
  const color = props.yourRole === 'sender' ? globalColors.red : globalColors.green
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
  timestamp: Date,
  amountXLM: string,
  note: string,
|}

export const Transaction = (props: Props) => (
  <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
    <Avatar username={props.counterparty} size={48} />
    <Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.rightContainer}>
      <Text type="BodySmall">{formatTimeForPopup(props.timestamp)}</Text>
      <Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.rightDownContainer}>
        <Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.detailContainer}>
          <Detail yourRole={props.yourRole} counterparty={props.counterparty} amountUser={props.amountUser} />
          <Text style={styles.note} type="Body">
            {props.note}
          </Text>
        </Box2>
        <AmountXLM yourRole={props.yourRole} amountXLM={props.amountXLM} />
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
