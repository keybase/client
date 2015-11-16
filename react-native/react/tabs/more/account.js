'use strict'

import React, { Component } from '../../base-react'
import AccountComponent from './account-render'

export default class Account extends Component {

  render () {
    return <AccountComponent
      email={this.props.email}
      emailVerified={this.props.emailVerified}
      onSave={this.props.onSave}
      passphraseError={this.props.passphraseError}
      emailError={this.props.emailError}
    />
  }

  static parseRoute () {
    return {
      componentAtTop: {
        title: 'Account',
        // Dummy data
        props: {
          email: 'kb-dawg@keybase.io',
          emailVerified: true,
          onSave: (email, oldPassphrase, newPassphrase, newPassphraseRepeat) => {
            console.log('saved! email:', email)
          }
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
