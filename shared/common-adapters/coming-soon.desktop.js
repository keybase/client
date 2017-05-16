// @flow
import Box from './box'
import React, {Component} from 'react'
import Text from './text'
import type {Props} from './coming-soon'
import {globalStyles} from '../styles'

class ComingSoon extends Component<void, Props, void> {
  render() {
    return (
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center', flex: 1}}>
        <Text type="Header">Coming soon!</Text>
      </Box>
    )
  }
}

export default ComingSoon
