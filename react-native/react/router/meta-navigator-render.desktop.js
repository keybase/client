'use strict'

import React from '../base-react'
import { connect } from '../base-redux'

export default function () {
  const { store, rootComponent, uri, NavBar, Navigator } = this.props
  let {componentAtTop, routeStack} = this.getComponentAtTop(rootComponent, store, uri)

  return React.createElement(connect(componentAtTop.mapStateToProps || (state => state))(componentAtTop.component), {...componentAtTop.props})
}
