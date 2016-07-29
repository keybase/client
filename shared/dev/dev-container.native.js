// @flow
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import {globalColors} from '../styles/style-guide'

class Container extends Component {
  render () {
    return (
      <Box>
        <Text type='Header' style={{backgroundColor: globalColors.blue, padding: 10, textAlign: 'center'}}>{this.props.title}</Text>
        <Box style={{margin: 10, ...this.props.style}}>
          {this.props.children}
        </Box>
      </Box>
    )
  }
}

export default Container
