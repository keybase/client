/* @flow */

import React, {Component} from '../base-react'
import path from 'path'
import type {Styled} from '../styles/common'
import Header from '../common-adapters/header'

import type {HeaderProps} from './header.render.types'

export default class HeaderRender extends Component {
  props: HeaderProps & Styled;

  render () {
    return (
      <Header
        style={{...this.props.style, ...styles.header}}
        icon={`file:///${path.resolve(__dirname, '../images/service/keybase.png')}`}
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
