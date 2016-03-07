/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './intro.render'
import {routeAppend} from '../../actions/router'
import {login} from '../../actions/login'

class Intro extends Component {
  render () {
    return (
      <Render onSignup={this.props.onSignup} onLogin={this.props.onLogin}/>
    )
  }
}

Intro.propTypes = {
  onLogin: React.PropTypes.func.isRequired,
  onSignup: React.PropTypes.func.isRequired
}

export default connect(
  state => ({}),
  dispatch => ({
    onSignup: () => { dispatch(routeAppend('signup')) },
    onLogin: () => { dispatch(login()) }
  })
)(Intro)
