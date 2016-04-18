// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'
import {openAccountResetPage} from '../../../actions/login'
import type {Props} from './index.render'

type State = {
  showTyping: boolean,
  saveInKeychain: boolean,
}

class Passphrase extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {showTyping: false, saveInKeychain: false}
  }

  render () {
    return <Render {...this.props}
      onForgotPassphrase={() => {
        this.props.onForgotPassphrase()
        this.props.onBack()
      }}
      saveInKeychain={this.state.saveInKeychain}
      showTyping={this.state.showTyping}
      toggleShowTyping={showTyping => this.setState({showTyping})}
      toggleSaveInKeychain={saveInKeychain => this.setState({saveInKeychain})}/>
  }
}

export default connect(
  state => ({waitingForResponse: state.login.waitingForResponse}),
  dispatch => ({
    onForgotPassphrase: () => { dispatch(openAccountResetPage()) }
  })
)(Passphrase)
