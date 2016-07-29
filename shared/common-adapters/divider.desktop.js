// @flow
import React, {Component} from 'react'
import type {Props} from './divider'
import {globalColors} from '../styles/style-guide'

class Divider extends Component<void, Props, void> {
  render () {
    const orientationStyle = this.props.vertical
      ? {maxWidth: 1, minWidth: 1}
      : {maxHeight: 1, minHeight: 1}

    return (
      <div key={this.props.key} style={{...styles.divider, ...orientationStyle, ...this.props.style}} />
    )
  }
}

const styles = {
  divider: {
    backgroundColor: globalColors.black_10,
    flex: 1,
  },
}

export default Divider
