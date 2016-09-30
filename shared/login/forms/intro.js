// @flow
import React, {Component} from 'react'
import Render from './intro.render'
import {connect} from 'react-redux'
import {routeAppend} from '../../actions/router'
import {setRevokedSelf, setDeletedSelf, setLoginFromRevokedDevice, login} from '../../actions/login'

import type {TypedState} from '../../constants/reducer'

class Intro extends Component<*, *, *> {
  render () {
    return (
      <Render onSignup={this.props.onSignup} onLogin={this.props.onLogin} loaded={this.props.loaded} justLoginFromRevokedDevice={this.props.justLoginFromRevokedDevice} justRevokedSelf={this.props.justRevokedSelf} justDeletedSelf={this.props.justDeletedSelf} />
    )
  }
}

Intro.propTypes = {
  onLogin: React.PropTypes.func.isRequired,
  onSignup: React.PropTypes.func.isRequired,
}

export default connect(
  (state: TypedState) => ({
    justLoginFromRevokedDevice: state.login.justLoginFromRevokedDevice,
    justRevokedSelf: state.login.justRevokedSelf,
    justDeletedSelf: state.login.justDeletedSelf,
    loaded: state.login.loaded,
  }),
  (dispatch: any) => ({
    onSignup: () => {
      dispatch(setLoginFromRevokedDevice(''))
      dispatch(setRevokedSelf(''))
      dispatch(setDeletedSelf(''))
      dispatch(routeAppend('signup'))
    },
    onLogin: () => {
      dispatch(setLoginFromRevokedDevice(''))
      dispatch(setRevokedSelf(''))
      dispatch(setDeletedSelf(''))
      dispatch(login())
    },
  })
)(Intro)
