import React, {Component} from 'react'
import {connect} from 'react-redux'
import {registerWithUserPass, registerWithPaperKey, registerWithExistingDevice} from '../../actions/login'
import Render from './index.render'

class Register extends Component {
  render () {
    return (
      <Render
        onGotoExistingDevicePage={this.props.onGotoExistingDevicePage}
        onGotoPaperKeyPage={this.props.onGotoPaperKeyPage}
        onGotoUserPassPage={this.props.onGotoUserPassPage}
        onBack={this.props.onBack}
      />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {componentAtTop: {}}
  }
}

Register.propTypes = {
  onGotoExistingDevicePage: React.PropTypes.func.isRequired,
  onGotoPaperKeyPage: React.PropTypes.func.isRequired,
  onGotoUserPassPage: React.PropTypes.func.isRequired,
  onBack: React.PropTypes.func.isRequired
}

export default connect(
  null,
  dispatch => {
    return {
      onGotoExistingDevicePage: () => dispatch(registerWithExistingDevice()),
      onGotoPaperKeyPage: () => dispatch(registerWithPaperKey()),
      onGotoUserPassPage: () => dispatch(registerWithUserPass())
    }
  }
)(Register)
