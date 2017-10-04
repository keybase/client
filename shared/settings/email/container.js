// @flow
import UpdateEmail from './index'
import {navigateUp} from '../../actions/route-tree'
import {onChangeNewEmail, onSubmitNewEmail} from '../../actions/settings'
import {connect} from 'react-redux'

const mapStateToProps = (state: TypedState) => {
  const {waitingForResponse} = state.settings
  const {emails, error} = state.settings.email
  let email = ''
  let isVerified = false
  if (emails.length > 0) {
    email = emails[0].email
    isVerified = emails[0].isVerified
  }
  return {
    email,
    error,
    isVerified,
    waitingForResponse,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  onSave: email => {
    dispatch(onChangeNewEmail(email))
    dispatch(onSubmitNewEmail())
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(UpdateEmail)
