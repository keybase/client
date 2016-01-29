/* @flow */

import React, {Component} from 'react'
import {Header} from '../common-adapters'

import type {Styled} from '../styles/common'
import type {HeaderProps} from './header.render'

export default class HeaderRender extends Component {
  props: HeaderProps & Styled;

  render () {
    return (
      <Header
        style={{...this.props.style, ...styles.header}}
        icon
        title={this.props.reason}
        onClose={this.props.onClose}
      />
    )
  }
}

HeaderRender.propTypes = {
  reason: React.PropTypes.string,
  onClose: React.PropTypes.func.isRequired,
  style: React.PropTypes.object.isRequired
}

const styles = {
  header: {
    paddingLeft: 15
  }
}
