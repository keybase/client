// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Text, Box} from '../../../../common-adapters'
import {globalStyles, globalColors} from '../../../../styles'

export type Props = {
  message: Types.MessageError,
}

class Error extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={errorStyle}>
        <Text type="BodySmallItalic" style={textStyle}>
          {this.props.message.reason}
        </Text>
      </Box>
    )
  }
}

const textStyle = {
  color: globalColors.red,
}

const errorStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  padding: 5,
}

export default Error
