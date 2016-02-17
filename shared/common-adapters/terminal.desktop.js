// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'

import type {Props} from './terminal'

export default class Terminal extends Component {
  props: Props;

  render () {
    const style = {...styles.container, ...(this.props.dz2 ? styles.DZ2 : {})}
    return (
      <div style={{...style, ...this.props.style}}>
        {this.props.children}
      </div>
    )
  }
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
    backgroundColor: globalColorsDZ2.darkBlue3,
  }
}

Terminal.propTypes = {
  children: React.PropTypes.node
}
