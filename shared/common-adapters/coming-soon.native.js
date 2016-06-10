// @flow

import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'
import Box from './box'
import Text from './text'
import type {Props} from './coming-soon'

class ComingSoon extends Component<void, Props, void> {
  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center', flex: 1}}>
        <Text type='Header'>Coming soon!</Text>
      </Box>
    )
  }
}

export default ComingSoon
