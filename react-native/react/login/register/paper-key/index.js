'use strict'

import React, {Component} from '../../../base-react'
import {connect} from '../../../base-redux'
import Render from './index.render'

class PaperKey extends Component {
  render () {
    return (
      <Render
        onSubmit={this.props.onSubmit}
      />
    )
  }
}

PaperKey.propTypes = {
  onSubmit: React.PropTypes.func.isRequired
}

export default connect(
  state => state,
  null,
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...ownProps,
      ...ownProps.mapStateToProps(stateProps),
      ...dispatchProps
    }
  }
)(PaperKey)
