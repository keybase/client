/* @flow */

import React, {Component} from '../base-react'
import Header from '../common-adapters/header'
import resolveAssets from '../../../desktop/resolve-assets'

import type {Styled} from '../styles/common'
import type {HeaderProps} from './header.render'

export default class HeaderRender extends Component {
  props: HeaderProps & Styled;

  render () {
    return (
      <Header
        style={{...this.props.style, ...styles.header}}
        icon={`file://${resolveAssets('../react-native/react/images/service/keybase.png')}`}
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
