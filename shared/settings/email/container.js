// @flow
import UpdateEmail from './index'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/router'
import {onSubmitNewEmail, onChangeNewEmail} from '../../actions/settings'
import Routable from '../../util/routable'

import type {TypedState} from '../../constants/reducer'

const UserEmailContainer = Routable(() => ({componentAtTop: {title: 'Change Email'}}), UpdateEmail)

export default connect(
  (state: TypedState, ownProps: {}) => {
    const {waitingForResponse} = state.settings
    const {emails, error, newEmail} = state.settings.email
    if (emails.length > 0) {
      const {email, isVerified} = emails[0]
      return {
        email,
        isVerified,
        edited: newEmail && newEmail !== email,
        error,
        waitingForResponse,
      }
    }
    return {
      email: null,
      isVerified: false,
      edited: false,
      error: null,
      waitingForResponse,
    }
  },
  (dispatch: any, ownProps: {}) => ({
    onChangeNewEmail: (email: string) => dispatch(onChangeNewEmail(email)),
    onBack: () => dispatch(navigateUp()),
    onSave: () => dispatch(onSubmitNewEmail()),
  })
)(UserEmailContainer)
