/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import SecureString from '../../../util/secure-string'

import Render from './index.render'
import {checkPassphrase} from '../../../actions/signup'

class PassphraseForm extends Component {
  render (): ReactElement {
    return (
      <Render
        passphraseError={this.props.passphraseError}
        checkPassphrase={this.props.checkPassphrase}/>
    )
  }
}

PassphraseForm.propTypes = {
  passphraseError: React.PropTypes.instanceOf(SecureString),
  checkPassphrase: React.PropTypes.func
}

export default connect(
  state => ({
    passphraseError: state.signup.passphraseError
  }),
  dispatch => bindActionCreators({checkPassphrase}, dispatch)
)(PassphraseForm)
