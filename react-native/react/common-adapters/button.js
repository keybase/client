'use strict'
/* @flow */

import React, { Component, Text, TouchableHighlight } from 'react-native'
import commonStyles, {buttonHighlight} from '../styles/common'

export default class Button extends Component {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <TouchableHighlight underlayColor={buttonHighlight} onPress={this.props.onPress}>
        {this.props.children ? this.props.children : <Text style={[commonStyles.button, this.props.buttonStyle]}>{this.props.title}</Text>}
      </TouchableHighlight>
    )
  }
}

Button.propTypes = {
  onPress: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  buttonStyle: React.PropTypes.object,
  children: React.PropTypes.array
}
