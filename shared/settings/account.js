import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './account.render'

class Account extends Component {
  render () {
    return (
      <Render
        email={this.props.email}
        emailVerified={this.props.emailVerified}
        onSave={this.props.onSave}
        passphraseError={this.props.passphraseError}
        emailError={this.props.emailError}
      />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {
        title: 'Account',
        // Dummy data
        props: {
          email: 'kb-dawg@keybase.io',
          emailVerified: true,
        },
      },
    }
  }
}

Account.propTypes = {
  email: React.PropTypes.string.isRequired,
  emailVerified: React.PropTypes.bool.isRequired,
  onSave: React.PropTypes.func.isRequired,
  passphraseError: React.PropTypes.string,
  emailError: React.PropTypes.string,
}

export default connect(
  null,
  dispatch => {
    // dummy action
    return {
      onSave: (email, oldPassphrase, newPassphrase, newPassphraseRepeat) => { console.log('saved! email:', email) },
    }
  }
)(Account)
