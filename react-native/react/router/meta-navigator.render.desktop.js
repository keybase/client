'use strict'

import React, { Component } from '../base-react'
import { connect } from '../base-redux'

export default class MetaNavigatorRender extends Component {
  render () {
    const { store, rootComponent, uri, getComponentAtTop } = this.props
    const { componentAtTop } = getComponentAtTop(rootComponent, store, uri)

    return React.createElement(connect(componentAtTop.mapStateToProps || (state => { return {} }))(componentAtTop.component), {...componentAtTop.props})
  }
}

MetaNavigatorRender.propTypes = {
  uri: React.PropTypes.object.isRequired,
  store: React.PropTypes.object.isRequired,
  getComponentAtTop: React.PropTypes.func.isRequired,
  rootComponent: React.PropTypes.func.isRequired
}
