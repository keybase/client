/* @flow */

import React, {Component} from 'react'
import {globalColors} from '../styles/style-guide'
import type {Props} from './divider'

export default class Divider extends Component {
  props: Props;

  render () {
    const orientationStyle = this.props.vertical
      ? {maxWidth: 1, minWidth: 1}
      : {maxHeight: 1, minHeight: 1}

    return (
      <div key={this.props.key} style={{...styles.divider, ...orientationStyle, ...this.props.style}} />
    )
  }
}

Divider.propTypes = {
  vertical: React.PropTypes.bool,
  style: React.PropTypes.object,
  key: React.PropTypes.object,
}

const styles = {
  divider: {
    backgroundColor: globalColors.black_10,
    flex: 1,
  },
}
