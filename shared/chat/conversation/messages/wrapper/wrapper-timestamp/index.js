// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters'
import Timestamp from '../timestamp'
import {globalStyles, globalColors, styleSheetCreate} from '../../../../../styles'
import ReactionsRow from '../../reactions-row/container'
import type {WrapperTimestampProps} from '../index.types'

class WrapperTimestamp extends React.PureComponent<WrapperTimestampProps> {
  componentDidUpdate(prevProps: WrapperTimestampProps) {
    if (this.props.measure) {
      if (
        this.props.orangeLineAbove !== prevProps.orangeLineAbove ||
        this.props.timestamp !== prevProps.timestamp
      ) {
        this.props.measure()
      }
    }
  }
  render() {
    const props = this.props
    return (
      <Box style={styles.container}>
        {props.orangeLineAbove && <Box style={styles.orangeLine} />}
        {props.timestamp && <Timestamp timestamp={props.timestamp} />}
        {props.children}
        <ReactionsRow conversationIDKey={props.conversationIDKey} ordinal={props.ordinal} />
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  container: {...globalStyles.flexBoxColumn, width: '100%'},
  orangeLine: {backgroundColor: globalColors.orange, height: 1, width: '100%'},
})

export default WrapperTimestamp
