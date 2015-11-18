'use strict'

import React, {Component} from '../../base-react'
import {connect} from '../../base-redux'
import {registerWithUserPass, registerWithPaperKey, registerWithExistingDevice} from '../../actions/login'
import Render from './index.render'

class Register extends Component {
  render () {
    return (
      <Render
        onGotoExistingDevicePage={() => this.props.dispatch(registerWithExistingDevice())}
        onGotoPaperKeyPage={() => this.props.dispatch(registerWithPaperKey())}
        onGotoUserPassPage={() => this.props.dispatch(registerWithUserPass())}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return { componentAtTop: {} }
  }
}

Register.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

export default connect(
  null,
  dispatch => {
    return {
      gotoExistingDevicePage: () => dispatch(registerWithExistingDevice()),
      gotoPaperKeyPage: () => dispatch(registerWithPaperKey()),
      gotoUserPassPage: () => dispatch(registerWithUserPass())
    }
  }
)(Register)
