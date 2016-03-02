// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'

import type {Props, Context} from './terminal'

export default class Terminal extends Component {
  props: Props;

  getChildContext (): Context {
    return {
      inTerminal: true
    }
  }

  render () {
    const style = {...styles.container, ...styles.DZ2}
    return (
      <div style={{...style, ...this.props.style}}>
        {this.props.children}
      </div>
    )
  }
}

Terminal.childContextTypes = {
  inTerminal: React.PropTypes.bool
}

Terminal.propTypes = {
  style: React.PropTypes.object
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    color: globalColors.white,
    backgroundColor: globalColors.grey1,
    padding: 10,
    justifyContent: 'stretch',
    alignItems: 'flex-start'
  },

  DZ2: {
    backgroundColor: globalColorsDZ2.darkBlue3
  }
}

Terminal.propTypes = {
  children: React.PropTypes.node
}
