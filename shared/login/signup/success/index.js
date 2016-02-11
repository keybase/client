/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import SecureString from '../../../util/secure-string'

import Render from './index.render'

class Success extends Component {
  render (): ReactElement {
    return (
      <Render
        paperkey={this.props.paperkey}
        onFinish={this.props.onFinish}/>
    )
  }
}

Success.propTypes = {
  paperkey: React.PropTypes.instanceOf(SecureString).isRequired,
  onFinish: React.PropTypes.func.isRequired
}

export default connect(
  state => ({paperkey: state.signup.paperkey}),
  // TODO
  dispatch => ({onFinish: () => console.log('TODO: do something here. Finished signup in!')})
)(Success)
