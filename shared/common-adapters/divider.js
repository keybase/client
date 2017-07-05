// @flow
import React, {Component} from 'react'
import Box from './box'
import {globalColors} from '../styles'

import type {Props} from './divider'

class Divider extends Component<void, Props, void> {
  render() {
    const orientationStyle = this.props.vertical ? {maxWidth: 1, minWidth: 1} : {maxHeight: 1, minHeight: 1}

    return <Box style={{...styles.divider, ...orientationStyle, ...this.props.style}} />
  }
}

const styles = {
  divider: {
    backgroundColor: globalColors.black_05,
    flex: 1,
  },
}

export default Divider
