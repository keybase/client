// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {connect} from 'react-redux'

class UsernameOrEmail extends Component<void, Props, void> {
  render () {
    return <Render {...this.props} />
  }
}

export default connect(
  state => ({waitingForResponse: state.login.waitingForResponse})
)(UsernameOrEmail)
