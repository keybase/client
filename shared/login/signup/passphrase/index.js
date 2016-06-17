/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import HiddenString from '../../../util/hidden-string'

import Render from './index.render'
import {checkPassphrase, resetSignup} from '../../../actions/signup'
import type {Props} from './index.render'

type State = {
  pass1: string,
  pass2: string
}

class PassphraseForm extends Component {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      pass1: '',
      pass2: '',
    }
  }

  render () {
    return (
      <Render
        passphraseError={this.props.passphraseError}
        pass1={this.state.pass1}
        pass1Update={pass1 => this.setState({pass1})}
        pass2={this.state.pass2}
        pass2Update={pass2 => this.setState({pass2})}
        onSubmit={() => this.props.checkPassphrase(this.state.pass1, this.state.pass2)}
        onBack={this.props.resetSignup}
        />
    )
  }
}

PassphraseForm.propTypes = {
  passphraseError: React.PropTypes.instanceOf(HiddenString),
  checkPassphrase: React.PropTypes.func,
}

export default connect(
  state => ({
    passphraseError: state.signup.passphraseError,
  }),
  dispatch => bindActionCreators({checkPassphrase, resetSignup}, dispatch)
)(PassphraseForm)
