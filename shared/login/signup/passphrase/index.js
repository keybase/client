// @flow
import * as Creators from '../../../actions/signup'
import React, {Component} from 'react'
import Render, {type Props} from './index.render'
import {connect, type TypedState} from '../../../util/container'

type State = {
  pass1: string,
  pass2: string,
}

type ContainerProps = {
  ...Props,
  checkPassphrase: (pass1: string, pass2: string) => void,
  restartSignup: () => void,
}

// TODO recompose
class PassphraseForm extends Component<ContainerProps, State> {
  state = {
    pass1: '',
    pass2: '',
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

const mapStateToProps = (state: TypedState) => ({
  passphraseError: state.signup.passphraseError,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  checkPassphrase: (pass1: string, pass2: string) => dispatch(Creators.checkPassphrase(pass1, pass2)),
  restartSignup: () => dispatch(Creators.restartSignup()),
})
export default connect(mapStateToProps, mapDispatchToProps)(PassphraseForm)
