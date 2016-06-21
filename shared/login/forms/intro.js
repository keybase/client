/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './intro.render'
import {routeAppend} from '../../actions/router'
import {setRevokedSelf} from '../../actions/login'
import {login} from '../../actions/login'

class Intro extends Component {
  render () {
    return (
      <Render onSignup={this.props.onSignup} onLogin={this.props.onLogin} justRevokedSelf={this.props.justRevokedSelf} />
    )
  }
}

Intro.propTypes = {
  onLogin: React.PropTypes.func.isRequired,
  onSignup: React.PropTypes.func.isRequired,
}

export default connect(
  state => ({justRevokedSelf: state.login.justRevokedSelf}),
  dispatch => ({
    onSignup: () => {
      dispatch(setRevokedSelf(''))
      dispatch(routeAppend('signup'))
    },
    onLogin: () => {
      dispatch(setRevokedSelf(''))
      dispatch(login())
    },
  })
)(Intro)
