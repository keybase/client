// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'

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
      <div style={{...styles.container, ...this.props.style}}>
        {this.props.children}
      </div>
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
    color: globalColors.white,
    backgroundColor: globalColors.darkBlue3,
    padding: 10,
    justifyContent: 'stretch',
    alignItems: 'flex-start',
  },
}

Terminal.propTypes = {
  children: React.PropTypes.node,
}
