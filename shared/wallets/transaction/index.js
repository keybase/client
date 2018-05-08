// @flow
import * as React from 'react'
import {Avatar, Box2, Text} from '../../common-adapters'
import {globalMargins, styleSheetCreate} from '../../styles'
// TODO: Format relative dates.
import {formatTimeForPopup} from '../../util/timestamp'

type DetailProps = {|
  yourRole: 'sender' | 'receiver',
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
          <Text type="Body">{props.note}</Text>
        </Box2>
        <Text type="BodySmall" lineClamp={1}>
          {props.amountXLM}
        </Text>
      </Box2>
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    border: 'solid 1px black',
    minHeight: 80,
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  detailContainer: {
    border: 'solid 1px black',
  },
  rightContainer: {
    border: 'solid 1px black',
    marginLeft: globalMargins.tiny,
  },
  rightDownContainer: {
    border: 'solid 1px black',
  },
})

export default Transaction
