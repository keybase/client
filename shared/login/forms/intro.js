// @flow
import React, {Component} from 'react'
import Render from './intro.render'
import {connect} from 'react-redux'
import {routeAppend} from '../../actions/router'
import {setRevokedSelf, setLoginFromRevokedDevice, login} from '../../actions/login'

class Intro extends Component {
  render () {
    return (
      <Render onSignup={this.props.onSignup} onLogin={this.props.onLogin} loaded={this.props.loaded} justLoginFromRevokedDevice={this.props.justLoginFromRevokedDevice} justRevokedSelf={this.props.justRevokedSelf} />
    )
  }
}

Intro.propTypes = {
  onLogin: React.PropTypes.func.isRequired,
  onSignup: React.PropTypes.func.isRequired,
}

export default connect(
  state => ({
    justLoginFromRevokedDevice: state.login.justLoginFromRevokedDevice,
    justRevokedSelf: state.login.justRevokedSelf,
    loaded: state.login.loaded,
  }),
  dispatch => ({
    onSignup: () => {
      dispatch(setLoginFromRevokedDevice(''))
      dispatch(setRevokedSelf(''))
      dispatch(routeAppend('signup'))
    },
    onLogin: () => {
      dispatch(setLoginFromRevokedDevice(''))
      dispatch(setRevokedSelf(''))
      dispatch(login())
    },
  })
)(Intro)
