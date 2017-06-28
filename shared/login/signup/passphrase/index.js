// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {bindActionCreators} from 'redux'
import {checkPassphrase, restartSignup} from '../../../actions/signup'
import {connect} from 'react-redux'

type State = {
  pass1: string,
  pass2: string,
}

type ContainerProps = {
  ...Props,
  checkPassphrase: (pass1: string, pass2: string) => void,
  restartSignup: () => void,
}

class PassphraseForm extends Component<void, ContainerProps, State> {
  state: State

  constructor(props: ContainerProps) {
    super(props)

    this.state = {
      pass1: '',
      pass2: '',
    }
  }

  render() {
    return (
      <Render
        passphraseError={this.props.passphraseError}
        pass1={this.state.pass1}
        pass1Update={pass1 => this.setState({pass1})}
        pass2={this.state.pass2}
        pass2Update={pass2 => this.setState({pass2})}
        onSubmit={() => this.props.checkPassphrase(this.state.pass1, this.state.pass2)}
        onBack={this.props.restartSignup}
      />
    )
  }
}

// $FlowIssue type this connector
export default connect(
  state => ({
    passphraseError: state.signup.passphraseError,
  }),
  dispatch => bindActionCreators({checkPassphrase, restartSignup}, dispatch)
)(PassphraseForm)
