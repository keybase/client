// @flow
import * as Creators from '../../../actions/login/creators'
import HiddenString from '../../../util/hidden-string'
import Passphrase from '.'
import React, {Component} from 'react'
import {connect} from 'react-redux'

import type {TypedState} from '../../../constants/reducer'

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

// TODO remove this class
class _Passphrase extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {showTyping: false, passphrase: null}
  }

  onChange(passphrase: string) {
    this.setState({passphrase})
  }

  render() {
    return (
      <Passphrase
        error={this.props.error}
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
        toggleShowTyping={showTyping => this.setState({showTyping})}
      />
    )
  }
}

const mapStateToProps = (state: TypedState) => ({
  waitingForResponse: state.engine.get('rpcWaitingStates').get('loginRpc'),
})

const mapDispatchToProps = (dispatch: any) => ({
  onForgotPassphrase: () => {
    dispatch(Creators.openAccountResetPage())
  },
  onBack: () => dispatch(Creators.onBack()),
  onSubmit: passphrase => dispatch(Creators.submitPassphrase(new HiddenString(passphrase), false)),
})

const mergeProps = (stateProps, dispatchProps, {routeProps}) => ({
  ...stateProps,
  ...dispatchProps,
  ...routeProps,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(_Passphrase)
