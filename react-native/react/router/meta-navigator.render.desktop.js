'use strict'

import React, { Component } from '../base-react'
import { connect } from '../base-redux'

export default class MetaNavigatorRender extends Component {
  render () {
    return React.createElement(
      connect(this.props.componentAtTop.mapStateToProps || (state => state))(this.props.componentAtTop.component),
        {...this.props.componentAtTop.props})
  }
}

MetaNavigatorRender.propTypes = {
  componentAtTop: React.PropTypes.object.isRequired
}

