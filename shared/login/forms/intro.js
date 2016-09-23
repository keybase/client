// @flow
import React, {Component} from 'react'
import Render from './intro.render'
import {connect} from 'react-redux'
import {routeAppend} from '../../actions/router'
import {retryBootstrap} from '../../actions/config'
import {setRevokedSelf, setLoginFromRevokedDevice, login} from '../../actions/login'

import type {TypedState} from '../../constants/reducer'

class Intro extends Component<*, *, *> {
  render () {
    return (
      <Render onSignup={this.props.onSignup} onLogin={this.props.onLogin} onRetry={this.props.onRetry} bootStatus={this.props.bootStatus} justLoginFromRevokedDevice={this.props.justLoginFromRevokedDevice} justRevokedSelf={this.props.justRevokedSelf} />
    )
  }
}

Intro.propTypes = {
  onLogin: React.PropTypes.func.isRequired,
  onSignup: React.PropTypes.func.isRequired,
  onRetry: React.PropTypes.func.isRequired,
  bootStatus: React.PropTypes.string.isRequired,
}

export default connect(
  (state: TypedState) => ({
    justLoginFromRevokedDevice: state.login.justLoginFromRevokedDevice,
    justRevokedSelf: state.login.justRevokedSelf,
    bootStatus: state.config.bootStatus,
  }),
  (dispatch: any) => ({
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
    onRetry: () => {
      dispatch(retryBootstrap())
    },
  })
)(Intro)
