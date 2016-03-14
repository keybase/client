/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import HiddenString from '../../../util/hidden-string'
import {sawPaperKey} from '../../../actions/signup'

import Render from './index.render'

class Success extends Component {
  render () {
    return (
      <Render
        paperkey={this.props.paperkey}
        onFinish={this.props.onFinish}/>
    )
  }
}

Success.propTypes = {
  paperkey: React.PropTypes.instanceOf(HiddenString).isRequired,
  onFinish: React.PropTypes.func.isRequired
}

export default connect(
  state => ({paperkey: state.signup.paperkey}),
  dispatch => ({onFinish: () => dispatch(sawPaperKey())})
)(Success)
