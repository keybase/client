/* @flow */
import React, {Component} from 'react'
import {Box} from '../common-adapters'
import {Text} from 'react-native'

export default class Container extends Component {
  render () {
    return (
      <Box>
        <Text>{this.props.title}</Text>
        <Box style={{margin: 10}}>
          {this.props.children}
        </Box>
      </Box>
    )
  }
}

Container.propTypes = {
  title: React.PropTypes.string,
  style: React.PropTypes.object,
  children: React.PropTypes.node.isRequired
}
