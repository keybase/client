// @flow
import React, {Component} from 'react'
import {Box, Text} from '../../common-adapters'

class LogSendRender extends Component {
  render() {
    return (
      <Box>
        <Text type="Header">How to Log Send:</Text>
        <Text type="Body">
          Run this in a terminal, and follow instructions.
        </Text>
        <Text type="Terminal">keybase log send</Text>
      </Box>
    )
  }
}

export default LogSendRender
