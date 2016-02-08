/* @flow */

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

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
  passphraseError: React.PropTypes.func,
  checkPassphrase: React.PropTypes.func
}

export default connect(
  state => ({
    passphraseError: state.signup.passphraseError
  }),
  dispatch => bindActionCreators({checkPassphrase}, dispatch)
)(PassphraseForm)
