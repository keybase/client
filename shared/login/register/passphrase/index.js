// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'
import {openAccountResetPage} from '../../../actions/login'
import type {Props} from './index.render'

type State = {
  showTyping: boolean,
  saveInKeychain: boolean,
  passphrase: ?string
}

class Passphrase extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {showTyping: false, saveInKeychain: false, passphrase: null}
  }

  onChange (passphrase: string) {
    this.setState({passphrase})
  }

  render () {
    return <Render {...this.props}
      onForgotPassphrase={() => {
        this.props.onForgotPassphrase()
        this.props.onBack()
      }}
      passphrase={this.state.passphrase}
      onSubmit={() => this.props.onSubmit(this.state.passphrase || '')}
      onChange={p => this.onChange(p)}
      saveInKeychain={this.state.saveInKeychain}
      showTyping={this.state.showTyping}
      toggleShowTyping={showTyping => this.setState({showTyping})}
      toggleSaveInKeychain={saveInKeychain => this.setState({saveInKeychain})} />
  }
}

export default connect(
  state => ({waitingForResponse: state.login.waitingForResponse}),
  dispatch => ({
    onForgotPassphrase: () => { dispatch(openAccountResetPage()) },
  })
)(Passphrase)
