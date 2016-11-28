// @flow
import UpdateEmail from './index'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/route-tree'
import {onSubmitNewEmail, onChangeNewEmail} from '../../actions/settings'

import type {TypedState} from '../../constants/reducer'

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
)(UpdateEmail)
