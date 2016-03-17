/* @flow */

import React, {Component} from 'react'
import type {Props} from './progress-indicator'
import Icon from './icon'

export default class ProgressIndicator extends Component {
  props: Props;

  render () {
    return <Icon style={this.props.style} type={this.props.white ? 'progress-white' : 'progress-grey'} />
  }
}
