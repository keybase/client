// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as LoginGen from '../../actions/login-gen'
import * as Constants from '../../constants/provision'
import HiddenString from '../../util/hidden-string'
import Passphrase from '.'
import React, {Component} from 'react'
import {connect} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'
import * as WaitingConstants from '../../constants/waiting'

type OwnProps = RouteProps<{}, {}>

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

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  waitingForResponse: WaitingConstants.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onForgotPassphrase: () => dispatch(LoginGen.createLaunchForgotPasswordWebPage()),
  onSubmit: (passphrase: string) =>
    dispatch(ProvisionGen.createSubmitPassphrase({passphrase: new HiddenString(passphrase)})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(_Passphrase)
