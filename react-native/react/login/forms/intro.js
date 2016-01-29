/* @flow */

import React, {Component} from '../../base-react'
import {connect} from 'react-redux'
import Render from './intro.render'

class Intro extends Component {
  render (): ReactElement {
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
    onSignup: () => {},
    onLogin: () => {}
  })
)(Intro)
