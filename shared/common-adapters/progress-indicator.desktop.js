/* @flow */

import React, {Component} from 'react'
import type {Props} from './progress-indicator'
import Icon from './icon'
import type {IconType} from './icon'

export default class ProgressIndicator extends Component {
  props: Props;

  render () {
    let type: IconType
    if (__SCREENSHOT__) {
      type = this.props.white ? 'icon-progress-white-static' : 'icon-progress-grey-static'
    } else {
      type = this.props.white ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'
    }
    return <Icon style={this.props.style} type={type} />
  }
}
