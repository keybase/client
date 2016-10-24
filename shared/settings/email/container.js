// @flow
import React, {Component} from 'react'
import UpdateEmail from './index'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/router'
import {onSubmitNewEmail, onChangeNewEmail} from '../../actions/settings'

import type {Props} from './index'
import type {TypedState} from '../../constants/reducer'

class UserEmailContainer extends Component<void, Props, void> {
  static parseRoute () {
    return {
      componentAtTop: {title: 'Change Email'},
    }
  }

  render () {
    return <UpdateEmail {...this.props} />
  }
}

export default connect(
  (state: TypedState, ownProps: {}) => {
    const {emails, errorMessage, newEmail} = state.settings.email
    if (emails.length > 0) {
      const email = emails[0].email
      return {
        email,
        isVerified: emails[0].isVerified,
        edited: newEmail && newEmail !== email,
        errorMessage,
      }
    }
    return {}
  },
  (dispatch: any, ownProps: {}) => ({
    onChangeNewEmail: (email: string) => dispatch(onChangeNewEmail(email)),
    onBack: () => dispatch(navigateUp()),
    onSave: () => dispatch(onSubmitNewEmail()),
  })
)(UserEmailContainer)
