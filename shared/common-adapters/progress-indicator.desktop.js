/* @flow */

import React, {Component} from 'react'
import type {Props} from './progress-indicator'
import Icon from './icon'

export default class ProgressIndicator extends Component {
  props: Props;

  render () {
    let type
    if (__SCREENSHOT__) {
      type = this.props.white ? 'progress-white-static' : 'progress-grey-static'
    } else {
      type = this.props.white ? 'progress-white' : 'progress-grey'
    }
    return <Icon style={this.props.style} type={type} />
  }
}
