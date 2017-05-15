// @flow
import Box from './box'
import React, {Component} from 'react'
import type {Props, Context} from './terminal'
import {globalStyles, globalColors} from '../styles'

class Terminal extends Component<void, Props, void> {
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
  backgroundColor: globalColors.midnightBlue,
  padding: 10,
  alignItems: 'flex-start',
}

export default Terminal
