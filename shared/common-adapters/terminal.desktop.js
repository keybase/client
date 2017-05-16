// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles'
import Box from './box'

import type {Props, Context} from './terminal'

export default class Terminal extends Component<void, Props, void> {
  getChildContext(): Context {
    return {
      inTerminal: true,
    }
  }

  render() {
    return (
      <Box style={{...styleContainer, ...this.props.style}}>
        {this.props.children}
      </Box>
    )
  }
}

Terminal.childContextTypes = {
  inTerminal: React.PropTypes.bool,
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  color: globalColors.white,
  backgroundColor: globalColors.midnightBlue,
  padding: 10,
  alignItems: 'stretch',
  textAlign: 'left',
}
