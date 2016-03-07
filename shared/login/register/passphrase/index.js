// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'
import {cancelLogin} from '../../../actions/login'
import type {Props} from './index.render'

class Passphrase extends Component<void, Props, void> {
  render () {
    return <Render {...this.props} />
  }
}

export default connect(
  state => ({}),
  dispatch => ({
    onBack: () => dispatch(cancelLogin())
  })
)(Passphrase)
