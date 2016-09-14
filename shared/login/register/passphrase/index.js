// @flow
import React, {Component} from 'react'
import Render from './index.render'
import {connect} from 'react-redux'
import {openAccountResetPage} from '../../../actions/login'

type State = {
  showTyping: boolean,
  saveInKeychain: boolean,
  passphrase: ?string
}

type Props = {
  prompt: string,
  onSubmit: (passphrase: string) => void,
  onBack: () => void,
  onForgotPassphrase: () => void,
  waitingForResponse: boolean,
  error?: ?string,
  username: ?string,
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
    return <Render
      onBack={this.props.onBack}
      prompt={this.props.prompt}
      username={this.props.prompt}
      waitingForResponse={this.props.waitingForResponse}
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
  (state: any, op: any) => ({waitingForResponse: state.login.waitingForResponse}),
  (dispatch: any, op: any) => ({
    onForgotPassphrase: () => { dispatch(openAccountResetPage()) },
  }),
  (stateProps, dispatchProps, ownProps) => ({...stateProps, ...dispatchProps, ...ownProps}),
)(Passphrase)
