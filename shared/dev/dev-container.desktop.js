/* @flow */
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'

export default class Container extends Component {
  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, boxShadow: 'rgba(0, 0, 0, 0.298039) 0px 19px 60px, rgba(0, 0, 0, 0.219608) 0px 15px 20px'}}>
        <Box style={{backgroundColor: globalColors.blue, paddingLeft: 40}}>
          <Text type='HeaderJumbo' backgroundMode='Terminal'>{this.props.title}</Text>
        </Box>

        <Box style={{margin: 10}}>
          {this.props.children}
        </Box>
      </Box>
    )
  }
}
