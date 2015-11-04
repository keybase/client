'use strict'

import React from '../../base-react'
import BaseComponent from '../../base-component'
import AccountComponent from './account-render'

export default class Account extends BaseComponent {

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

