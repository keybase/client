// @flow
import * as React from 'react'
import {Avatar, Box2, Text} from '../../common-adapters'
import {globalMargins, styleSheetCreate} from '../../styles'

export type Props = {
  sourceValue: string,
  targetValue: string,
  sender: string,
  receiver: string,
  note: string,
  timestamp: Date,
}

export const Transaction = (props: Props) => {
  return (
    <Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      <Avatar username={props.sender} size={48} />
      <Box2 direction="vertical" style={styles.rightContainer}>
        <Text type="Body">{props.timestamp.toString()}</Text>
        <Box2 direction="horizontal" fullWidth={true} style={styles.rightDownContainer}>
          <Box2 direction="vertical" style={styles.detailContainer}>
            <Text type="BodySemibold" lineClamp={1}>
              {props.sender} sent Lumens worth {props.sourceValue} to {props.receiver}
            </Text>
            <Text type="Body">{props.note}</Text>
          </Box2>
        </Box2>
        <Text type="BodySmall" lineClamp={1}>
          {props.targetValue}
        </Text>
      </Box2>
    </Box2>
  )
}

const styles = styleSheetCreate({
  container: {
    height: 64,
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  detailContainer: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  rightContainer: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  rightDownContainer: {
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
})

export default Transaction
