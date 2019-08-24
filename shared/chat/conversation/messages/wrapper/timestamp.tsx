import * as React from 'react'
import {Text, Box} from '../../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'

export type Props = {
  timestamp: string
}

class Timestamp extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={styleBox}>
        <Text style={styleText} type="BodySmallSemibold">
          {this.props.timestamp}
        </Text>
      </Box>
    )
  }
}

const styleBox = {
  ...globalStyles.flexBoxCenter,
}

const styleText = {
  backgroundColor: globalColors.fastBlank,
  color: globalColors.black_50_on_white,
  padding: globalMargins.tiny,
}
export default Timestamp
