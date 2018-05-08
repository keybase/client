// @flow
import * as React from 'react'
import {Box2, Text} from '../../common-adapters'
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
    <Box2 direction="horizontal" fullWidth={true} style={styles.headerContainer}>
      <Box2 direction="horizontal" gap="tiny" style={styles.labelContainer}>
        <Box2 direction="vertical">
          <Text type="BodySemibold" lineClamp={1}>
            {props.sender} sent Lumens worth {props.sourceValue} to {props.receiver}
          </Text>
        </Box2>
      </Box2>
      <Text type="BodySmall" lineClamp={1}>
        {props.targetValue}
      </Text>
    </Box2>
  )
}

const styles = styleSheetCreate({
  headerContainer: {
    height: 48,
    padding: globalMargins.tiny,
    paddingRight: globalMargins.small,
  },
  labelContainer: {
    flex: 1,
  },
})

export default Transaction
