// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'
import {openAccountResetPage} from '../../../actions/login'
import type {Props} from './index.render'

class Passphrase extends Component<void, Props, void> {
  render () {
    return <Render {...this.props}
      onForgotPassphrase={() => {
        this.props.onForgotPassphrase()
        this.props.onBack()
      }}
      />
  }
}

export default connect(
  state => ({waitingForResponse: state.login.waitingForResponse}),
  dispatch => ({
    onForgotPassphrase: () => { dispatch(openAccountResetPage()) }
  })
)(Passphrase)
