// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import Box from './box'
import type {Props, Context} from './terminal'

export default class Terminal extends Component {
  props: Props;

  getChildContext (): Context {
    return {
      inTerminal: true,
    }
  }

  render () {
    return (
      <Box style={{...styles.container, ...this.props.style}}>
        {this.props.children}
      </Box>
    )
  }
}

Terminal.childContextTypes = {
  inTerminal: React.PropTypes.bool,
}

Terminal.propTypes = {
  style: React.PropTypes.object,
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.darkBlue3,
    padding: 10,
    alignItems: 'flex-start',
  },
}
