'use strict'

import React, {Component} from '../../base-react'
import {connect} from '../../base-redux'
import AccountComponent from './account-render'

class Account extends Component {
  render () {
    return <AccountComponent {...this.props}/>
  }

  static parseRoute () {
    return {
      componentAtTop: {
        title: 'Account',
        // Dummy data
        props: {
          email: 'kb-dawg@keybase.io',
          emailVerified: true
        }
      }
    }
  }
}

Account.propTypes = {
  email: React.PropTypes.string.isRequired,
  emailVerified: React.PropTypes.bool.isRequired,
  onSave: React.PropTypes.func.isRequired,
  passphraseError: React.PropTypes.string,
  emailError: React.PropTypes.string
}

export default connect(
  null,
  dispatch => {
    // dummy action
    return {
      onSave: (email, oldPassphrase, newPassphrase, newPassphraseRepeat) => { console.log('saved! email:', email) }
    }
  }
)(Account)
