// @flow
import React, {Component} from 'react'
import RenderPassphrase from './index.render'
import {connect} from 'react-redux'
import {openAccountResetPage} from '../../../actions/login'

type State = {
  showTyping: boolean,
  passphrase: ?string,
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
    this.state = {showTyping: false, passphrase: null}
  }

  onChange (passphrase: string) {
    this.setState({passphrase})
  }

  render () {
    return <RenderPassphrase
      onBack={this.props.onBack}
      prompt={this.props.prompt}
      username={this.props.username}
      waitingForResponse={this.props.waitingForResponse}
      onForgotPassphrase={() => {
        this.props.onForgotPassphrase()
        this.props.onBack()
      }}
      passphrase={this.state.passphrase}
      onSubmit={() => this.props.onSubmit(this.state.passphrase || '')}
      onChange={p => this.onChange(p)}
      showTyping={this.state.showTyping}
      toggleShowTyping={showTyping => this.setState({showTyping})} />
  }
}

export default connect(
  (state: any, op: any) => ({waitingForResponse: state.login.waitingForResponse}),
  (dispatch: any, op: any) => ({
    onForgotPassphrase: () => { dispatch(openAccountResetPage()) },
  }),
  (stateProps, dispatchProps, {routeProps}) => ({...stateProps, ...dispatchProps, ...routeProps}),
)(Passphrase)
